const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const BATCH_SIZE = 10;

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));
    const { s3Key, fileName, analysisId } = event;

    if (!s3Key || !fileName || !analysisId) {
        throw new Error("Missing required input parameters: s3Key, fileName, analysisId.");
    }
    if (!UPLOADS_BUCKET) {
        throw new Error("Missing required environment variable: UPLOADS_BUCKET_NAME.");
    }

    try {
        const listParams = {
            Bucket: UPLOADS_BUCKET,
            Prefix: `${s3Key}/images/`,
        };

        const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            throw new Error(`No images found in S3 at prefix: ${listParams.Prefix}`);
        }

        // Filter out directories or empty files
        const imageKeys = listedObjects.Contents
            .filter(obj => !obj.Key.endsWith('/') && obj.Size > 0)
            .map(obj => obj.Key);

        const totalPages = imageKeys.length;
        console.log(`Found ${totalPages} images to process.`);

        const batches = [];
        for (let i = 0; i < totalPages; i += BATCH_SIZE) {
            const startPage = i + 1;
            const batchSize = Math.min(BATCH_SIZE, totalPages - i);
            batches.push({
                startPage: startPage,
                imageCount: batchSize,
                // Pass necessary info to each parallel branch
                s3Key: s3Key,
                fileName: fileName,
                analysisId: analysisId
            });
        }

        console.log(`Created ${batches.length} batches for parallel processing.`);

        // The output of this lambda will be the input to the Map state.
        // The Map state needs an array to iterate over.
        // So, the top-level output should be an object containing this array.
        return {
            s3Key,
            fileName,
            analysisId,
            batches
        };

    } catch (error) {
        console.error("A critical error occurred in split-pdf-lambda:", error);
        // Re-throw the error to fail the Step Function execution
        throw error;
    }
};
