
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import {
    DocumentAnalysisOutcome, ProcessedDocument, GeminiContentPart, TitleChainEvent, RedFlagItem
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

// PDF.js worker is now configured globally in index.tsx by setting GlobalWorkerOptions.workerSrc and isWorkerDisabled.
// The imported pdfjsLib.getDocument will use this global configuration.

const IMAGE_MIME_TYPE = 'image/jpeg'; // Use JPEG for smaller request payloads
const PDF_RENDERING_SCALE = 1.2; // Reduced scale for smaller image dimensions
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
    // If pdfjsLib is not available (e.g., on the server), return empty parts.
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
    
    // Explicitly clean up resources to prevent canvas reuse errors.
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
  return {imageParts, totalPages, fileName: file.name};
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

1.  Identify distinct document sections (e.g., Sale Deed, Lease Agreement, Tax Receipt, Legal Notice, Property Title Search Report).
2.  For each identified document section:
    a.  Determine its \`documentType\`.
    b.  Specify its \`sourceFileName\` from the list above.
    c.  Specify its page range within that source file (\`pageRangeInSourceFile\`, e.g., "Pages 1-5").
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

3.  Construct a "Title Chain / Ownership Sequence" by identifying documents that represent transfers of ownership or significant encumbrances (e.g., Sale Deed, Gift Deed, Mortgage Deed, Release Deed, Inheritance documents, Court Orders affecting title).
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

interface DocumentAnalysisOutcome {
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


const getMockAnalysisResult = (inputFiles: {name: string, totalPages: number}[]): DocumentAnalysisOutcome => {
  console.warn("Using MOCKED analysis result for document indexing, summarization, title chain, and red flags.");
  const mainFileName = inputFiles.length > 0 ? inputFiles[0].name : "mockFile1.pdf";
  const secondFileName = inputFiles.length > 1 ? inputFiles[1].name : "mockFile2.pdf";

  return {
    inputFiles: inputFiles,
    processedDocuments: [
      {
        documentId: "mock_doc_file0_idx0_saledeed",
        sourceFileName: mainFileName,
        originalImageIndex: 0,
        documentType: "Sale Deed (Mock)",
        pageRangeInSourceFile: "Pages 1-3",
        summary: `This mock Sale Deed, executed on October 26, 2023, meticulously documents the transfer of property ownership for 'Plot A, Riverview Estates', measuring 2.5 acres (approx. 108,900 sq ft). The seller, Mr. Samuel "Sam" Mockington (DOB: 15/05/1965), formally agreed to convey the property rights to Ms. Eleanor Buyer Testington (DOB: 20/08/1982, resident of 123 Fake St, Anytown). The transaction involved a total consideration of $100,000.00 USD, paid via check no. 567890 from Anytown Bank. Registration of this deed occurred on October 28, 2023, under document number REG-2023-XYZ-789. \n\nKey clauses detail the property's specific boundaries (North: Public Road, South: Plot B, East: Green River, West: Plot C) and legal description. The deed confirms receipt of payment and legally establishes Ms. Testington as the new, undisputed owner, extinguishing all prior claims by Mr. Mockington. This document is pivotal for Ms. Testington to prove her clear title. \n\nProperty Schedule (Appendix A referenced): \n| Item          | Description                   | Value      |\n|---------------|-------------------------------|------------|\n| Land          | Plot A, Riverview Estates     | $80,000.00 |\n| Structure     | Old Shed (to be demolished)   | $500.00    |\n| Easement      | Right of way for utilities    | N/A        |\n (Mock explanation for ${mainFileName})`,
        status: 'Processed',
        date: "2023-10-26",
        partiesInvolved: "Mr. Samuel Mockington (Seller), Ms. Eleanor Buyer Testington (Buyer)",
      },
      {
        documentId: "mock_doc_file0_idx3_receipt",
        sourceFileName: mainFileName,
        originalImageIndex: 3,
        documentType: "Property Tax Receipt (Mock)",
        pageRangeInSourceFile: "Page 4",
        summary: `This document is a mock property tax receipt for the fiscal year 2022-2023, concerning 'Plot A, Riverview Estates', Assessee ID: AT7890. It serves as official proof that Ms. Eleanor Buyer Testington has fulfilled her tax obligations amounting to $1,250.50 for the said property. The receipt, issued by Anytown Municipal Tax Authority, is dated April 15, 2023 (Receipt No. TXN-MOCK-00123). Payment was made via online transfer. This receipt is important for demonstrating compliance with local tax laws. Tax Period: 01/04/2022 to 31/03/2023. (Mock explanation for ${mainFileName})`,
        status: 'Processed',
        date: "2023-04-15",
        partiesInvolved: "Ms. Eleanor Buyer Testington, Anytown Municipal Tax Authority",
      },
      {
        documentId: "mock_doc_file1_idx0_lease",
        sourceFileName: secondFileName,
        originalImageIndex: inputFiles.length > 0 ? inputFiles[0].totalPages : 0, // Mock index after first file
        documentType: "Commercial Lease Agreement (Mock)",
        pageRangeInSourceFile: "Pages 1-2",
        summary: `This mock Commercial Lease Agreement, dated January 10, 2024, outlines terms for renting 'Unit B, Commerce Plaza, Downtown Anytown', a space of 1500 sq ft. Landlord: Placeholder Properties LLC. Tenant: Example Innovations Inc. Lease Term: 36 months, commencing February 1, 2024, and ending January 31, 2027. Monthly Rent: $2,500.00, due on the 1st of each month. Security Deposit: $5,000.00. Permitted Use: Office space for software development. Renewal Option: Tenant has one option to renew for 24 months at Fair Market Value, with 6 months prior notice. (Mock explanation for ${secondFileName})`,
        status: 'Processed',
        date: "2024-01-10",
        partiesInvolved: "Placeholder Properties LLC (Landlord), Example Innovations Inc. (Tenant)",
      },
      {
        documentId: "mock_doc_file1_idx2_unsupported",
        sourceFileName: secondFileName,
        originalImageIndex: (inputFiles.length > 0 ? inputFiles[0].totalPages : 0) + 2, // Mock index
        documentType: "Unknown Document Section (Mock)",
        pageRangeInSourceFile: "Page 3",
        summary: "The content of this section could not be reliably interpreted or identified as a distinct document. It appears to be of poor scan quality with largely illegible text, preventing any meaningful analysis, narrative extraction, or specific data point identification (e.g., names, dates, amounts, measurements).",
        status: 'Unsupported',
        unsupportedReason: "Poor scan quality, illegible text (mock).",
      }
    ],
    titleChainEvents: [
        {
            eventId: "tc_event_0_mock",
            order: 0,
            date: "2005-03-15",
            documentType: "Sale Deed (Mock)",
            transferor: "Original Allotment Authority / John Doe Sr.",
            transferee: "Jane Smith",
            propertyDescription: "Plot A, Riverview Estates",
            summaryOfTransaction: "Initial purchase or allotment of Plot A to Jane Smith.",
            relatedDocumentId: undefined,
        },
        {
            eventId: "tc_event_1_mock",
            order: 1,
            date: "2010-07-20",
            documentType: "Mortgage Deed (Mock)",
            transferor: "Jane Smith (Mortgagor)",
            transferee: "Anytown Bank (Mortgagee)",
            propertyDescription: "Plot A, Riverview Estates",
            summaryOfTransaction: "Jane Smith created a mortgage on Plot A in favor of Anytown Bank for a loan of $50,000.",
            relatedDocumentId: undefined, 
        },
        {
            eventId: "tc_event_2_mock",
            order: 2,
            date: "2023-10-26",
            documentType: "Sale Deed (Mock)", // This event leads to the Sale Deed processed
            transferor: "Jane Smith (Previous Owner, presumably cleared mortgage or bank consent obtained)", // Changed to demonstrate a chain leading to Mockington
            transferee: "Mr. Samuel Mockington",
            propertyDescription: "Plot A, Riverview Estates",
            summaryOfTransaction: "Sale of Plot A from Jane Smith to Mr. Samuel Mockington. This transaction corresponds to the processed Sale Deed where Mr. Mockington is now the seller.",
            // relatedDocumentId: "mock_doc_file0_idx0_saledeed" // If Mr. Mockington bought via this deed, and then sells it.
        }
    ],
    redFlags: [
        {
            redFlagId: "rf_mock_0",
            description: "The name of the seller in the Sale Deed (mock_doc_file0_idx0_saledeed) is 'Mr. Samuel Mockington', but a title chain event (tc_event_1_mock) shows a mortgage by 'Jane Smith' on the same property. While tc_event_2_mock shows Jane Smith selling to Samuel Mockington, ensure the mortgage from tc_event_1_mock was properly discharged or consented to by Anytown Bank before or during the sale from Jane Smith to Samuel Mockington.",
            severity: 'Medium',
            suggestion: "Verify if the mortgage by Jane Smith to Anytown Bank (ref tc_event_1_mock) has been fully discharged. Look for a Deed of Release or No Objection Certificate from Anytown Bank. Confirm no outstanding liabilities from this mortgage affect Mr. Mockington's title or Ms. Testington's subsequent purchase.",
            relatedDocumentIds: ["mock_doc_file0_idx0_saledeed"]
        },
        {
            redFlagId: "rf_mock_1",
            description: "The property tax receipt (mock_doc_file0_idx3_receipt) is in the name of Ms. Eleanor Buyer Testington for the fiscal year 2022-2023, while the sale deed to her is dated October 26, 2023. This implies she paid taxes before legally owning the property or there's a reconciliation needed for pre-ownership period taxes.",
            severity: 'Low',
            suggestion: "Clarify who was responsible for property taxes for the period prior to Ms. Testington's ownership (October 26, 2023) within the 2022-2023 fiscal year. Ensure any pro-rata tax adjustments between seller and buyer are accounted for as per the sale agreement (if mentioned).",
            relatedDocumentIds: ["mock_doc_file0_idx0_saledeed", "mock_doc_file0_idx3_receipt"]
        },
        {
            redFlagId: "rf_mock_2",
            description: "One document section (mock_doc_file1_idx2_unsupported) from the second file was unsupported due to poor scan quality. This page might contain critical information.",
            severity: 'High',
            suggestion: "Attempt to obtain a clearer copy of page 3 from 'mockFile2.pdf'. The illegible content could be crucial for understanding the full context or terms related to other documents from this file.",
            relatedDocumentIds: ["mock_doc_file1_idx2_unsupported"]
        }
    ],
    unsupportedPages: [
      { sourceFileName: mainFileName, pageNumberInSourceFile: "5", reason: "The page is entirely blank and does not appear to be part of any document structure (mock)." },
      { sourceFileName: secondFileName, pageNumberInSourceFile: "4", reason: "This page contains only a photograph with no discernible text or document-related information (mock)." }
    ],
  };
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
