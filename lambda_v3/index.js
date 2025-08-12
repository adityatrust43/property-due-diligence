const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

const generationConfig = {
    temperature: 0.2,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getPageFinderPrompt = (fileName) => `
You are an AI assistant specializing in analyzing legal property documents.
The user has provided a PDF document named "${fileName}".
Your task is to identify the page numbers for specific types of documents within this PDF.
Focus ONLY on the following document types: "Sale Deed", "Gift Deed", "Mortgage Deed", "Release Deed", "Partition Deed", "Will", "Power of Attorney", "Agreement of Sale", "Title Deed".
For each document type you find, provide the exact starting and ending page numbers.
Your response must be a JSON object with a single key "documentLocations", which is an array of objects. Each object should have "documentType" and "pageRange" (e.g., "1-5").
Example: {"documentLocations": [{"documentType": "Sale Deed", "pageRange": "3-12"}, {"documentType": "Will", "pageRange": "15-16"}]}
`;

const getTitleChainPrompt = (fileName) => `
You are an AI assistant specializing in tracing property ownership (title chain).
The user has provided a PDF document named "${fileName}".
Your task is to identify ONLY the documents that represent a change in ownership or title. These are typically "Sale Deed" and "Gift Deed".
For each of these title change events, extract the following information:
- eventId: A unique identifier for the event.
- order: The chronological order of the event, starting from 0.
- date: The date of the transaction.
- documentType: The type of document (e.g., "Sale Deed").
- transferor: The person or entity transferring the property.
- transferee: The person or entity receiving the property.
- summaryOfTransaction: A brief summary of the transaction.
Your response must be a JSON object with a single key "titleChainEvents", which is an array of objects, ordered chronologically from oldest to newest.
`;

const getDetailedAnalysisPrompt = (fileName, documentType, pageRange) => `
You are an AI assistant specializing in detailed analysis of legal property documents.
The user has provided a PDF document named "${fileName}".
Your task is to perform a detailed analysis of the document section identified as a "${documentType}" on pages ${pageRange}.
Extract the following information:
- documentId: A unique identifier for this document section.
- sourceFileName: The name of the source file ("${fileName}").
- pageRangeInSourceFile: The page range for this section ("${pageRange}").
- documentType: The type of document ("${documentType}").
- date: The date of the document.
- partiesInvolved: An array of all parties involved in the document.
- summary: A comprehensive summary of the document's contents. Use markdown for formatting, especially for structured data like tables.
- redFlags: An array of any potential issues, inconsistencies, or red flags a lawyer should be aware of. Each red flag should be an object with "redFlagId", "description", "severity" ('Low', 'Medium', or 'High'), and "suggestion".
Your response must be a JSON object with a single key "documentAnalysis", containing the extracted information.
`;

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));
    const { s3Key, fileName, analysisId } = event;

    if (!UPLOADS_BUCKET || !REPORTS_BUCKET || !process.env.GEMINI_API_KEY) {
        console.error("Missing required environment variables.");
        return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    try {
        console.log("Generating presigned URL for S3 object...");
        const command = new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: s3Key });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log("Successfully generated presigned URL.");

        const pdfFile = {
            fileData: {
                mimeType: "application/pdf",
                fileUri: presignedUrl,
            },
        };

        // Step 1: Find the locations of all relevant documents
        console.log("Step 1: Finding document locations...");
        const pageFinderPrompt = getPageFinderPrompt(fileName);
        const pageFinderResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: pageFinderPrompt }, pdfFile] }],
            generationConfig,
            safetySettings,
        });
        const documentLocations = JSON.parse(pageFinderResult.response.text()).documentLocations;
        console.log("Found document locations:", documentLocations);

        // Step 2: Get the title chain
        console.log("Step 2: Getting title chain...");
        const titleChainPrompt = getTitleChainPrompt(fileName);
        const titleChainResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: titleChainPrompt }, pdfFile] }],
            generationConfig,
            safetySettings,
        });
        const titleChainEvents = JSON.parse(titleChainResult.response.text()).titleChainEvents;
        console.log("Extracted title chain events:", titleChainEvents);

        // Step 3: Perform detailed analysis on each document section
        console.log("Step 3: Performing detailed analysis...");
        const processedDocuments = [];
        for (const loc of documentLocations) {
            console.log(`Analyzing ${loc.documentType} on pages ${loc.pageRange}...`);
            const detailedAnalysisPrompt = getDetailedAnalysisPrompt(fileName, loc.documentType, loc.pageRange);
            const detailedAnalysisResult = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: detailedAnalysisPrompt }, pdfFile] }],
                generationConfig,
                safetySettings,
            });
            processedDocuments.push(JSON.parse(detailedAnalysisResult.response.text()).documentAnalysis);
        }
        console.log("Completed detailed analysis.");

        // Step 4: Combine all results into a final report
        const finalReport = {
            titleChainEvents,
            processedDocuments,
        };

        console.log("Writing final report to S3...");
        const reportKey = `reports/${analysisId}.json`;
        const putObjectParams = {
            Bucket: REPORTS_BUCKET,
            Key: reportKey,
            Body: JSON.stringify(finalReport, null, 2),
            ContentType: "application/json",
        };
        await s3Client.send(new PutObjectCommand(putObjectParams));

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Analysis complete", reportKey }),
        };
    } catch (error) {
        console.error("A critical error occurred in the handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to process document.", details: error.message }),
        };
    }
};
