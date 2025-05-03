// file_utils.js

// Fetches the HTML title from a given URL
export const fetchHtmlPageTitle = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const text = await response.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/);
        if (!titleMatch || titleMatch.length < 2) throw new Error('Title not found in page');

        // Basic cleaning of title for filename safety
        const rawTitle = titleMatch[1].replace(/<("[^"]*"|'[^\']*'|[^'">])*>/g, '');
        const safeTitle = rawTitle.replace(/[\/?%*:|"<>]/g, '-'); // Replace invalid filename chars
        return safeTitle;
    } catch (error) {
        console.error('Error fetching title from page:', url, error);
        return null;
    }
};

// Parses a raw title string to separate known identifiers (e.g., arXiv)
export function parseTitleAndIdentifier(rawTitleString) {
    if (!rawTitleString) {
        return { title: null, identifier: null };
    }
    console.log("Raw title input for parsing:", rawTitleString);

    let title = rawTitleString;
    let identifier = null;

    const arxivIdPattern = /^\s*\[([^\]]+)\]\s*/; // Allow leading space before bracket
    const arxivMatch = title.match(arxivIdPattern);
    if (arxivMatch) {
        identifier = arxivMatch[1]; // Capture the ID
        title = title.substring(arxivMatch[0].length).trim(); // Remove ID from title
        console.log(`Parsed arXiv identifier: ${identifier}`);
    }

    // Sanitize the remaining title part for filename use
    const safeTitle = title.replace(/[\/?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();

    // Return null title if it became empty after removing ID and sanitizing
    return {
        title: safeTitle || null, // Return the cleaned title part
        identifier: identifier // Return extracted identifier (null if none found)
    };
}

// Constructs filename using title, identifier, and a fallback ID
export function constructFilename(title, identifier, fallbackId, idType = 'unknown') {
    let saveFilename;
    const safeFallbackId = fallbackId ? String(fallbackId).replace(/[\\/?%*:|"<>]/g, '_') : 'unknown';
    const identifierToUse = identifier || safeFallbackId;
    const safeIdentifierToAppend = String(identifierToUse).replace(/[\\/?%*:|"<>]/g, '_');
    const safeTitle = title ? title.replace(/[\\/?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim() : null;

    if (safeTitle) {
        saveFilename = `${safeTitle} [${safeIdentifierToAppend}].pdf`;
    } else {
        console.warn(`Using fallback filename based on ${idType} ID: ${safeIdentifierToAppend}`);
        saveFilename = `${safeIdentifierToAppend}.pdf`;
    }
    return saveFilename;
} 