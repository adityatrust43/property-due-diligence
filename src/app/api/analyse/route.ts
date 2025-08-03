import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { NextRequest, NextResponse } from 'next/server';
import { GeminiContentPart, DocumentAnalysisOutcome, ProcessedDocument, TitleChainEvent, RedFlagItem, PropertySummary } from '../../../types/property';

// --- PROMPT FOR STAGE 1: DOCUMENT IDENTIFICATION ---
const generateDocumentIdentificationPrompt = (fileListString: string, totalCombinedPages: number): string => `
You are an AI assistant specializing in document analysis. Your first task is to identify and segment a collection of page images from property documents.
The user has uploaded the following documents, concatenated into a single series of ${totalCombinedPages} images:
${fileListString}

Your task is to identify the boundaries of each distinct document (e.g., "Sale Deed", "Tax Receipt").
For each document you identify, provide:
1.  \`documentType\`: A brief, accurate name for the document.
2.  \`sourceFileName\`: The name of the source file this document belongs to.
3.  \`startPage\`: The 1-based page number within the source file where this document begins.
4.  \`endPage\`: The 1-based page number within the source file where this document ends.

Your entire response MUST be a single, valid JSON object containing a single key "identifiedDocuments" which is an array of the objects you identified.
Example:
{
  "identifiedDocuments": [
    { "documentType": "Sale Deed", "sourceFileName": "document1.pdf", "startPage": 1, "endPage": 12 },
    { "documentType": "Tax Receipt", "sourceFileName": "document1.pdf", "startPage": 13, "endPage": 13 },
    { "documentType": "Plot Buyer's Agreement", "sourceFileName": "document2.pdf", "startPage": 1, "endPage": 8 }
  ]
}
Be precise with page numbers. Do not add any other text or explanations.
`;

// --- PROMPT FOR STAGE 2: DETAILED DOCUMENT ANALYSIS ---
const generateDetailedAnalysisPrompt = (documentType: string, sourceFileName: string, pageCount: number): string => `
You are an expert AI assistant specialized in analyzing property and legal documents.
You have been provided with ${pageCount} page image(s) from a document titled "${documentType}" originating from the file "${sourceFileName}".
Your task is to perform a detailed analysis of ONLY these provided images and perform the following:

1.  **Detailed Summary**: Provide a comprehensive \`summary\`. This summary MUST:
    a.  Serve as a detailed explanation, articulating the document's core content, primary purpose, and its overall implications or the "story" it tells.
    b.  Explicitly extract and include all specific, important details:
        -   **Measurements:** e.g., land area (acres, sq ft, sq m), dimensions.
        -   **Names:** Full names of all individuals, companies, witnesses, and property identifiers.
        -   **Numbers:** Monetary amounts (with currency), registration numbers, survey numbers, plot numbers, loan account numbers.
        -   **Dates:** All relevant dates, such as date of execution, registration, birth, commencement, expiry.
    c.  If the document contains structured information (like a property schedule or payment breakdown), present it as a **concise markdown table** within the summary.

2.  **Key Fields**: Extract the following specific fields:
    a.  \`date\`: The primary, most prominent or effective date of the document.
    b.  \`partiesInvolved\`: The key parties, listing their roles (e.g., "John Doe (Seller) & Jane Smith (Buyer)").

3.  **Title Chain Event**: CRITICAL: Only proceed if this document is a **legal instrument that transfers property ownership**.
    -   **INCLUDE**: Sale Deed, Gift Deed, Release Deed, Inheritance document, Court Order that transfers title.
    -   **EXCLUDE**: Tax Receipts, Legal Notices, Property Assessments, Encumbrance Certificates, Plot Buyer's Agreements (unless it's the final sale deed), or any other supporting document that does not, by itself, transfer the title.
    If it meets the criteria, extract the details for a \`titleChainEvent\`. If it does not, omit the \`titleChainEvent\` object entirely.
    a.  \`date\`: The primary date of the event (YYYY-MM-DD).
    b.  \`documentType\`: The type of document.
    c.  \`transferor\`: The name(s) of the party ceding the rights.
    d.  \`transferee\`: The name(s) of the party acquiring the rights.
    e.  \`propertyDescription\`: A brief identifier for the property.
    f.  \`summaryOfTransaction\`: A concise narrative of the event.

4.  **Red Flags**: Identify any "Potential Red Flags" within this document. For each, provide:
    a.  \`description\`: A clear explanation of the potential issue.
    b.  \`severity\`: 'Low', 'Medium', or 'High'.
    c.  \`suggestion\`: An actionable suggestion for further investigation.

Your entire response MUST be a single, valid JSON object. Do not include any text before or after the JSON object.
The JSON object should conform to this TypeScript interface:
interface DetailedAnalysis {
  summary: string;
  date?: string;
  partiesInvolved?: string;
  titleChainEvent?: {
    date: string;
    documentType: string;
    transferor: string;
    transferee: string;
    propertyDescription?: string;
    summaryOfTransaction: string;
  };
  redFlags?: {
    description: string;
    severity: 'Low' | 'Medium' | 'High';
    suggestion: string;
  }[];
}
`;

// Helper to safely parse JSON from AI response
const parseJsonResponse = (text: string): any => {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON response:", text);
        throw new Error("Received an invalid JSON response from the AI.");
    }
};

export async function POST(req: NextRequest) {
    const { allImageParts, inputFilesSummary, totalCombinedPages } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "Server configuration error: API key not set." }, { status: 500 });
    }
    if (!allImageParts || !inputFilesSummary || totalCombinedPages === undefined) {
        return NextResponse.json({ error: "Missing required parameters in request." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    try {
        // --- STAGE 1: IDENTIFY DOCUMENT BOUNDARIES ---
        const fileListString = inputFilesSummary.map((f: { name: string; totalPages: number; }) => `- ${f.name} (${f.totalPages} pages)`).join('\n');
        const identificationPrompt = generateDocumentIdentificationPrompt(fileListString, totalCombinedPages);
        
        const identificationResult: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: "user", parts: [ {text: identificationPrompt}, ...allImageParts] }],
            config: { responseMimeType: "application/json" }
        });

        const identificationResponse = identificationResult;
        const identificationResponseText = identificationResponse.text;
        if (!identificationResponseText) {
            throw new Error("Received an empty response from the Stage 1 API call.");
        }
        const identifiedDocs = parseJsonResponse(identificationResponseText).identifiedDocuments;

        if (!identifiedDocs || !Array.isArray(identifiedDocs)) {
            throw new Error("Stage 1 failed: Could not identify document sections.");
        }

        // --- STAGE 2: DETAILED ANALYSIS FOR EACH DOCUMENT ---
        const finalOutcome: DocumentAnalysisOutcome = {
            inputFiles: inputFilesSummary,
            processedDocuments: [],
            titleChainEvents: [],
            redFlags: [],
            unsupportedPages: [] // This will be populated later if needed
        };

        let titleChainOrder = 0;
        let redFlagCounter = 0;

        // Create a map for quick lookup of page ranges
        const pageOffsets = new Map<string, number>();
        let currentOffset = 0;
        for (const file of inputFilesSummary) {
            pageOffsets.set(file.name, currentOffset);
            currentOffset += file.totalPages;
        }

        for (let i = 0; i < identifiedDocs.length; i++) {
            const doc = identifiedDocs[i];
            const { documentType, sourceFileName, startPage, endPage } = doc;

            if (!documentType || !sourceFileName || !startPage || !endPage) continue;

            const fileOffset = pageOffsets.get(sourceFileName) ?? 0;
            const startIndex = fileOffset + startPage - 1;
            const endIndex = fileOffset + endPage - 1;

            if (startIndex < 0 || endIndex >= allImageParts.length || startIndex > endIndex) continue;

            const docImageParts = allImageParts.slice(startIndex, endIndex + 1);
            const detailedPrompt = generateDetailedAnalysisPrompt(documentType, sourceFileName, docImageParts.length);

            const detailedResult: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: [{ role: "user", parts: [{ text: detailedPrompt }, ...docImageParts] }],
                config: { responseMimeType: "application/json" }
            });
            
            const detailedResponse = detailedResult;
            const detailedResponseText = detailedResponse.text;
            if (!detailedResponseText) {
                throw new Error(`Received an empty response from the Stage 2 API call for ${documentType}.`);
            }
            const analysis = parseJsonResponse(detailedResponseText);

            const docId = `doc_${sourceFileName}_idx${i}`;
            
            // Aggregate results
            finalOutcome.processedDocuments.push({
                documentId: docId,
                sourceFileName,
                originalImageIndex: startIndex,
                documentType,
                pageRangeInSourceFile: startPage === endPage ? `Page ${startPage}` : `Pages ${startPage}-${endPage}`,
                summary: analysis.summary || "No summary provided.",
                status: 'Processed',
                date: analysis.date,
                partiesInvolved: analysis.partiesInvolved,
            });

            if (analysis.titleChainEvent) {
                finalOutcome.titleChainEvents?.push({
                    ...analysis.titleChainEvent,
                    eventId: `tc_event_${titleChainOrder}`,
                    order: titleChainOrder++,
                    relatedDocumentId: docId,
                });
            }

            if (analysis.redFlags) {
                analysis.redFlags.forEach((flag: any) => {
                    finalOutcome.redFlags?.push({
                        ...flag,
                        redFlagId: `rf_${redFlagCounter++}`,
                        relatedDocumentIds: [docId]
                    });
                });
            }
        }
        
        // Post-process to get overall summary (can be a separate call or derived)
        // For now, we'll leave it blank as the main focus is per-document accuracy.
        // A future improvement could be a final summarization call.

        return NextResponse.json(finalOutcome);

    } catch (error: any) {
        console.error("Error during multi-stage Gemini API call:", error);
        let errorMessage = "Failed to get analysis from the backend.";
        if (error.message) {
            errorMessage += ` Details: ${error.message}`;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
