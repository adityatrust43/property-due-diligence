const getBatchPrompt = (fileName, startPage, batchSize) => `
You are an expert at analyzing document images. You will be provided with ${batchSize} images from the document "${fileName}".
These images correspond to pages ${startPage} through ${startPage + batchSize - 1}.
For each image, perform two tasks:
1.  **Text Extraction**: Transcribe all text content from the image.
2.  **Visual Description**: Provide a detailed description of the page's visual elements. This includes layout, presence of stamps, signatures, photos of people, tables, handwriting, or any other non-textual elements. For example: "The page appears to be a legal document with a government stamp in the top left corner, two columns of text, and three signatures at the bottom. There is a passport-sized photo of a person on the right."

Your response must be a single JSON array, containing one object for each page in the batch.
Each object must have a "page" number, its "content" (the text transcript), and a "visualDescription".
- If a page has text or visual elements, use the format: \`{"page": <number>, "content": "...", "visualDescription": "..."}\`
- If a page is completely blank, use: \`{"page": <number>, "content": "blank", "visualDescription": "blank"}\`

Example for a batch starting at page 11 with 2 images:
\`\`\`json
[
  {"page": 11, "content": "Text from page 11...", "visualDescription": "A legal document with a stamp and two signatures."},
  {"page": 12, "content": "blank", "visualDescription": "blank"}
]
\`\`\`
CRITICAL: Respond ONLY with the JSON array, enclosed in markdown backticks if necessary. Do not include any other text or explanations.
`;

const getSynthesisPrompt = (task, fileName, fullText) => `
You are an expert AI assistant for legal and property document analysis.
The user has provided the full text and a visual description for each page of a document named "${fileName}".
The full text and descriptions are provided below:
---
${fullText}
---
Your task is to perform ONLY the following analysis: ${task}.
Use both the transcribed text and the visual descriptions to inform your analysis. For example, a description of a "government stamp" or "multiple signatures" can provide important context.
For each item you identify (like a title event or a red flag), you MUST include the \`startPage\` number from which the information was derived.
ABSOLUTELY CRITICAL: Your entire response MUST be a single, valid JSON object. Do not include any introductory text, markdown formatting, code block markers, or any text whatsoever before the opening brace or after the closing brace. Your response must be immediately parsable by JSON.parse().
`;

const prompts = {
    propertySummary: `
        Generate a \`propertySummary\` object.
        - Determine the \`currentOwner\`. This should be the name of the individual or entity that currently owns the property based on the latest transaction document.
        - Provide a concise, one-paragraph \`propertyBrief\` that MUST include the property's size, area, specific location, and full address.
        - CRITICAL: The output for this task MUST be a JSON object with the exact following structure: \`{"propertySummary": {"currentOwner": "...", "propertyBrief": "..."}}\`. Do not add any other keys or properties.
    `,
    titleChain: `
        Generate a \`titleChainEvents\` array.
        - Identify ONLY documents that represent a transfer of ownership or title (e.g., Sale Deed, Gift Deed, Partition Deed, Release Deed). Exclude documents like mortgage deeds or agreements that do not transfer the title.
        - For each ownership transfer event, extract: \`eventId\`, \`order\` (chronological, starting from 0), \`date\` of the transaction, \`documentType\`, \`transferor\` (seller/donor), \`transferee\` (buyer/donee), a detailed \`summaryOfTransaction\`, the \`startPage\`, and the \`sourceFileName\`.
        - Order the events strictly from the oldest to the newest to show the clear history of the title.
        - CRITICAL: The output for this task MUST be a JSON object with the exact following structure: \`{"titleChainEvents": [{"eventId": "...", "order": 0, "date": "...", "documentType": "...", "transferor": "...", "transferee": "...", "summaryOfTransaction": "...", "startPage": 1, "sourceFileName": "..."}]}\`. Do not add any other keys or properties.
    `,
    documentDetails: `
        Generate a \`processedDocuments\` array, ordered chronologically from oldest to newest.
        - For each distinct document within the file, determine its \`documentType\`, \`sourceFileName\`, and the \`startPage\`.
        - Provide a comprehensive \`summary\` that narrates the document's story and extracts all specific details: names of all parties, all relevant dates, property measurements, monetary amounts, registration numbers, and any other specific identifiers. Use markdown tables for structured data where appropriate within the summary.
        - Extract the primary \`date\` of the document and all \`partiesInvolved\`.
        - Assign a unique \`documentId\`.
        - CRITICAL: The output for this task MUST be a JSON object with the exact following structure: \`{"processedDocuments": [{"documentId": "...", "documentType": "...", "date": "...", "partiesInvolved": [], "summary": "...", "startPage": 1, "sourceFileName": "..."}]}\`. Do not add any other keys or properties.
    `,
    redFlags: `
        Generate a \`redFlags\` array.
        - Identify potential issues, risks, or inconsistencies that a lawyer should be aware of.
        - For each red flag, provide: \`redFlagId\`, a clear \`description\` of the issue, a \`severity\`, an actionable \`suggestion\`, and the \`startPage\`.
        - Set \`severity\` to 'High' ONLY if you are highly certain that the issue represents a serious legal problem or a major risk (e.g., a clear break in the title chain, an active lien or mortgage that is not discharged). Use 'Medium' for potential issues that require further investigation and 'Low' for minor discrepancies.
        - Examples of red flags: Discrepancies in names or dates across documents, gaps in the title chain, undischarged mortgages, unclear property descriptions.
        - CRITICAL: The output for this task MUST be a JSON object with the exact following structure: \`{"redFlags": [{"redFlagId": "...", "description": "...", "severity": "...", "suggestion": "...", "startPage": 1}]}\`. Do not add any other keys or properties.
    `
};

module.exports = {
    getBatchPrompt,
    getSynthesisPrompt,
    prompts
};
