const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

const getBatchPrompt = (fileName, startPage, batchSize) => `
You are an expert at analyzing document images. You will be provided with ${batchSize} images from the document "${fileName}".
These images correspond to pages ${startPage} through ${startPage + batchSize - 1}.
For each image, perform two tasks:
1.  **Text Extraction**: Transcribe all text content from the image.
2.  **Visual Description**: Provide a detailed description of the page's visual elements. This includes layout, presence of stamps, signatures, photos of people, tables, handwriting, or any other non-textual elements. For example: "The page appears to be a legal document with a government stamp in the top left corner, two columns of text, and three signatures at the bottom. There is a passport-sized photo of a person on the right."

Your response must be a single JSON array, containing one object for each page in the batch.
Each object must have a "page" number, its "content" (the text transcript), and a "visualDescription".
- If a page has text or visual elements, use the format: \`{"page": <number>, "content": "...", "visualDescription": "..."}\`
- If a page is completely blank, use: \`{"page": <number>, "content": "blank", "visualDescription": "blank"}\`

Example for a batch starting at page 11 with 2 images:
\`\`\`json
[
  {"page": 11, "content": "Text from page 11...", "visualDescription": "A legal document with a stamp and two signatures."},
  {"page": 12, "content": "blank", "visualDescription": "blank"}
]
\`\`\`
CRITICAL: Respond ONLY with the JSON array, enclosed in markdown backticks if necessary. Do not include any other text or explanations.
`;

const getSynthesisPrompt = (task, fileName, fullText) => `
You are an expert AI assistant for legal and property document analysis.
The user has provided the full text and a visual description for each page of a document named "${fileName}".
The full text and descriptions are provided below:
---
${fullText}
---
Your task is to perform ONLY the following analysis: ${task}.
Use both the transcribed text and the visual descriptions to inform your analysis. For example, a description of a "government stamp" or "multiple signatures" can provide important context.
For each item you identify (like a title event or a red flag), you MUST include the \`startPage\` number from which the information was derived.
CRITICAL INSTRUCTION: Your entire response MUST be a single, valid JSON object. Do not include any introductory text, markdown formatting, or any text after the closing brace. Your response should be immediately parsable by JSON.parse().
`;

const prompts = {
    propertySummary: `
        Generate a \`propertySummary\` object.
        - Determine the \`currentOwner\`. This should be the name of the individual or entity that currently owns the property based on the latest transaction document.
        - Provide a concise, one-paragraph \`propertyBrief\` that MUST include the property's size, area, specific location, and full address.
        - The output for this task MUST be a JSON object with the following structure: \`{"propertySummary": {"currentOwner": "...", "propertyBrief": "..."}}\`
    `,
    titleChain: `
        Generate a \`titleChainEvents\` array.
        - Identify ONLY documents that represent a transfer of ownership or title (e.g., Sale Deed, Gift Deed, Partition Deed, Release Deed). Exclude documents like mortgage deeds or agreements that do not transfer the title.
        - For each ownership transfer event, extract: \`eventId\`, \`order\` (chronological, starting from 0), \`date\` of the transaction, \`documentType\`, \`transferor\` (seller/donor), \`transferee\` (buyer/donee), a detailed \`summaryOfTransaction\`, the \`startPage\`, and the \`sourceFileName\`.
        - Order the events strictly from the oldest to the newest to show the clear history of the title.
        - The output for this task MUST be a JSON object with the following structure: \`{"titleChainEvents": [{"eventId": "...", "startPage": 1, "sourceFileName": "...", ...}]}\`
    `,
    documentDetails: `
        Generate a \`processedDocuments\` array, ordered chronologically from oldest to newest.
        - For each distinct document within the file, determine its \`documentType\`, \`sourceFileName\`, and the \`startPage\`.
        - Provide a comprehensive \`summary\` that narrates the document's story and extracts all specific details: names of all parties, all relevant dates, property measurements, monetary amounts, registration numbers, and any other specific identifiers. Use markdown tables for structured data where appropriate within the summary.
        - Extract the primary \`date\` of the document and all \`partiesInvolved\`.
        - Assign a unique \`documentId\`.
        - The output for this task MUST be a JSON object with the following structure: \`{"processedDocuments": [{"documentId": "...", "startPage": 1, ...}]}\`
    `,
    redFlags: `
        Generate a \`redFlags\` array.
        - Identify potential issues, risks, or inconsistencies that a lawyer should be aware of.
        - For each red flag, provide: \`redFlagId\`, a clear \`description\` of the issue, a \`severity\`, an actionable \`suggestion\`, and the \`startPage\`.
        - Set \`severity\` to 'High' ONLY if you are highly certain that the issue represents a serious legal problem or a major risk (e.g., a clear break in the title chain, an active lien or mortgage that is not discharged). Use 'Medium' for potential issues that require further investigation and 'Low' for minor discrepancies.
        - Examples of red flags: Discrepancies in names or dates across documents, gaps in the title chain, undischarged mortgages, unclear property descriptions.
        - The output for this task MUST be a JSON object with the following structure: \`{"redFlags": [{"redFlagId": "...", "startPage": 1, ...}]}\`
    `
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractJson = (text, isArray = false) => {
    // First, try to find JSON within markdown code blocks
    const markdownMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }

    // If not found, fall back to finding the first and last brace/bracket
    const startChar = isArray ? '[' : '{';
    const endChar = isArray ? ']' : '}';
    const startIndex = text.indexOf(startChar);
    const endIndex = text.lastIndexOf(endChar);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return text.substring(startIndex, endIndex + 1).trim();
    }

    throw new Error(`No valid JSON ${isArray ? 'array' : 'object'} found in the response.`);
};

async function getImagesFromS3(bucketName, s3Key) {
    const imageParts = [];
    const listParams = {
        Bucket: bucketName,
        Prefix: `${s3Key}/images/`,
    };

    const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        throw new Error(`No images found in S3 at prefix: ${listParams.Prefix}`);
    }

    for (const object of listedObjects.Contents) {
        // Skip directories and empty files
        if (object.Key.endsWith('/') || object.Size === 0) {
            console.log(`Skipping object (directory or empty file): ${object.Key}`);
            continue;
        }
        const getObjectParams = {
            Bucket: bucketName,
            Key: object.Key,
        };
        const data = await s3Client.send(new GetObjectCommand(getObjectParams));
        const buffer = await data.Body.transformToByteArray();
        imageParts.push({
            inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: "image/png",
            },
        });
    }

    return imageParts;
}

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));
    const { s3Key, fileName, analysisId } = event;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!UPLOADS_BUCKET || !REPORTS_BUCKET || !apiKey) {
        console.error("Missing required environment variables.");
        return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    try {
        // STAGE 1: OCR with Gemini gemini-2.5-flash-lite
        console.log("Fetching images from S3 for OCR...");
        const allImageParts = await getImagesFromS3(UPLOADS_BUCKET, s3Key);
        console.log(`Successfully fetched ${allImageParts.length} images.`);

        const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const pageContents = [];
        const BATCH_SIZE = 10;

        for (let i = 0; i < allImageParts.length; i += BATCH_SIZE) {
            const batchNum = (i / BATCH_SIZE) + 1;
            const imageBatch = allImageParts.slice(i, i + BATCH_SIZE);
            const startPage = i + 1;
            console.log(`Processing OCR batch ${batchNum} (pages ${startPage}-${startPage + imageBatch.length - 1}) with ${imageBatch.length} images.`);

            const MAX_RETRIES = 2;
            let lastError = null;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const prompt = getBatchPrompt(fileName, startPage, imageBatch.length);
                    const result = await flashModel.generateContent([prompt, ...imageBatch]);
                    const rawText = result.response.text();
                    const jsonText = extractJson(rawText, true); // true for array
                    const batchResults = JSON.parse(jsonText);
                    
                    console.log(`Successfully parsed JSON for batch ${batchNum}:`, JSON.stringify(batchResults, null, 2));
                    
                    pageContents.push(...batchResults);
                    console.log(`Successfully processed OCR batch ${batchNum} on attempt ${attempt}.`);
                    lastError = null; // Clear error on success
                    break; // Exit retry loop
                } catch (err) {
                    lastError = err;
                    console.error(`Attempt ${attempt} failed for OCR batch ${batchNum}:`, err.message);
                    if (err.status === 503 && attempt < MAX_RETRIES) {
                        console.log(`Service unavailable (503). Retrying in 1 seconds...`);
                        await delay(1000);
                    } else {
                        // Don't retry for non-503 errors or if it's the last attempt
                        break;
                    }
                }
            }

            if (lastError) {
                console.error(`Failed to process OCR batch ${batchNum} after ${MAX_RETRIES} attempts.`, lastError);
                for (let j = 0; j < imageBatch.length; j++) {
                    pageContents.push({ page: startPage + j, content: `Error after retries: ${lastError.message}` });
                }
            }
        }

        const fullText = pageContents
            .map(p => `[Page ${p.page}]\nVisual Description: ${p.visualDescription || 'N/A'}\nText Content:\n${p.content}`)
            .join('\n\n---\n\n');
        
        console.log("Text extraction complete. Starting analysis with Gemini 2.5 Pro.");

        // STAGE 2: Analysis with Gemini 2.5 Pro
        const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const finalCombinedResult = {};

        for (const [taskKey, taskDescription] of Object.entries(prompts)) {
            console.log(`--- Starting analysis for task: ${taskKey} ---`);
            try {
                const synthesisPrompt = getSynthesisPrompt(taskDescription, fileName, fullText);
                const synthesisResult = await proModel.generateContent(synthesisPrompt);
                const rawSynthesisText = synthesisResult.response.text();
                const finalJsonText = extractJson(rawSynthesisText, false); // false for object
                const finalParsedJson = JSON.parse(finalJsonText);
                Object.assign(finalCombinedResult, finalParsedJson);
                console.log(`Successfully synthesized results for task ${taskKey}.`);
            } catch (err) {
                console.error(`Error during analysis for task ${taskKey}:`, err);
                finalCombinedResult[taskKey] = { error: `Failed to analyze ${taskKey}`, details: err.message };
            }
        }

        console.log("All analysis tasks processed. Writing final report.");

        // Main report saved with analysisId
        const reportKey = `reports/${analysisId}.json`;
        const putReportParams = {
            Bucket: REPORTS_BUCKET,
            Key: reportKey,
            Body: JSON.stringify(finalCombinedResult, null, 2),
            ContentType: "application/json",
        };
        await s3Client.send(new PutObjectCommand(putReportParams));

        // Generate user-friendly name and save metadata
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const dateStr = `${day}_${month}_${year}`;
        const sanitizedFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const reportPrefix = `reports/${sanitizedFileName}-${dateStr}`;

        const listParams = { Bucket: REPORTS_BUCKET, Prefix: reportPrefix };
        const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));
        const runNumber = (listedObjects.Contents || []).filter(o => o.Key.endsWith('.json')).length + 1;
        
        const displayName = `${sanitizedFileName}-${dateStr}-${runNumber}.json`;
        const metadataKey = `reports/${analysisId}.metadata`;
        const putMetadataParams = {
            Bucket: REPORTS_BUCKET,
            Key: metadataKey,
            Body: JSON.stringify({ displayName }),
            ContentType: "application/json",
        };
        await s3Client.send(new PutObjectCommand(putMetadataParams));

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
