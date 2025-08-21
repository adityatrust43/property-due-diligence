const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getSynthesisPrompt } = require("./common/prompts");
const { extractJson } = require("./common/utils");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async (event) => {
    console.log("Received event for indexed document analysis:", JSON.stringify(event, null, 2));

    // This lambda receives the direct output from AggregateOcrResults
    const { fullTextS3Path, fileName } = event.ocrResult;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing required environment variable: GEMINI_API_KEY.");
    }
    if (!fullTextS3Path || !fileName) {
        throw new Error("Missing required input parameters: fullTextS3Path, fileName.");
    }

    try {
        // Read the full text from S3
        const bucketName = fullTextS3Path.split('/')[2];
        const key = fullTextS3Path.split('/').slice(3).join('/');
        const getObjectParams = { Bucket: bucketName, Key: key };
        const data = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fullText = await data.Body.transformToString();

        console.log("--- Starting analysis for Indexed Documents ---");
        const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const synthesisPrompt = getSynthesisPrompt(fileName, fullText);

        const synthesisResult = await proModel.generateContent(synthesisPrompt);
        const rawSynthesisText = synthesisResult.response.text();
        const finalJsonText = extractJson(rawSynthesisText, false); // false for object
        const finalParsedJson = JSON.parse(finalJsonText);

        console.log("Successfully synthesized results for Indexed Documents.");
        return finalParsedJson;

    } catch (err) {
        console.error("Error during Indexed Document analysis:", err);
        throw new Error(`Failed to process Indexed Document analysis: ${err.message}`);
    }
};
