
// utils/pdfUtils.ts

/**
 * Parses a string reference like "Page 5" or "Pages 3-7" or "5" and returns the starting page number.
 * Defaults to 1 if parsing fails or input is undefined.
 * @param pageRef The string reference for the page or page range.
 * @returns The starting page number (at least 1).
 */
export const parseStartPage = (pageRef?: string): number => {
  if (!pageRef) return 1;
  
  // Try to match "Page X", "Pages X-Y", or just "X"
  const match = pageRef.toString().match(/(\d+)/); 
  
  if (match && match[1]) {
    const page = parseInt(match[1], 10);
    return Math.max(1, page); // Ensure page number is at least 1
  }
  
  return 1; // Default to page 1 if parsing fails
};
