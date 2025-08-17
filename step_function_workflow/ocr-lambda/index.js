const { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getBatchPrompt } = require("./common/prompts");
const { delay, extractJson } = require("./common/utils");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getImagesForBatch(bucketName, s3Key, startPage, imageCount) {
    const imageParts = [];
    const listParams = {
        Bucket: bucketName,
        Prefix: `${s3Key}/images/`,
    };

    const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        throw new Error(`No images found in S3 at prefix: ${listParams.Prefix}`);
    }

    // Sort and filter to get the correct batch of images
    const allImageKeys = listedObjects.Contents
        .filter(obj => !obj.Key.endsWith('/') && obj.Size > 0)
        .map(obj => obj.Key)
        .sort((a, b) => {
            // Extract page number from filename like page_001.png
            const pageA = parseInt(a.split('_').pop().split('.')[0]);
            const pageB = parseInt(b.split('_').pop().split('.')[0]);
            return pageA - pageB;
        });

    const batchImageKeys = allImageKeys.slice(startPage - 1, startPage - 1 + imageCount);

    for (const key of batchImageKeys) {
        const getObjectParams = { Bucket: bucketName, Key: key };
        const data = await s3Client.send(new GetObjectCommand(getObjectParams));
        const buffer = await data.Body.transformToByteArray();
        imageParts.push({
            inlineData: {
                data: Buffer.from(buffer).toString("base64"),
                mimeType: "image/png",
            },
        });
    }

    return imageParts;
}

exports.handler = async (event) => {
    console.log("Received event for OCR batch:", JSON.stringify(event, null, 2));
    const { s3Key, fileName, startPage, imageCount } = event;

    if (!UPLOADS_BUCKET || !process.env.GEMINI_API_KEY) {
        throw new Error("Missing required environment variables.");
    }

    try {
        console.log(`Processing OCR batch (pages ${startPage}-${startPage + imageCount - 1}) with ${imageCount} images.`);
        const imageBatch = await getImagesForBatch(UPLOADS_BUCKET, s3Key, startPage, imageCount);

        const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const MAX_RETRIES = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const prompt = getBatchPrompt(fileName, startPage, imageBatch.length);
                const result = await proModel.generateContent([prompt, ...imageBatch]);
                const rawText = result.response.text();
                console.log("Raw response from Gemini:", rawText);
                const jsonText = extractJson(rawText, true); // true for array
                const batchResults = JSON.parse(jsonText);
                
                const outputKey = `${s3Key}/ocr-results/batch-${startPage}.json`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: UPLOADS_BUCKET,
                    Key: outputKey,
                    Body: JSON.stringify(batchResults),
                    ContentType: "application/json"
                }));

                console.log(`Successfully processed OCR batch on attempt ${attempt} and saved to s3://${UPLOADS_BUCKET}/${outputKey}`);
                return {
                    s3Path: `s3://${UPLOADS_BUCKET}/${outputKey}`
                };
            } catch (err) {
                lastError = err;
                console.error(`Attempt ${attempt} failed for OCR batch:`, err.message);
                if (err.status === 503 && attempt < MAX_RETRIES) {
                    console.log(`Service unavailable (503). Retrying in 1 second...`);
                    await delay(1000);
                } else {
                    break; // Don't retry for non-503 errors or if it's the last attempt
                }
            }
        }

        // If all retries failed
        console.error(`Failed to process OCR batch after ${MAX_RETRIES} attempts.`, lastError);
        throw new Error(`Failed to process OCR for pages ${startPage}-${startPage + imageCount - 1}: ${lastError.message}`);

    } catch (error) {
        console.error(`A critical error occurred in ocr-lambda for pages ${startPage}-${startPage + imageCount - 1}:`, error);
        throw error; // Re-throw to fail the Step Function execution
    }
};
