const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

const getBatchPrompt = (task, fileName, pageCount, batchNum, totalBatches) => `
You are an expert AI assistant specialized in analyzing legal and property documents.
The user has provided a document named "${fileName}" which has ${pageCount} pages.
This is BATCH ${batchNum} of ${totalBatches}. You must analyze ONLY the images provided in this batch.
Your task is to focus ONLY on the following: ${task}.
IMPORTANT: Your analysis for this batch will be combined with other batches later. Extract all relevant details from the pages in THIS BATCH ONLY.
CRITICAL INSTRUCTION: Your entire response MUST be a single, valid JSON object. Do not include any introductory text, phrases like "Here is the JSON you requested," or any text after the closing brace of the JSON object. The response should start with \`{\` and end with \`}\`.
`;

const getSynthesisPrompt = (task, fileName, partialResults) => `
You are an expert AI assistant specialized in synthesizing legal and property document analysis.
The user has provided a document named "${fileName}". The document was analyzed in multiple batches.
The following is a JSON array of the partial analysis results from each batch:
${JSON.stringify(partialResults, null, 2)}

Your task is to synthesize these partial results into a single, final, and coherent JSON object for the following task: ${task}.
You must consolidate all the information, remove duplicates, and ensure the final output is a complete and accurate representation of the entire document.
CRITICAL INSTRUCTION: Your entire response MUST be a single, valid JSON object, structured exactly as requested by the original task. Do not include any introductory text or any text after the closing brace.
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
        - For each event, extract: \`eventId\`, \`order\` (chronological, starting from 0), \`date\`, \`documentType\`, \`transferor\`, \`transferee\`, and a \`summaryOfTransaction\`.
        - Order the events strictly from oldest to newest.
        - The output for this task must be a JSON object like: \`{"titleChainEvents": [{"eventId": "...", ...}]}\`
    `,
    documentDetails: `
        Generate a \`processedDocuments\` array.
        - For each distinct document section, determine its \`documentType\`, \`sourceFileName\`, \`pageRangeInSourceFile\`.
        - Provide a comprehensive \`summary\` that narrates the document's story and extracts all specific details: names, dates, measurements, monetary amounts, registration numbers, etc. Use markdown tables for structured data.
        - Extract the primary \`date\` and \`partiesInvolved\`.
        - Assign a unique \`documentId\` and the starting \`originalImageIndex\`.
        - The output for this task must be a JSON object like: \`{"processedDocuments": [{"documentId": "...", ...}]}\`
    `,
    redFlags: `
        Generate a \`redFlags\` array.
        - Identify potential issues or inconsistencies that a lawyer should be aware of.
        - For each red flag, provide: \`redFlagId\`, a clear \`description\`, a \`severity\` ('Low', 'Medium', or 'High'), and an actionable \`suggestion\`.
        - Examples: Discrepancies in names/dates, gaps in the title chain, undischarged mortgages.
        - The output for this task must be a JSON object like: \`{"redFlags": [{"redFlagId": "...", ...}]}\`
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
                data: buffer.toString("base64"),
                mimeType: "image/png",
            },
        });
    }

    return imageParts;
}

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));
    const { s3Key, fileName, analysisId } = event;
    const BATCH_SIZE = 10; // Process 10 pages at a time

    const apiKey = process.env.GEMINI_API_KEY;

    if (!UPLOADS_BUCKET || !REPORTS_BUCKET || !apiKey) {
        console.error("Missing required environment variables. Check UPLOADS_BUCKET_NAME, REPORTS_BUCKET_NAME, and GEMINI_API_KEY.");
        return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error." }) };
    }

    try {
        console.log("Fetching images from S3...");
        const allImageParts = await getImagesFromS3(UPLOADS_BUCKET, s3Key);
        console.log(`Successfully fetched ${allImageParts.length} images.`);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const finalCombinedResult = {};

        console.log("Starting sequential, batched analysis of tasks...");

        for (const [taskKey, taskDescription] of Object.entries(prompts)) {
            console.log(`--- Starting processing for task: ${taskKey} ---`);
            const partialResults = [];
            const totalBatches = Math.ceil(allImageParts.length / BATCH_SIZE);

            for (let i = 0; i < allImageParts.length; i += BATCH_SIZE) {
                const batchNum = (i / BATCH_SIZE) + 1;
                const imageBatch = allImageParts.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${batchNum}/${totalBatches} for task ${taskKey} with ${imageBatch.length} images.`);

                try {
                    const prompt = getBatchPrompt(taskDescription, fileName, allImageParts.length, batchNum, totalBatches);
                    const result = await model.generateContent([prompt, ...imageBatch]);
                    const rawText = result.response.text();
                    const jsonText = extractJson(rawText);
                    partialResults.push(JSON.parse(jsonText));
                    console.log(`Successfully processed batch ${batchNum}/${totalBatches} for task ${taskKey}.`);
                } catch (err) {
                    console.error(`Error in batch ${batchNum} for task ${taskKey}:`, err);
                    partialResults.push({ error: `Failed to process batch ${batchNum}`, details: err.message });
                }
            }

            console.log(`All batches for task ${taskKey} complete. Synthesizing results...`);

            try {
                const synthesisPrompt = getSynthesisPrompt(taskDescription, fileName, partialResults);
                const synthesisResult = await model.generateContent(synthesisPrompt);
                const rawSynthesisText = synthesisResult.response.text();
                const finalJsonText = extractJson(rawSynthesisText);
                const finalParsedJson = JSON.parse(finalJsonText);
                Object.assign(finalCombinedResult, finalParsedJson);
                console.log(`Successfully synthesized results for task ${taskKey}.`);
            } catch (err) {
                console.error(`Error during synthesis for task ${taskKey}:`, err);
                finalCombinedResult[taskKey] = { error: `Failed to synthesize results for ${taskKey}`, details: err.message };
            }
        }

        console.log("All tasks processed. Writing final report.");
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
