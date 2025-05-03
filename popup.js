// papers-to-GDrive/popup.js

// --- Global Constants & DOM References ---
const MAX_HISTORY = 100;
const DEFAULT_PATH = 'papers';

const folderPathInput = document.getElementById('folderPathInput');
const saveButton = document.getElementById('savePathButton');
const statusDiv = document.getElementById('status');
const pastPathsDatalist = document.getElementById('pastPaths');
const customTitleSection = document.getElementById('customTitleSection');
const settingsSection = document.getElementById('settingsSection');
const customTitleInput = document.getElementById('customTitleInput');
const saveCustomTitleButton = document.getElementById('saveCustomTitleButton');
const customTitleStatus = document.getElementById('customTitleStatus');

// --- Core Logic Functions ---

// --- Function to handle saving the path ---
function savePath() {
    const rawInputPath = folderPathInput.value.trim();
    const currentPathToSave = rawInputPath === '' ? DEFAULT_PATH : rawInputPath.replace(/^\/+|\/+$/g, '');

    if (rawInputPath === '') {
        folderPathInput.value = DEFAULT_PATH;
    }

    chrome.storage.sync.get(['driveFolderPathHistory'], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving history:", chrome.runtime.lastError);
            // Use showStatus from popup_utils.js
            showStatus(statusDiv, customTitleStatus, 'Error saving (could not get history).', 'red', 0, false);
            return;
        }

        let history = result.driveFolderPathHistory || [];
        history = history.filter(p => p !== currentPathToSave);
        history.unshift(currentPathToSave);
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        chrome.storage.sync.set({
            driveFolderPath: currentPathToSave,
            driveFolderPathHistory: history
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving settings:", chrome.runtime.lastError);
                // Use showStatus from popup_utils.js
                showStatus(statusDiv, customTitleStatus, 'Error saving settings.', 'red', 0, false);
            } else {
                console.log('Settings saved:', { path: currentPathToSave, history });
                const message = rawInputPath === '' ? `Path reset to default "${DEFAULT_PATH}".` : 'Folder path saved!';
                const color = rawInputPath === '' ? 'orange' : 'green';
                 // Use showStatus from popup_utils.js
                showStatus(statusDiv, customTitleStatus, message, color, 1500, false);
                 // Use updateUI from popup_utils.js
                updateUI(folderPathInput, pastPathsDatalist, currentPathToSave, history, DEFAULT_PATH);
                setTimeout(() => window.close(), 500);
            }
        });
    });
}

// --- Function to handle saving with custom title ---
async function saveCustomTitle(customTitleData) {
    const customTitle = customTitleInput.value.trim();
    if (!customTitle) {
         // Use showStatus from popup_utils.js
        showStatus(statusDiv, customTitleStatus, 'Please enter a title.', 'red', 3000, true);
        customTitleInput.focus();
        return;
    }

    const dataToSend = {
        customTitle: customTitle,
        originalData: {
            pdfUrl: customTitleData.pdfUrl,
            identifier: customTitleData.identifier,
            idType: customTitleData.idType
        }
    };

    console.log('Sending message to background:', dataToSend);
     // Use showStatus from popup_utils.js
    showStatus(statusDiv, customTitleStatus, 'Saving...', 'blue', 0, true);
    saveCustomTitleButton.disabled = true;
    customTitleInput.disabled = true;

    chrome.runtime.sendMessage({ action: 'uploadCustomTitle', data: dataToSend }, (response) => {
        saveCustomTitleButton.disabled = false;
        customTitleInput.disabled = false;

        chrome.storage.local.remove('customTitleData', () => {
            if(chrome.runtime.lastError){
                 console.error("Error clearing custom title data:", chrome.runtime.lastError);
            }
        });

        if (chrome.runtime.lastError) {
            console.error("Error receiving response from background:", chrome.runtime.lastError);
             // Use showStatus from popup_utils.js
            showStatus(statusDiv, customTitleStatus, `Error: ${chrome.runtime.lastError.message || 'Unknown communication error.'}`, 'red', 0, true);
        } else if (response && response.success) {
             console.log("Received success response from background.");
              // Use showStatus from popup_utils.js
             showStatus(statusDiv, customTitleStatus, 'Saved successfully!', 'green', 1500, true);
             setTimeout(() => window.close(), 1500);
        } else {
             console.error("Received failure response from background:", response);
             const errorMsg = (response && response.message) ? response.message : 'Upload failed.';
              // Use showStatus from popup_utils.js
             showStatus(statusDiv, customTitleStatus, errorMsg, 'red', 0, true);
             customTitleInput.focus();
        }
    });
}

// --- Load saved path and history ---
function loadSettings() {
    chrome.storage.sync.get(['driveFolderPath', 'driveFolderPathHistory'], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading settings:", chrome.runtime.lastError);
             // Use showStatus from popup_utils.js
            showStatus(statusDiv, customTitleStatus, 'Error loading settings.', 'red', 0, false);
        } else {
             // Use updateUI from popup_utils.js
            updateUI(folderPathInput, pastPathsDatalist, result.driveFolderPath, result.driveFolderPathHistory, DEFAULT_PATH);
            folderPathInput.focus();
            const textLength = folderPathInput.value.length;
            folderPathInput.setSelectionRange(textLength, textLength);
        }
    });
}

// --- Initialization & Event Listeners Setup ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup document loaded - setting up event listeners');
    
    // Enhanced force-close popup function
    function forceClosePopup() {
        console.log('Force closing popup with multiple methods');
        try {
            // First, notify background script that we're closing so it can track this action
            // This helps prevent the keyboard shortcut from immediately reopening
            chrome.runtime.sendMessage({ 
                action: 'forceClosePopup',
                source: 'popup_shortcut'  // Flag that this was initiated from the popup
            });
            
            // Method 1: Standard window.close()
            window.close();
            
            // Method 2: Force document unload
            document.body.innerHTML = '';
            window.location.href = 'about:blank';
            
            // Method 4: Self-destruct via reload
            setTimeout(() => {
                if (window) {
                    try {
                        window.location.reload();
                    } catch (e) {
                        console.error('Failed final close attempt:', e);
                    }
                }
            }, 50);
        } catch (e) {
            console.error('Error force closing popup:', e);
        }
    }

    // Add a special handler just for Command+Shift+P to ensure we catch it
    function handleCommandShiftP(event) {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && 
            (event.code === 'KeyP' || event.key === 'P' || event.key === 'p')) {
            console.log('GLOBAL Command+Shift+P detected, preventing default and force closing popup...');
            event.preventDefault();
            event.stopPropagation();
            forceClosePopup();
            return true;
        }
        return false;
    }

    // Enhanced keyboard shortcut detection - using keydown, keypress, and keyup for redundancy
    window.addEventListener('keydown', (event) => {
        console.log('Keydown event detected in popup:', event.key, event.code, 'Meta/Ctrl:', event.metaKey || event.ctrlKey, 'Shift:', event.shiftKey);
        handleCommandShiftP(event);
    }, true); // Use capture phase to get events early
    
    // Add keyup as a backup in case keydown doesn't work
    window.addEventListener('keyup', (event) => { 
        console.log('Keyup event detected in popup:', event.key, event.code);
        handleCommandShiftP(event);
    }, true);
    
    // Add keypress as a backup in case the other events don't work
    window.addEventListener('keypress', (event) => {
        console.log('Keypress event detected in popup:', event.key, event.code);
        handleCommandShiftP(event);
    }, true);
    
    // Add document level listeners as well
    document.addEventListener('keydown', (event) => {
        console.log('Document keydown in popup:', event.key, event.code);
        handleCommandShiftP(event);
    }, true);

    // Listen for close messages from the background script
    chrome.runtime.onMessage.addListener((message) => {
        console.log('Message received in popup:', message);
        if (message.action === 'closePopup' || message.action === 'forceClosePopup') {
            console.log('Received close popup message, force closing popup window');
            forceClosePopup();
        }
        // Always return true to indicate async handling
        return true;
    });

    // Check flow type (custom title vs settings)
    chrome.storage.local.get('customTitleData', (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error checking for custom title flow:", chrome.runtime.lastError);
             settingsSection.style.display = 'block';
             loadSettings();
            // Attach settings listeners only if settings are shown
            attachSettingsListeners();
            return;
        }

        const customTitleData = result.customTitleData;
        if (customTitleData && customTitleData.isCustomTitleFlow) {
            // Setup for Custom Title Mode
            console.log("Popup opened in custom title flow.", customTitleData);
            settingsSection.style.display = 'none';
            customTitleSection.style.display = 'block';
            customTitleInput.value = customTitleData.originalTitle || '';
            customTitleInput.focus();
            customTitleInput.select();
            attachCustomTitleListeners(customTitleData);
        } else {
            // Setup for Settings Mode
            console.log("Popup opened in standard settings mode.");
            customTitleSection.style.display = 'none';
            settingsSection.style.display = 'block';
            loadSettings();
            attachSettingsListeners();
        }
    });
});

// --- Listener Attachment Functions ---
function attachSettingsListeners() {
     saveButton.addEventListener('click', savePath);
     folderPathInput.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             event.preventDefault();
             savePath();
         }
     });
}

function attachCustomTitleListeners(customTitleData) {
     saveCustomTitleButton.addEventListener('click', () => saveCustomTitle(customTitleData));
     customTitleInput.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             event.preventDefault();
             saveCustomTitle(customTitleData);
         }
     });
}