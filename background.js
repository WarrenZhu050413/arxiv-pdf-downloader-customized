importScripts('background_utils.js', 'background_handlers.js');

// --- Global Variables & Constants ---
let lastDownload = { url: '', time: 0 };
const download_interval = 1000; // Milliseconds interval to prevent duplicate downloads
let isPopupOpen = false; // Simpler approach to track popup state
let lastPopupAction = { action: null, time: 0 }; // Track last popup action for debouncing
const POPUP_ACTION_DEBOUNCE = 1000; // 1000ms debounce for popup actions

// --- Site Handlers Configuration ---
// This array uses the handler functions defined in handlers.js
const siteHandlers = [
    { pattern: /https:\/\/arxiv.org\/abs\/(\S+)/, handler: handleArxivAbstract, name: 'arXiv Abstract' },
    { pattern: /https:\/\/dl.acm.org\/doi\/(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i, handler: handleAcmAbstract, name: 'ACM Abstract' },
    { pattern: /https:\/\/arxiv.org\/pdf\/(\S+)/, handler: handleArxivPdf, name: 'arXiv PDF' },
    { pattern: /https:\/\/dl.acm.org\/doi\/pdf\/(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i, handler: handleAcmPdf, name: 'ACM PDF' },
    // Updated Usenix patterns to allow hyphens in the author part
    { pattern: /https:\/\/www.usenix.org\/system\/files\/([\w\d]+)-([\w\d-]+)\.pdf/i, handler: handleUsenixPdf, name: 'Usenix PDF' },
    { pattern: /https:\/\/www.usenix.org\/conference\/([\w\d]+)\/presentation\/([\w\d-]+)/i, handler: handleUsenixPresentation, name: 'Usenix Presentation' }
];

// --- Core Logic Functions ---

// Determines the PDF URL, title, and identifier based on the tab's URL.
// Returns [filePdfUrl, title, identifier, idType] or null
const getUrlAndName = async (tab) => {
    const url = String(tab.url);
    console.log("Processing URL:", url);

    for (const site of siteHandlers) {
        const match = url.match(site.pattern);
        if (match) {
            console.log(`Matched pattern for ${site.name}`);
            try {
                // Await the result from the specific handler (defined in handlers.js)
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

// --- Helper function to close popup ---
function closePopup() {
    console.log("Attempting to close popup from background script");
    
    // Method 1: Send message to popup
    chrome.runtime.sendMessage({ action: 'closePopup' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log("No popup to receive message or error:", chrome.runtime.lastError);
            // Popup might not be open, which is fine
        } else {
            console.log("Popup received close message:", response);
        }
    });
    
    // Method 2: Unfocus the popup window which causes most popups to close
    try {
        chrome.windows.getCurrent(windowInfo => {
            if (windowInfo) {
                chrome.windows.update(windowInfo.id, { focused: false });
            }
        });
    } catch (e) {
        console.error("Error trying to unfocus popup:", e);
    }
}

// --- Enhanced forceful popup closing ---
function forceClosePopup() {
    console.log("Force closing popup from background script");
    
    // Track this popup action for debouncing
    lastPopupAction = { action: 'close', time: Date.now() };
    
    // Method 1: Send force close message to popup
    chrome.runtime.sendMessage({ action: 'forceClosePopup' }, (response) => {
        // Ignore errors since popup might already be closed
        if (chrome.runtime.lastError) {
            console.log("No popup to receive force close message:", chrome.runtime.lastError);
        }
    });
    
    // Method 2: Reset popup URL to force close
    try {
        chrome.action.setPopup({ popup: '' });
        setTimeout(() => {
            chrome.action.setPopup({ popup: 'popup.html' });
        }, 100);
    } catch (e) {
        console.error("Error resetting popup URL:", e);
    }
    
    // Method 3: Try to find and close popup window
    try {
        chrome.windows.getAll({ populate: true }, (windows) => {
            for (const window of windows) {
                // Look for popup windows
                if (window.type === 'popup') {
                    chrome.windows.remove(window.id, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error closing popup window:", chrome.runtime.lastError);
                        }
                    });
                }
            }
        });
    } catch (e) {
        console.error("Error finding popup windows:", e);
    }
}

// Add function to handle popup toggle directly
async function togglePopup() {
    console.log("Toggle popup command received");
    try {
        // Check for any existing popups
        const popupWindows = await new Promise(resolve => {
            chrome.windows.getAll({ windowTypes: ['popup'] }, windows => resolve(windows || []));
        });
        
        // If popups exist, close them
        if (popupWindows.length > 0) {
            console.log("Toggling: Found and closing existing popups:", popupWindows.length);
            
            for (const popup of popupWindows) {
                await new Promise(resolve => {
                    chrome.windows.remove(popup.id, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error closing popup:", chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            }
            
            // Set last action to close
            lastPopupAction = { action: 'close', time: Date.now() };
            return true; // Indicate we closed popups
        } 
        // Otherwise, open a popup
        else {
            console.log("Toggling: No popups found, opening one");
            
            // Set last action to open
            lastPopupAction = { action: 'open', time: Date.now() };
            
            // Check if we have an active tab
            const tabs = await new Promise(resolve => {
                chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs || []));
            });
            
            if (tabs.length === 0) {
                console.error("No active tabs found, cannot open popup");
                return false;
            }
            
            // Open the popup
            await openExtensionPopup();
            return true;
        }
    } catch (error) {
        console.error("Error toggling popup:", error);
        return false;
    }
}

// --- Event Listeners ---

// Add listener for forceClosePopup message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'forceClosePopup') {
        console.log("Received forceClosePopup message from popup");
        forceClosePopup();
        sendResponse({ success: true });
    }
    // Return true to indicate async response
    return true;
});

chrome.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);

    // Handle popup opening command for settings
    if (command === "open_popup") {
        // Use the toggle function directly
        await togglePopup();
        return;
    }

    // Handle SavePaperWithCustomTitle toggling behavior - improved for lower latency
    if (command === "SavePaperWithCustomTitle") {
        console.log("SavePaperWithCustomTitle command received");
        
        // First check if customTitleData exists - quick check to determine state
        const result = await chrome.storage.local.get(['customTitleData']);
        
        if (result.customTitleData && result.customTitleData.isCustomTitleFlow) {
            // Already in custom title mode, so clear it and force close popup
            console.log("Exiting custom title mode");
            await chrome.storage.local.remove('customTitleData');
            forceClosePopup(); // Use enhanced force close for more reliability
            return;
        }
            
        // Not in custom title mode, proceed with normal custom title flow
        // First open popup immediately to reduce perceived latency
        openExtensionPopup();
        
        // Then load data in parallel
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
                console.error("Error getting current tab:", chrome.runtime.lastError || "No active tab found.");
                showNotification('FAILURE', 'Could not get current tab information.', 'failure'); // From utils.js
                return;
            }
            
            let tab = tabs[0];
            const now = Date.now();

            // Debounce check
            if (lastDownload.url === tab.url && now - lastDownload.time < download_interval) {
                 console.log('Skipping duplicate download request for URL:', tab.url);
                 showNotification('INFO', 'Skipping duplicate download request for URL: ' + tab.url, 'info'); // From utils.js
                 return;
            }
            lastDownload = { url: tab.url, time: now }; // Update last download attempt info

            try {
                // Get paper details using the refactored function
                const urlResult = await getUrlAndName(tab);
                if (!urlResult) {
                    showNotification('INFO', 'Current page is not a supported paper page.', 'info'); // From utils.js
                    closePopup(); // Close popup if we couldn't get URL data
                    return;
                }

                const [filepdf_url, title, identifier, idType] = urlResult;

                if (!filepdf_url || !identifier) { // Title can be null, but need URL and identifier
                     showNotification('FAILURE', "Could not determine PDF URL or identifier.", 'failure'); // From utils.js
                     console.error("getUrlAndName returned invalid data:", urlResult);
                     closePopup(); // Close popup if data is invalid
                     return;
                }

                console.log("Initiating custom title flow...");
                const customTitleData = {
                    isCustomTitleFlow: true,
                    pdfUrl: filepdf_url,
                    originalTitle: title,
                    identifier: identifier,
                    idType: idType
                };
                
                // Store the data for the already-open popup
                chrome.storage.local.set({ customTitleData: customTitleData }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving custom title data:", chrome.runtime.lastError);
                        showNotification('FAILURE', 'Failed to initiate custom title save.', 'failure'); // From utils.js
                        closePopup(); // Close popup if we couldn't save data
                    }
                });
            } catch (error) {
                 console.error('Error processing command:', error);
                 showNotification('FAILURE', `Error processing command: ${error.message || 'Unknown error'}`, 'failure'); // From utils.js
                 closePopup(); // Close popup on error
            }
        });
    }

    // Handle paper saving command
    if (command === "SavePaper") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
                console.error("Error getting current tab:", chrome.runtime.lastError || "No active tab found.");
                showNotification('FAILURE', 'Could not get current tab information.', 'failure'); // From utils.js
                return;
            }
            let tab = tabs[0];
            const now = Date.now();

            // Debounce check
            if (lastDownload.url === tab.url && now - lastDownload.time < download_interval) {
                 console.log('Skipping duplicate download request for URL:', tab.url);
                 showNotification('INFO', 'Skipping duplicate download request for URL: ' + tab.url, 'info'); // From utils.js
                 return;
            }
             lastDownload = { url: tab.url, time: now }; // Update last download attempt info

            console.log('Selected tab URL:', tab.url);

            try {
                // Get paper details using the refactored function
                const urlResult = await getUrlAndName(tab);
                if (!urlResult) {
                    showNotification('INFO', 'Current page is not a supported paper page.', 'info'); // From utils.js
                    return;
                }

                const [filepdf_url, title, identifier, idType] = urlResult;

                if (!filepdf_url || !identifier) { // Title can be null, but need URL and identifier
                     showNotification('FAILURE', "Could not determine PDF URL or identifier.", 'failure'); // From utils.js
                     console.error("getUrlAndName returned invalid data:", urlResult);
                     return;
                }

                const save_filename = constructFilename(title, identifier, identifier, idType); // From utils.js
                const fileInfo = { path: filepdf_url, name: save_filename };
                console.log('Attempting standard download:', fileInfo);
                showNotification('INFO', 'Saving: ' + fileInfo.name, 'info'); // From utils.js

                chrome.storage.sync.get(['driveFolderPath'], async (storageResult) => {
                    if (chrome.runtime.lastError) {
                         console.error("Error retrieving folder path:", chrome.runtime.lastError);
                         showNotification('FAILURE', 'Could not read extension settings.', 'failure'); // From utils.js
                         return;
                    }
                    const folderPath = storageResult.driveFolderPath || 'papers';
                    console.log(`Using Google Drive path: '${folderPath}'`);
                    await uploadToDrive(fileInfo, folderPath); // From utils.js
                });

            } catch (error) {
                 console.error('Error processing command:', error);
                 showNotification('FAILURE', `Error processing command: ${error.message || 'Unknown error'}`, 'failure'); // From utils.js
            }
        });
    } else {
        console.warn("Unrecognized command received:", command);
    }
});

// Listener for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'uploadCustomTitle') {
        console.log('Received upload request from popup:', message.data);
        const { customTitle, originalData } = message.data;
        const { pdfUrl, identifier, idType } = originalData;

        if (!pdfUrl || !identifier || !customTitle) {
             console.error("Invalid data received for custom upload:", message.data);
             sendResponse({ success: false, message: 'Missing required data for custom save.' });
             return true;
        }

        const saveFilename = constructFilename(customTitle, identifier, identifier, idType); // From utils.js
        const fileInfo = { path: pdfUrl, name: saveFilename };

        chrome.storage.sync.get(['driveFolderPath'], async (storageResult) => {
            if (chrome.runtime.lastError) {
                 console.error("Error retrieving folder path:", chrome.runtime.lastError);
                 sendResponse({ success: false, message: 'Could not read extension settings for custom save.' });
                 return;
            }
            const folderPath = storageResult.driveFolderPath || 'papers';
            console.log(`Uploading custom title file '${saveFilename}' to path: '${folderPath}'`);
            const uploadResult = await uploadToDrive(fileInfo, folderPath); // From utils.js
            sendResponse(uploadResult);
        });

        return true; // Indicate asynchronous response
    }

    console.warn("Received unknown message action:", message.action);
    return false; // Indicate synchronous response or no response for other messages
});


console.log('Background script loaded. Imported utils.js and handlers.js');