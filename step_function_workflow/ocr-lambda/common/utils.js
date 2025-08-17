const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractJson = (text, isArray = false) => {
    // First, try to find JSON within markdown code blocks
    const markdownMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }

    // If not found, fall back to finding the first and last brace/bracket
    const startChar = isArray ? '[' : '{';
    const endChar = isArray ? ']' : '}';
    const startIndex = text.indexOf(startChar);
    const endIndex = text.lastIndexOf(endChar);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return text.substring(startIndex, endIndex + 1).trim();
    }

    throw new Error(`No valid JSON ${isArray ? 'array' : 'object'} found in the response.`);
};

module.exports = {
    delay,
    extractJson
};
