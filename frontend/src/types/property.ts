export interface ProcessedDocument {
  documentId: string; // Unique ID, e.g., "doc_file0_0_saledeed"
  sourceFileName: string; // Name of the source PDF file
  originalImageIndex: number; // The 0-based index of the first image *in the combined image array* this document section appears in
  documentType: string; // e.g. Sale Deed, Mutation Record
  pageRangeInSourceFile?: string; // e.g., "Pages 1-5" (within its sourceFileName)
  summary: string; // AI-generated summary of this document section
  status: 'Processed' | 'Unsupported'; // Simplified status
  date?: string; // Optional: Date extracted from the document
  partiesInvolved?: string; // Optional: Main parties involved
  unsupportedReason?: string; // Optional: Reason if status is 'Unsupported'
}

export interface TitleChainEvent {
  eventId: string; // Unique ID for the event, e.g., "tc_event_0"
  order: number; // Sequential number for chronological ordering
  date: string; // Date of the event (e.g., "YYYY-MM-DD")
  documentType: string; // Type of document evidencing the event (e.g., "Sale Deed")
  transferor: string; // Party ceding rights (e.g., Seller, Mortgagor)
  transferee: string; // Party gaining rights (e.g., Buyer, Mortgagee)
  propertyDescription?: string; // Brief description of the property involved in this specific event
  summaryOfTransaction: string; // Concise summary of the transaction
  relatedDocumentId?: string; // Optional: documentId from ProcessedDocument if directly related
}

export interface RedFlagItem {
  redFlagId: string; // Unique ID for the red flag, e.g., "rf_0"
  description: string; // Detailed description of the potential red flag
  severity: 'Low' | 'Medium' | 'High'; // Severity level
  suggestion: string; // Suggested next steps or areas to investigate
  relatedDocumentIds?: string[]; // Optional: Array of documentIds from ProcessedDocument related to this flag
}

export interface DocumentAnalysisOutcome {
  inputFiles: { name: string; totalPages: number }[]; // Information about the input files
  processedDocuments: ProcessedDocument[]; // Array of indexed and summarized documents
  titleChainEvents?: TitleChainEvent[];
  redFlags?: RedFlagItem[]; // NEW: Array of potential red flags
  unsupportedPages: {
    sourceFileName: string;
    pageNumberInSourceFile: string; // Page number within the sourceFileName
    reason: string;
  }[];
}

// Represents a part of a multipart Gemini request (e.g. image or text)
export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string; // e.g., 'image/png' or 'image/jpeg'
    data: string; // base64 encoded string
  };
}

// Old types - Deprecated by the new focused functionality.
// export interface PropertyDetails { ... }
// export interface TitleTransferEvent { ... }
// export interface DocumentIndexItem { ... } // Replaced by ProcessedDocument
// export interface MissingDocumentItem { ... }
// export interface PotentialIssueItem { ... }
// export interface RecommendationItem { ... }
// export interface VisualConfirmationItem { ... }
// export interface AnalysisResult { ... } // Replaced by DocumentAnalysisOutcome

// Deprecated types that were used for older mock structure.
export interface DetectedDocument {
  id: string;
  pageRange: string;
  type: string;
  summary?: string;
  status: 'Found' | 'Needs manual review' | 'Unsupported';
  originalIndex: number;
}

export interface DocumentChecklistItem {
  documentName: string;
  status: 'Found' | 'Missing' | 'Not Applicable';
  details?: string;
}

// Old RedFlagItem, replaced by the new more detailed one.
// export interface RedFlagItem {
//   id: string;
//   description: string;
//   severity: 'Low' | 'Medium' | 'High';
//   relatedDocuments?: string[];
// }
