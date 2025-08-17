const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractJson = (text, isArray = false) => {
    let cleanedText = text.trim();

    // Remove markdown code block fences and other non-JSON text
    const markdownMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        cleanedText = markdownMatch[1].trim();
    }

    // Fix common JSON issues
    cleanedText = cleanedText
        .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\') // Fix unescaped backslashes
        .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

    const startChar = isArray ? '[' : '{';
    const endChar = isArray ? ']' : '}';
    let startIndex = cleanedText.indexOf(startChar);

    if (startIndex === -1) {
        throw new Error(`No valid JSON ${isArray ? 'array' : 'object'} start character found.`);
    }

    let openCount = 0;
    for (let i = startIndex; i < cleanedText.length; i++) {
        if (cleanedText[i] === startChar) {
            openCount++;
        } else if (cleanedText[i] === endChar) {
            openCount--;
        }

        if (openCount === 0) {
            const potentialJson = cleanedText.substring(startIndex, i + 1);
            try {
                JSON.parse(potentialJson);
                return potentialJson; // Return the first valid JSON object/array
            } catch (e) {
                // Continue searching if the substring is not valid JSON
            }
        }
    }

    throw new Error(`Could not find a complete and valid JSON ${isArray ? 'array' : 'object'}.`);
};

module.exports = {
    delay,
    extractJson
};
