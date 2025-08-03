import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { PDFDocument } from 'pdf-lib';
import {
    DocumentAnalysisOutcome, ProcessedDocument, GeminiContentPart, TitleChainEvent, RedFlagItem, PropertySummary
} from '../../types/property';

// Dynamically import pdfjs-dist
let pdfjsLib: any;

async function loadPdfJs() {
  if (typeof window !== 'undefined') {
    if (!pdfjsLib) {
      // Use the main entry point for pdfjs-dist, which is more robust with bundlers.
      const pdfjsStarImport = await import('pdfjs-dist');
      pdfjsLib = pdfjsStarImport;
      if ('Worker' in window) {
          // Use the standard worker script, not the module version, for broader compatibility.
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      }
    }
  }
}

const IMAGE_MIME_TYPE = 'image/jpeg';
const PDF_RENDERING_SCALE = 1.2;
const WARN_THRESHOLD_PAGES_PER_FILE = 50;
const WARN_THRESHOLD_TOTAL_PAGES = 150;

const fileToTypedArray = async (file: File): Promise<Uint8Array> => {
  return new Uint8Array(await file.arrayBuffer());
};

const convertSinglePdfToImageParts = async (
    file: File,
    onProgress: (progress: { processed: number; total: number; fileName: string }) => void
): Promise<{imageParts: GeminiContentPart[], totalPages: number, fileName: string}> => {
  await loadPdfJs();
  if (!pdfjsLib) {
    return { imageParts: [], totalPages: 0, fileName: file.name };
  }
  const typedArray = await fileToTypedArray(file);
  const pdfDoc: any = await pdfjsLib.getDocument({ data: typedArray }).promise;
  const totalPages = pdfDoc.numPages;
  const imageParts: GeminiContentPart[] = [];

  if (totalPages > WARN_THRESHOLD_PAGES_PER_FILE) {
    console.warn(`PDF "${file.name}" has ${totalPages} pages. Processing many pages client-side can be resource-intensive.`);
  }

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: PDF_RENDERING_SCALE }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) {
      throw new Error(`Could not get canvas context for ${file.name}`);
    }

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const base64ImageData = canvas.toDataURL(IMAGE_MIME_TYPE, 0.9).split(',')[1]; 
    imageParts.push({
      inlineData: {
        mimeType: IMAGE_MIME_TYPE,
        data: base64ImageData,
      },
    });
    onProgress({ processed: i, total: totalPages, fileName: file.name });
    
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
  return {imageParts, totalPages, fileName: file.name};
};

const splitPdf = async (sourcePdf: File, pageNumbers: number[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(await sourcePdf.arrayBuffer());
  const subDocument = await PDFDocument.create();
  const copiedPages = await subDocument.copyPages(pdfDoc, pageNumbers.map(n => n - 1));
  copiedPages.forEach(page => subDocument.addPage(page));
  return subDocument.save();
};

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

4.  Construct a "Title Chain / Ownership Sequence" by identifying documents that represent transfers of ownership (e.g., Sale Deed, Gift Deed, Mortgage Deed, Release Deed, Inheritance documents, Court Orders affecting title).
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

5.  Identify "Potential Red Flags" that a lawyer conducting property due diligence should be aware of. These are issues or inconsistencies that might indicate problems with title, legality, or completeness of the documentation.
    For each identified red flag, provide:
    a. 'redFlagId': A unique string ID for this red flag (e.g., "rf_0").
    b. 'description': A clear and concise explanation of the potential issue.
    c. 'severity': Assign a severity level - 'Low', 'Medium', or 'High'.
    d. 'suggestion': A brief, actionable suggestion on what to investigate further, what specific clarification to seek, or what documents might be needed to resolve the concern.
    e. 'relatedDocumentIds': (Optional) An array of 'documentId's from the 'processedDocuments' list that are relevant to this red flag.
    Present these red flags in an array called \`redFlags\`. If no significant red flags are identified, \`redFlags\` should be an empty array or omitted.

6.  List any pages that were entirely unprocessable or appear to be genuinely blank/irrelevant in the \`unsupportedPages\` array, specifying their \`sourceFileName\`, \`pageNumberInSourceFile\`, and a \`reason\`.

IMPORTANT: Your entire response MUST be a single, valid JSON object. Do not include any text before or after the JSON object.
The JSON object should conform to the following TypeScript interface structure:

interface ProcessedDocument {
  documentId: string;
  sourceFileName: string;
  originalImageIndex: number;
  documentType: string;
  pageRangeInSourceFile?: string;
  summary: string;
  status: 'Processed' | 'Unsupported';
  date?: string;
  partiesInvolved?: string;
  unsupportedReason?: string;
}

interface TitleChainEvent {
  eventId: string;
  order: number;
  date: string;
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
  inputFiles: { name: string; totalPages: number }[];
  processedDocuments: ProcessedDocument[];
  titleChainEvents?: TitleChainEvent[];
  redFlags?: RedFlagItem[];
  unsupportedPages: {
    sourceFileName: string;
    pageNumberInSourceFile: string;
    reason: string;
  }[];
}
`;
};

export const analyzeDocumentWithGemini = async (
    files: File[],
    onProgress: (progress: { type: 'pdfProcessing' | 'gemini'; fileProcessing?: {fileName: string, processed: number, total: number}; message?: string }) => void
): Promise<DocumentAnalysisOutcome> => {

  const inputFilesSummary: {name: string, totalPages: number}[] = [];
  const allImageParts: GeminiContentPart[] = [];
  let totalCombinedPages = 0;

  onProgress({ type: 'pdfProcessing', message: 'Starting PDF processing for all files...' });

  for (const file of files) {
    onProgress({ type: 'pdfProcessing', fileProcessing: { fileName: file.name, processed: 0, total: 0 }, message: `Preparing to process ${file.name}`});
    const {imageParts: fileImageParts, totalPages: fileTotalPages } = await convertSinglePdfToImageParts(file, (pdfProgress) => {
      onProgress({ type: 'pdfProcessing', fileProcessing: {fileName: file.name, processed: pdfProgress.processed, total: pdfProgress.total }, message: `Processing ${file.name}: Page ${pdfProgress.processed} of ${pdfProgress.total}...` });
    });
    allImageParts.push(...fileImageParts);
    inputFilesSummary.push({ name: file.name, totalPages: fileTotalPages });
    totalCombinedPages += fileTotalPages;
  }

  if (allImageParts.length === 0) {
    throw new Error("No pages could be processed from any of the PDF files.");
  }
  if (totalCombinedPages > WARN_THRESHOLD_TOTAL_PAGES) {
      console.warn(`Total combined pages (${totalCombinedPages}) across ${files.length} files is high. This may lead to very long processing times or hit API limits.`);
      onProgress({type: 'gemini', message: `Warning: Processing a large number of combined pages (${totalCombinedPages}). This may take a significant amount of time.`});
  }

  onProgress({ type: 'gemini', message: `Sending ${allImageParts.length} total page(s) from ${files.length} file(s) to the backend for analysis... This might take a while.` });

  try {
    const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            allImageParts,
            inputFilesSummary,
            totalCombinedPages,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    onProgress({ type: 'gemini', message: 'Received response. Parsing analysis results...' });
    const analysisOutcome = await response.json() as DocumentAnalysisOutcome;

    return analysisOutcome;

  } catch (error: any) {
    console.error("Error during API call or parsing:", error);
    let errorMessage = "Failed to get analysis from the backend.";
    if (error.message) {
        errorMessage += ` Details: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
};
