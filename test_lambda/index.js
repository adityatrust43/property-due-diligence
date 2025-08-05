const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const s3Client = new S3Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME;

exports.handler = async (event) => {
    if (!process.env.GEMINI_API_KEY) {
        console.error("FATAL: GEMINI_API_KEY environment variable is not set.");
        return { statusCode: 500, body: "Server configuration error." };
    }
    // --- Start of Gemini API Test ---
    try {
        console.log("--- Starting Gemini API Test ---");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "What is the capital of France?";
        
        console.log("Sending request to Gemini API with prompt:", prompt);
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        console.log("Received full response object from Gemini API:");
        console.log(JSON.stringify(response, null, 2));
        
        const text = response.text();
        console.log("Extracted text from Gemini response:", text);
        console.log("--- Gemini API Test Succeeded ---");

    } catch (error) {
        console.error("--- Gemini API Test Failed ---");
        console.error("Error details:", error);
    }
    // --- End of Gemini API Test ---
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

    const mockAnalysisResult = {
        propertySummary: {
            currentOwner: "Mr. John Doe",
            propertyBrief: "A residential property located at 456 Oak Avenue, Springfield. The property consists of a single-family home with a total area of 2,500 sq. ft. on a 0.5 acre lot."
        },
        processedDocuments: [
            {
                documentId: "doc_0",
                sourceFileName: fileName,
                documentType: "Sale Deed",
                pageRangeInSourceFile: "Pages 1-5",
                summary: "This document is a Sale Deed executed on 2022-08-20 between Mr. Robert Smith (Seller) and Mr. John Doe (Buyer) for the sale of the property at 456 Oak Avenue. The sale price was $300,000.",
                status: "Processed",
                date: "2022-08-20",
                partiesInvolved: "Mr. Robert Smith (Seller), Mr. John Doe (Buyer)"
            },
            {
                documentId: "doc_1",
                sourceFileName: fileName,
                documentType: "Tax Receipt",
                pageRangeInSourceFile: "Page 6",
                summary: "A property tax receipt for the year 2023, showing a payment of $5,000. The receipt is in the name of Mr. John Doe.",
                status: "Processed",
                date: "2023-06-15",
                partiesInvolved: "Mr. John Doe, Springfield County Tax Office"
            }
        ],
        titleChainEvents: [
            {
                eventId: "tc_event_0",
                order: 0,
                date: "2018-05-10",
                documentType: "Gift Deed",
                transferor: "Mrs. Emily White",
                transferee: "Mr. Robert Smith",
                summaryOfTransaction: "Property gifted from Mrs. Emily White to her son, Mr. Robert Smith."
            },
            {
                eventId: "tc_event_1",
                order: 1,
                date: "2022-08-20",
                documentType: "Sale Deed",
                transferor: "Mr. Robert Smith",
                transferee: "Mr. John Doe",
                summaryOfTransaction: "Property sold by Mr. Robert Smith to Mr. John Doe for $300,000."
            }
        ],
        redFlags: [
            {
                redFlagId: "rf_0",
                description: "There is a discrepancy in the property area mentioned in the Sale Deed (2,500 sq. ft.) and the Tax Receipt (2,400 sq. ft.).",
                severity: "Low",
                suggestion: "Clarify the correct property area with the seller and the tax office."
            },
            {
                redFlagId: "rf_1",
                description: "The Gift Deed from 2018 is not registered. An unregistered gift deed may not be legally valid.",
                severity: "High",
                suggestion: "Consult a lawyer to verify the validity of the unregistered Gift Deed and its impact on the title chain."
            }
        ],
        unsupportedPages: [
            {
                sourceFileName: fileName,
                pageNumberInSourceFile: "7",
                reason: "Page is blank."
            }
        ]
    };

    const reportKey = `reports/${fileName.replace('.pdf', '')}-${Date.now()}.json`;
    const putObjectParams = {
        Bucket: REPORTS_BUCKET,
        Key: reportKey,
        Body: JSON.stringify(mockAnalysisResult, null, 2),
        ContentType: "application/json",
    };

    try {
        await s3Client.send(new PutObjectCommand(putObjectParams));
        console.log(`Successfully created mock report for ${fileName} and saved to ${reportKey}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Mock analysis complete", reportKey }),
        };
    } catch (error) {
        console.error("Error creating mock report:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to create mock report.", details: error.message }),
        };
    }
};
