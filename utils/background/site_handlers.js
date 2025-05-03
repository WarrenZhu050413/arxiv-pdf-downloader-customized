import { fetchHtmlPageTitle, parseTitleAndIdentifier } from '../common/file_utils.js';

// --- Helper Function for Usenix PDF Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleUsenixPdf(url, match) {
    const conferencePart = match[1]; // e.g., "nsdi23"
    const authorPart = match[2]; // e.g., "liu-tianfeng"
    const filePdfUrl = url;
    const presentationUrl = `https://www.usenix.org/conference/${conferencePart}/presentation/${authorPart}`;
    console.log(`Fetching title from Usenix presentation page: ${presentationUrl}`);
    const rawTitle = await fetchHtmlPageTitle(presentationUrl);
    const parsedResult = parseTitleAndIdentifier(rawTitle); // { title, identifier: null }
    const usenixIdentifier = `${conferencePart}_${authorPart}`; // Construct the identifier
    console.log(`Usenix PDF Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${usenixIdentifier}`);
    return [filePdfUrl, parsedResult.title, usenixIdentifier, 'Usenix'];
}

// --- Helper Function for Usenix Presentation Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleUsenixPresentation(url, match) {
    const conferencePart = match[1]; // e.g., "nsdi23"
    const authorPart = match[2]; // e.g., "liu-tianfeng"
    const filePdfUrl = `https://www.usenix.org/system/files/${conferencePart}-${authorPart}.pdf`;
    console.log(`Fetching title from Usenix presentation page: ${url}`);
    const rawTitle = await fetchHtmlPageTitle(url); // Title from the presentation page itself
    const parsedResult = parseTitleAndIdentifier(rawTitle); // { title, identifier: null }
    const usenixIdentifier = `${conferencePart}_${authorPart}`; // Construct the identifier
    console.log(`Usenix Presentation Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${usenixIdentifier}`);
    return [filePdfUrl, parsedResult.title, usenixIdentifier, 'Usenix'];
}

// --- Helper Function for arXiv Abstract Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleArxivAbstract(url, match) {
    const paperId = match[1];
    const filePdfUrl = `https://arxiv.org/pdf/${paperId}.pdf`;
    console.log(`Fetching title from arXiv abstract page: ${url}`);
    const rawTitle = await fetchHtmlPageTitle(url);
    const parsedResult = parseTitleAndIdentifier(rawTitle); // { title, identifier }
    const finalIdentifier = parsedResult.identifier || paperId; // Use parsed arXiv ID if available
    console.log(`arXiv Abstract Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${finalIdentifier}`);
    return [filePdfUrl, parsedResult.title, finalIdentifier, 'arXiv'];
}

// --- Helper Function for ACM Abstract Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleAcmAbstract(url, match) {
    const doiPart = match[1];
    const filePdfUrl = `https://dl.acm.org/doi/pdf/${doiPart}`;
    console.log(`Fetching title from ACM abstract page: ${url}`);
    const rawTitle = await fetchHtmlPageTitle(url);
    const parsedResult = parseTitleAndIdentifier(rawTitle); // { title, identifier: null }
    console.log(`ACM Abstract Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${doiPart}`);
    return [filePdfUrl, parsedResult.title, doiPart, 'DOI'];
}

// --- Helper Function for arXiv PDF Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleArxivPdf(url, match) {
    const paperIdWithExt = match[1];
    const paperId = paperIdWithExt.replace(".pdf", "");
    const filePdfUrl = url;
    const absUrl = `https://arxiv.org/abs/${paperId}`;
    console.log(`Fetching title from corresponding arXiv abstract page: ${absUrl}`);
    const rawTitle = await fetchHtmlPageTitle(absUrl);
    const parsedResult = parseTitleAndIdentifier(rawTitle); // { title, identifier } from abstract page
    const finalIdentifier = parsedResult.identifier || paperId; // Use parsed arXiv ID if available
    console.log(`arXiv PDF Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${finalIdentifier}`);
    return [filePdfUrl, parsedResult.title, finalIdentifier, 'arXiv'];
}

// --- Helper Function for ACM PDF Page ---
// Input: URL object, regex match object
// Returns: Promise resolving to [pdfUrl, title, identifier, type] or null
export async function handleAcmPdf(url, match) {
    const doiPart = match[1];
    const filePdfUrl = url;
    let rawTitle = null;
    let parsedResult = { title: null, identifier: null }; // Default structure

    if (doiPart) {
        const landingPageUrl = `https://dl.acm.org/doi/${doiPart}`;
        console.log(`Fetching title from corresponding ACM abstract page: ${landingPageUrl}`);
        try {
            rawTitle = await fetchHtmlPageTitle(landingPageUrl);
            parsedResult = parseTitleAndIdentifier(rawTitle);
        } catch (error) {
            console.error("Error fetching title for ACM PDF, proceeding without title:", error);
        }
    } else {
         console.error("Could not extract DOI part from ACM PDF URL:", url);
    }
    console.log(`ACM PDF Handler: PDF URL=${filePdfUrl}, Title=${parsedResult.title}, Identifier=${doiPart}`);
    return [filePdfUrl, parsedResult.title, doiPart, 'DOI'];
}

// Configuration of site patterns and their handlers
export const siteHandlers = [
    { pattern: /https:\/\/arxiv.org\/abs\/(\S+)/, handler: handleArxivAbstract, name: 'arXiv Abstract' },
    { pattern: /https:\/\/dl.acm.org\/doi\/(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i, handler: handleAcmAbstract, name: 'ACM Abstract' },
    { pattern: /https:\/\/arxiv.org\/pdf\/(\S+)/, handler: handleArxivPdf, name: 'arXiv PDF' },
    { pattern: /https:\/\/dl.acm.org\/doi\/pdf\/(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i, handler: handleAcmPdf, name: 'ACM PDF' },
    // Updated Usenix patterns to allow hyphens in the author part
    { pattern: /https:\/\/www.usenix.org\/system\/files\/([\w\d]+)-([\w\d-]+)\.pdf/i, handler: handleUsenixPdf, name: 'Usenix PDF' },
    { pattern: /https:\/\/www.usenix.org\/conference\/([\w\d]+)\/presentation\/([\w\d-]+)/i, handler: handleUsenixPresentation, name: 'Usenix Presentation' }
];

// Determines the PDF URL, title, and identifier based on the tab's URL.
// Returns [filePdfUrl, title, identifier, idType] or null
export const getUrlAndName = async (tab) => {
    const url = String(tab.url);
    console.log("Processing URL:", url);

    for (const site of siteHandlers) {
        const match = url.match(site.pattern);
        if (match) {
            console.log(`Matched pattern for ${site.name}`);
            try {
                // Await the result from the specific handler
                const result = await site.handler(url, match);
                return result; // Return [filePdfUrl, title, identifier, idType]
            } catch (error) {
                 console.error(`Error in handler for ${site.name} (Pattern: ${site.pattern}):`, error);
                 return null; // Return null on handler error
            }
        }
    }

    // If no pattern matched
    console.log("Current page URL does not match any supported patterns.");
    return null;
}; 