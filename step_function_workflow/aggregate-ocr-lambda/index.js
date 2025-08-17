const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { prompts } = require('./common/prompts');

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

exports.handler = async (event) => {
    console.log("Received event for OCR aggregation:", JSON.stringify(event, null, 2));

    const { ocrResults, ...originalInput } = event;
    const { s3Key } = originalInput;

    try {
        let bucketName;
        const allPageContents = [];
        for (const result of ocrResults) {
            const s3Path = result.s3Path;
            bucketName = s3Path.split('/')[2];
            const key = s3Path.split('/').slice(3).join('/');
            
            const getObjectParams = { Bucket: bucketName, Key: key };
            const data = await s3Client.send(new GetObjectCommand(getObjectParams));
            const content = await data.Body.transformToString();
            allPageContents.push(...JSON.parse(content));
        }

        // Sort the pages to ensure they are in the correct order
        allPageContents.sort((a, b) => a.page - b.page);

        console.log(`Successfully aggregated and sorted ${allPageContents.length} pages.`);

        // Reconstruct the full text in the same format as the original script
        const fullText = allPageContents
            .map(p => `[Page ${p.page}]\nVisual Description: ${p.visualDescription || 'N/A'}\nText Content:\n${p.content}`)
            .join('\n\n---\n\n');

        // Save the full text to a new S3 object
        const fullTextKey = `${s3Key}/aggregated-text.txt`;
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fullTextKey,
            Body: fullText,
            ContentType: "text/plain"
        }));

        console.log(`Successfully saved aggregated text to s3://${bucketName}/${fullTextKey}`);

        // Create the tasks for the next parallel state
        const analysisTasks = Object.keys(prompts);

        // Pass the S3 path of the full text and other necessary info to the next step
        return {
            ...originalInput,
            fullTextS3Path: `s3://${bucketName}/${fullTextKey}`,
            analysisTasks,
        };

    } catch (error) {
        console.error("A critical error occurred in aggregate-ocr-lambda:", error);
        throw error; // Re-throw to fail the Step Function execution
    }
};
