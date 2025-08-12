const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

const getBatchPrompt = (fileName, startPage, batchSize) => `
You are an OCR expert. You will be provided with ${batchSize} images from the document "${fileName}".
These images correspond to pages ${startPage} through ${startPage + batchSize - 1}.
For each image, extract all text content.
Your response must be a single JSON array, containing one object for each page in the batch.
Each object must have a "page" number and its "content".
- If a page has text, use the format: \`{"page": <number>, "content": "..."}\`
- If a page is blank, use: \`{"page": <number>, "content": "blank"}\`
Example for a batch starting at page 11 with 2 images:
[
  {"page": 11, "content": "Text from page 11..."},
  {"page": 12, "content": "blank"}
]
CRITICAL: Respond ONLY with the JSON array.
`;

const getSynthesisPrompt = (task, fileName, fullText) => `
You are an expert AI assistant for legal and property document analysis.
The user has provided the full text of a document named "${fileName}".
The full text is provided below:
---
${fullText}
---
Your task is to perform ONLY the following analysis: ${task}.
For each item you identify (like a title event or a red flag), you MUST include the \`startPage\` number from which the information was derived.
CRITICAL INSTRUCTION: Your entire response MUST be a single, valid JSON object. Do not include any introductory text or any text after the closing brace.
`;

const prompts = {
    propertySummary: `
        Generate a \`propertySummary\` object.
        - Based on all documents, determine the \`currentOwner\`.
        - Provide a concise, one-paragraph \`propertyBrief\` summarizing the property's key identifiers (area, location, address).
        - The output for this task must be a JSON object like: \`{"propertySummary": {"currentOwner": "...", "propertyBrief": "..."}}\`
    `,
    titleChain: `
        Generate a \`titleChainEvents\` array.
        - Identify all documents representing ownership transfers (e.g., Sale Deed, Gift Deed).
        - For each event, extract: \`eventId\`, \`order\` (chronological, starting from 0), \`date\`, \`documentType\`, \`transferor\`, \`transferee\`, a \`summaryOfTransaction\`, and the \`startPage\`.
        - Order the events strictly from oldest to newest.
        - The output for this task must be a JSON object like: \`{"titleChainEvents": [{"eventId": "...", "startPage": 1, ...}]}\`
    `,
    documentDetails: `
        Generate a \`processedDocuments\` array.
        - For each distinct document, determine its \`documentType\`, \`sourceFileName\`, and the \`startPage\`.
        - Provide a comprehensive \`summary\` that narrates the document's story and extracts all specific details: names, dates, measurements, monetary amounts, registration numbers, etc. Use markdown tables for structured data.
        - Extract the primary \`date\` and \`partiesInvolved\`.
        - Assign a unique \`documentId\`.
        - The output for this task must be a JSON object like: \`{"processedDocuments": [{"documentId": "...", "startPage": 1, ...}]}\`
    `,
    redFlags: `
        Generate a \`redFlags\` array.
        - Identify potential issues or inconsistencies that a lawyer should be aware of.
        - For each red flag, provide: \`redFlagId\`, a clear \`description\`, a \`severity\` ('Low', 'Medium', or 'High'), an actionable \`suggestion\`, and the \`startPage\`.
        - Examples: Discrepancies in names/dates, gaps in the title chain, undischarged mortgages.
        - The output for this task must be a JSON object like: \`{"redFlags": [{"redFlagId": "...", "startPage": 1, ...}]}\`
    `
};

const extractJson = (text) => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    if (match && match[1]) {
        return match[1];
    }
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        return text.substring(startIndex, endIndex + 1);
    }
    throw new Error("No valid JSON found in the response.");
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
        // STAGE 1: OCR with Gemini 1.5 Flash
        console.log("Fetching images from S3 for OCR...");
        const allImageParts = await getImagesFromS3(UPLOADS_BUCKET, s3Key);
        console.log(`Successfully fetched ${allImageParts.length} images.`);

        const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const pageContents = [];
        const BATCH_SIZE = 10;

        for (let i = 0; i < allImageParts.length; i += BATCH_SIZE) {
            const batchNum = (i / BATCH_SIZE) + 1;
            const imageBatch = allImageParts.slice(i, i + BATCH_SIZE);
            const startPage = i + 1;
            console.log(`Processing OCR batch ${batchNum} (pages ${startPage}-${startPage + imageBatch.length - 1}) with ${imageBatch.length} images.`);

            try {
                const prompt = getBatchPrompt(fileName, startPage, imageBatch.length);
                const result = await flashModel.generateContent([prompt, ...imageBatch]);
                const rawText = result.response.text();
                // The response should be a JSON array, so we need to find the start and end of it.
                const arrayStartIndex = rawText.indexOf('[');
                const arrayEndIndex = rawText.lastIndexOf(']');
                if (arrayStartIndex === -1 || arrayEndIndex === -1) {
                    throw new Error("No JSON array found in OCR response.");
                }
                const jsonText = rawText.substring(arrayStartIndex, arrayEndIndex + 1);
                const batchResults = JSON.parse(jsonText);
                pageContents.push(...batchResults);
                console.log(`Successfully processed OCR batch ${batchNum}.`);
            } catch (err) {
                console.error(`Error in OCR batch ${batchNum}:`, err);
                // If a batch fails, create error entries for each page in that batch
                for (let j = 0; j < imageBatch.length; j++) {
                    pageContents.push({ page: startPage + j, content: `Error in batch: ${err.message}` });
                }
            }
        }

        const fullText = pageContents
            .map(p => `[Page ${p.page}]\n${p.content}`)
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
                const finalJsonText = extractJson(rawSynthesisText);
                const finalParsedJson = JSON.parse(finalJsonText);
                Object.assign(finalCombinedResult, finalParsedJson);
                console.log(`Successfully synthesized results for task ${taskKey}.`);
            } catch (err) {
                console.error(`Error during analysis for task ${taskKey}:`, err);
                finalCombinedResult[taskKey] = { error: `Failed to analyze ${taskKey}`, details: err.message };
            }
        }

        console.log("All analysis tasks processed. Writing final report.");
        const reportKey = `reports/${analysisId}.json`;
        const putObjectParams = {
            Bucket: REPORTS_BUCKET,
            Key: reportKey,
            Body: JSON.stringify(finalCombinedResult, null, 2),
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
