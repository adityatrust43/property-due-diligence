const extractJson = (text, isArray = true) => {
    const startMarker = isArray ? '[' : '{';
    const endMarker = isArray ? ']' : '}';
    let startIndex = text.indexOf(startMarker);
    let endIndex = text.lastIndexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find JSON start or end markers in the text:", text);
        throw new Error("Invalid response format: No JSON object or array found.");
    }

    // Refine the search for the first '{' if the array marker isn't found initially.
    if (isArray && text.indexOf('[') === -1) {
        startIndex = text.indexOf('{');
        if (startIndex !== -1) {
            // If we found a '{', assume it's an array of one object and wrap it.
            const jsonText = text.substring(startIndex, endIndex + 1);
            return `[${jsonText}]`;
        }
    }
    
    return text.substring(startIndex, endIndex + 1);
};

module.exports = {
    extractJson
};
