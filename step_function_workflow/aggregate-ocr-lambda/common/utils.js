const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractJson = (text, isArray = false) => {
    // Clean the text to handle common AI-generated errors
    let cleanedText = text.trim();
    
    // Remove markdown code block fences if they exist
    const markdownMatch = cleanedText.match(/```json\n([\s\S]*?)\n```/);
    if (markdownMatch && markdownMatch[1]) {
        cleanedText = markdownMatch[1].trim();
    }

    // Fix unescaped backslashes that are not part of a valid escape sequence
    cleanedText = cleanedText.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

    // If not found or invalid, fall back to finding the first and last brace/bracket
    const startChar = isArray ? '[' : '{';
    const endChar = isArray ? ']' : '}';
    let startIndex = cleanedText.indexOf(startChar);
    let endIndex = cleanedText.lastIndexOf(endChar);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        let openCount = 0;
        let closeCount = 0;
        let lastValidEndIndex = -1;

        for (let i = startIndex; i < cleanedText.length; i++) {
            if (cleanedText[i] === startChar) openCount++;
            if (cleanedText[i] === endChar) closeCount++;

            if (openCount > 0 && openCount === closeCount) {
                lastValidEndIndex = i;
                // For arrays, we want the outermost complete array.
                // For objects, the first complete object is usually enough.
                if (!isArray) break;
            }
        }

        if (lastValidEndIndex !== -1) {
            const potentialJson = cleanedText.substring(startIndex, lastValidEndIndex + 1).trim();
            try {
                JSON.parse(potentialJson);
                return potentialJson;
            } catch (e) {
                // Fall through if this more precise substring is not valid JSON
            }
        }
        
        // As a last resort, use the simple lastIndexOf method
        const simplerSubstring = cleanedText.substring(startIndex, endIndex + 1).trim();
        try {
            JSON.parse(simplerSubstring);
            return simplerSubstring;
        } catch (e) {
            // The error from this attempt is likely the most relevant
            throw new Error(`Failed to parse extracted JSON: ${e.message}. Raw text: "${cleanedText}"`);
        }
    }

    throw new Error(`No valid JSON ${isArray ? 'array' : 'object'} found in the response.`);
};

module.exports = {
    delay,
    extractJson
};
