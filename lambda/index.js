const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const { createCanvas } = require("canvas");

const s3Client = new S3Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME;
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

// This is the original, more detailed image-based prompt.
const generateAnalysisPrompt = (fileName, pageCount) => {
    return `
You are an expert AI assistant specialized in analyzing documents, particularly property and legal documents for due diligence purposes.
The user has uploaded a PDF document named "${fileName}" which has ${pageCount} pages.
I will provide you with a series of images. These images are all pages from the document.
Your task is to analyze ALL provided images as a single, consolidated set and perform the following...
[The rest of your detailed prompt from /api/analyse/route.ts would go here]
IMPORTANT: Your entire response MUST be a single, valid JSON object.
`;
};

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    let s3Key;
    // Check if this is an S3 trigger event or a direct invocation
    if (event.Records && event.Records[0].s3) {
        s3Key = event.Records[0].s3.object.key;
    } else if (event.s3Key) {
        s3Key = event.s3Key;
    } else {
        console.error("Could not determine S3 key from event.");
        return { statusCode: 400, body: "Invalid event format" };
    }

    const fileName = s3Key.split('/').pop();

    try {
        // 1. Download PDF from S3
        const getObjectParams = { Bucket: UPLOADS_BUCKET, Key: s3Key };
        const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
        const pdfBuffer = await streamToBuffer(Body);

        // 2. Load PDF and render pages to images
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        const imageParts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext("2d");
            const renderContext = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;
            
            const imageBuffer = canvas.toBuffer("image/png");
            imageParts.push({
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/png",
                },
            });
        }

        // 3. Call Gemini API with images
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = generateAnalysisPrompt(fileName, pdf.numPages);
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let analysisJsonText = response.text();
        
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = analysisJsonText.match(fenceRegex);
        if (match && match[2]) {
          analysisJsonText = match[2].trim();
        }

        const analysisResult = JSON.parse(analysisJsonText);

        // 4. Save report to S3
        const reportKey = `reports/${fileName.replace('.pdf', '')}-${Date.now()}.json`;
        const putObjectParams = {
            Bucket: REPORTS_BUCKET,
            Key: reportKey,
            Body: JSON.stringify(analysisResult, null, 2),
            ContentType: "application/json",
        };
        await s3Client.send(new PutObjectCommand(putObjectParams));

        console.log(`Successfully processed ${fileName} and saved report to ${reportKey}`);
        return { statusCode: 200, body: JSON.stringify({ message: "Analysis complete", reportKey }) };

    } catch (error) {
        console.error("Error during document analysis:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to process document.", details: error.message }) };
    }
};

function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}
