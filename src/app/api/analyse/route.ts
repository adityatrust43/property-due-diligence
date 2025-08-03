import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { NextRequest, NextResponse } from 'next/server';
import { GeminiContentPart, DocumentAnalysisOutcome } from '../../../types/property';

const generateSimplifiedAnalysisPrompt = (inputFilesSummary: {name: string, totalPages: number}[], totalCombinedPages: number): string => {
  const fileListString = inputFilesSummary.map(f => `- ${f.name} (${f.totalPages} pages)`).join('\n');

  return `
You are an expert AI assistant specialized in analyzing documents, particularly property and legal documents for due diligence purposes.
The user has uploaded PDF documents which, combined, have ${totalCombinedPages} pages.
The uploaded documents are:
${fileListString}

I will provide you with a series of images. These images are a concatenation of all pages from the above documents, in the order they were listed.
Your task is to analyze ALL provided images as a single, consolidated set and perform the following:

1.  **Overall Property Summary**: First, create a top-level summary of the property.
    a.  Based on the entire set of documents, determine the \`currentOwner\`. This should be the final owner after the last transaction in the title chain.
    b.  Provide a \`propertyBrief\`. This should be a concise, one-paragraph summary of the property's key identifiers (like area, location, address, or type) as derived from the most recent and relevant documents.
    c.  This summary should be placed in a \`propertySummary\` object at the root of the final JSON.

2.  Identify distinct document sections (e.g., Sale Deed, Lease Agreement, Tax Receipt, Legal Notice, Property Title Search Report).
3.  For each identified document section:
    a.  Determine its \`documentType\`.
    b.  Specify its \`sourceFileName\` from the list above.
    c.  Accurately determine the start and end page for the document section and specify this range in \`pageRangeInSourceFile\` (e.g., "Pages 1-5"). This is critical for linking back to the source.
    d.  Provide a comprehensive \`summary\`. This summary MUST:
        i.  Serve as a detailed explanation, articulating the document's core content, primary purpose, and its overall implications or the "story" it tells.
        ii. If the document describes a sequence of events, transactions, or a legal narrative, narrate this clearly and thoroughly.
        iii. Explicitly extract and include all specific, important details:
            -   **Measurements:** e.g., land area (acres, sq ft, sq m), dimensions (length, width), distances.
            -   **Names:** Full names of individuals, companies, organizations, government entities, witnesses, property names/identifiers (e.g., "Sunrise Apartments, Unit 5B", "Plot No. 123, Evergreen Estates").
            -   **Numbers:** Monetary amounts (e.g., sale price, rent, penalties, fees - include currency), registration numbers, survey numbers, plot numbers, case file numbers, loan account numbers, quantities, percentages, important clause numbers or section references.
            -   **Dates:** All relevant dates such as date of execution, date of registration, date of birth, commencement date, expiry date, date of notice, hearing dates.
        iv. If the document contains structured information (e.g., a schedule of property, list of encumbrances, breakdown of payments, inventory of items, list of heirs), present this information as a **concise markdown table** within the summary to improve clarity. This table should complement the narrative.
        v.  The goal is an understanding so complete that one might not need to read the original document to grasp its essential meaning, narrative, key data, and significance.
        vi. If critical parts of the document are in a language other than English, translate and explain this key information as part of the narrative.
    e.  Optionally, extract the primary \`date\` of the document (most prominent or effective date) and main \`partiesInvolved\` (e.g., "John Doe (Seller) & Jane Smith (Buyer)").
    f.  Indicate its \`status\` as 'Processed' if successfully analyzed, or 'Unsupported' if it could not be meaningfully processed. If 'Unsupported', provide a brief \`unsupportedReason\`.
    g.  Assign a unique \`documentId\` (e.g., "doc_file0_idx0_type").
    h.  Provide the \`originalImageIndex\`, the 0-based index of the first image *in the combined image array* where this document section begins.

3.  Construct a "Title Chain / Ownership Sequence" by identifying documents that represent transfers of ownership (e.g., Sale Deed, Gift Deed, Mortgage Deed, Release Deed, Inheritance documents, Court Orders affecting title).
    For each such event, extract:
    a. 'eventId': A unique string ID for this event (e.g., "tc_event_0").
    b. 'order': A sequential number starting from 0 for the chronological order of events. Events must be strictly ordered from oldest to newest.
    c. 'date': The primary date of the event (e.g., "YYYY-MM-DD"). This is crucial for ordering.
    d. 'documentType': The type of document (e.g., "Sale Deed").
    e. 'transferor': The name(s) of the party or parties ceding the rights/title. If not applicable (e.g., first acquisition), state "N/A" or "Original Allotment".
    f. 'transferee': The name(s) of the party or parties acquiring the rights/title.
    g. 'propertyDescription': (Optional) A brief identifier for the property involved if discernible from this specific transaction context (e.g., "Plot A, Riverview Estates", "Apartment 5B").
    h. 'summaryOfTransaction': A concise narrative summary of this specific event (e.g., "Property sold by John Doe to Jane Smith", "Mortgage created by Jane Smith in favor of XYZ Bank for loan amount $50,000").
    i. 'relatedDocumentId': (Optional) The 'documentId' from the 'processedDocuments' list if this event is directly evidenced by one of those specific documents.
    Present these events in an array called \`titleChainEvents\`, ordered chronologically from earliest to latest. If no such events are found, \`titleChainEvents\` should be an empty array or omitted.

4.  Identify "Potential Red Flags" that a lawyer conducting property due diligence should be aware of. These are issues or inconsistencies that might indicate problems with title, legality, or completeness of the documentation.
    For each identified red flag, provide:
    a. 'redFlagId': A unique string ID for this red flag (e.g., "rf_0").
    b. 'description': A clear and concise explanation of the potential issue.
    c. 'severity': Assign a severity level - 'Low', 'Medium', or 'High'.
        - 'Low': Minor discrepancies, points of attention that are likely explainable or have minor impact.
        - 'Medium': Issues that require further investigation and could potentially impact the transaction or title.
        - 'High': Significant concerns that could seriously jeopardize title, legality, or enforceability, or indicate potential fraud.
    d. 'suggestion': A brief, actionable suggestion on what to investigate further, what specific clarification to seek, or what documents might be needed to resolve the concern.
    e. 'relatedDocumentIds': (Optional) An array of 'documentId's from the 'processedDocuments' list that are relevant to this red flag.
    Examples of red flags include:
        - Discrepancies in names, dates, or property descriptions across related documents.
        - Unexplained gaps or inconsistencies in the title chain.
        - Undischarged mortgages, liens, or encumbrances.
        - Ambiguous or contradictory clauses within a document or between documents.
        - Signs of improper execution (e.g., missing critical signatures, attestations, or notarizations, if apparent).
        - Missing essential documents implied by other documents (e.g., a Sale Deed refers to a Power of Attorney that is not provided).
        - Property description changes significantly without clear explanation in subsequent deeds.
        - Claims or litigation mentioned but not fully resolved or documented.
    Present these red flags in an array called \`redFlags\`. If no significant red flags are identified, \`redFlags\` should be an empty array or omitted.

5.  List any pages that were entirely unprocessable or appear to be genuinely blank/irrelevant (e.g., separator sheets, fully blank pages, pages with only a logo and no substantive content) in the \`unsupportedPages\` array, specifying their \`sourceFileName\`, \`pageNumberInSourceFile\`, and a \`reason\` (e.g., "Page is blank", "Page appears to be a scanned cover sheet with no textual content", "Illegible content due to very poor scan quality"). Avoid listing pages as unsupported if they contain any discernible textual or structured data, even if it's sparse.

IMPORTANT: Your entire response MUST be a single, valid JSON object. Do not include any text before or after the JSON object.
The JSON object should conform to the following TypeScript interface structure:

interface ProcessedDocument {
  documentId: string;
  sourceFileName: string;
  originalImageIndex: number;
  documentType: string;
  pageRangeInSourceFile?: string;
  summary: string; // This is the detailed explanation, narrative, with extracted specifics and potential markdown tables.
  status: 'Processed' | 'Unsupported';
  date?: string; // Main document date
  partiesInvolved?: string; // Key parties
  unsupportedReason?: string;
}

interface TitleChainEvent {
  eventId: string;
  order: number;
  date: string; // "YYYY-MM-DD"
  documentType: string;
  transferor: string;
  transferee: string;
  propertyDescription?: string;
  summaryOfTransaction: string;
  relatedDocumentId?: string;
}

interface RedFlagItem {
  redFlagId: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  suggestion: string;
  relatedDocumentIds?: string[];
}

interface PropertySummary {
  currentOwner: string;
  propertyBrief: string;
}

interface DocumentAnalysisOutcome {
  propertySummary?: PropertySummary;
  inputFiles: { name: string; totalPages: number }[]; // Populate this with: ${JSON.stringify(inputFilesSummary)}
  processedDocuments: ProcessedDocument[];
  titleChainEvents?: TitleChainEvent[];
  redFlags?: RedFlagItem[]; // Array of potential red flags.
  unsupportedPages: {
    sourceFileName: string;
    pageNumberInSourceFile: string;
    reason: string;
  }[];
}

Analyze the provided images and construct the JSON output. Be factual, thorough, and clear. Ensure all data points are accurately extracted. If information for an optional field (like \`date\` or \`partiesInvolved\` for ProcessedDocument, or \`propertyDescription\` or \`relatedDocumentId\` for TitleChainEvent, or \`relatedDocumentIds\` for RedFlagItem) isn't clear or applicable, omit it or use an empty array where appropriate.
`;
};

export async function POST(req: NextRequest) {
    const { allImageParts, inputFilesSummary, totalCombinedPages } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY environment variable not set.");
        return NextResponse.json({ error: "Server configuration error: API key not set." }, { status: 500 });
    }

    if (!allImageParts || !inputFilesSummary || totalCombinedPages === undefined) {
        return NextResponse.json({ error: "Missing required parameters in request." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const promptTextPart: GeminiContentPart = {
        text: generateSimplifiedAnalysisPrompt(inputFilesSummary, totalCombinedPages)
    };

    const contents = { parts: [promptTextPart, ...allImageParts] };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: contents,
            config: {
                responseMimeType: "application/json",
            }
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error("Received an empty response from the API.");
        }
        
        let jsonStr = responseText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        const analysisOutcome = JSON.parse(jsonStr) as DocumentAnalysisOutcome;
        
        // Basic validation and cleanup
        if (!analysisOutcome.inputFiles || analysisOutcome.inputFiles.length === 0) {
            analysisOutcome.inputFiles = inputFilesSummary;
        }
        if (!analysisOutcome.processedDocuments) analysisOutcome.processedDocuments = [];
        if (!analysisOutcome.titleChainEvents) analysisOutcome.titleChainEvents = [];
        if (!analysisOutcome.redFlags) analysisOutcome.redFlags = [];
        if (!analysisOutcome.unsupportedPages) analysisOutcome.unsupportedPages = [];

        return NextResponse.json(analysisOutcome);

    } catch (error: any) {
        console.error("Error during Gemini API call or parsing in API route:", error);
        
        let errorMessage = "Failed to get analysis from Gemini.";
        let errorDetails = error.message || error.toString();

        if (error.toString().includes("API key not valid")) {
            errorMessage = "The provided API Key is not valid. Please check your server configuration.";
        } else if (error.toString().toLowerCase().includes("request entity too large") || error.toString().toLowerCase().includes("payload size")) {
            errorMessage = `The combined document data is too large to be processed. The generated image data exceeded API request size limits. Please try with smaller documents or fewer pages.`;
        } else {
            errorMessage = `An error occurred while communicating with the analysis service. Details: ${errorDetails}`;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
