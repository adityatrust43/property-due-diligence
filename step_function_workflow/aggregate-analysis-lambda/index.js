const { S3Client, PutObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

exports.handler = async (event) => {
    console.log("Received event for final aggregation:", JSON.stringify(event, null, 2));

    const { analysisId, fileName, parallelAnalysisOutput } = event;

    if (!REPORTS_BUCKET) {
        throw new Error("Missing required environment variable: REPORTS_BUCKET_NAME.");
    }
    if (!analysisId || !fileName || !parallelAnalysisOutput) {
        throw new Error("Missing required input parameters: analysisId, fileName, parallelAnalysisOutput.");
    }

    try {
        const [existingAnalysis, indexedDocumentResult] = parallelAnalysisOutput;
        const { analysisResults } = existingAnalysis;

        const finalCombinedResult = {};
        analysisResults.forEach(result => {
            Object.assign(finalCombinedResult, result);
        });
        Object.assign(finalCombinedResult, indexedDocumentResult.indexedDocumentResult);

        console.log("All analysis tasks successfully aggregated. Writing final report.");

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

        console.log(`Successfully saved report and metadata for analysisId: ${analysisId}`);

        return {
            statusCode: 200,
            message: "Analysis complete",
            reportKey: reportKey,
            displayName: displayName
        };

    } catch (error) {
        console.error("A critical error occurred in the final aggregation lambda:", error);
        throw error; // Re-throw to fail the Step Function execution
    }
};
