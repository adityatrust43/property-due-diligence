const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getSynthesisPrompt, prompts } = require("./common/prompts");
const { extractJson } = require("./common/utils");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async (event) => {
    console.log("Received event for analysis task:", JSON.stringify(event, null, 2));

    const { fullTextS3Path, fileName, taskKey } = event;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing required environment variable: GEMINI_API_KEY.");
    }
    if (!fullTextS3Path || !fileName || !taskKey) {
        throw new Error("Missing required input parameters: fullTextS3Path, fileName, taskKey.");
    }
    if (!prompts[taskKey]) {
        throw new Error(`Invalid task key provided: ${taskKey}`);
    }

    try {
        // Read the full text from S3
        const bucketName = fullTextS3Path.split('/')[2];
        const key = fullTextS3Path.split('/').slice(3).join('/');
        const getObjectParams = { Bucket: bucketName, Key: key };
        const data = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fullText = await data.Body.transformToString();

        console.log(`--- Starting analysis for task: ${taskKey} ---`);
        const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const taskDescription = prompts[taskKey];
        const synthesisPrompt = getSynthesisPrompt(taskDescription, fileName, fullText);

        const synthesisResult = await proModel.generateContent(synthesisPrompt);
        const rawSynthesisText = synthesisResult.response.text();
        const finalJsonText = extractJson(rawSynthesisText, false); // false for object
        const finalParsedJson = JSON.parse(finalJsonText);

        console.log(`Successfully synthesized results for task ${taskKey}.`);
        return finalParsedJson; // Return the JSON result for this task

    } catch (err) {
        console.error(`Error during analysis for task ${taskKey}:`, err);
        // Create a structured error object to be returned
        const errorResult = {
            [taskKey]: {
                error: `Failed to analyze ${taskKey}`,
                details: err.message
            }
        };
        // Instead of throwing, we can return the error object.
        // The final aggregation can decide how to handle it.
        // For now, we'll throw to ensure the Step Function catches it as a failure.
        throw new Error(`Failed to process analysis for task ${taskKey}: ${err.message}`);
    }
};
