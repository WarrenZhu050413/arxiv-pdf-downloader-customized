// papers-to-GDrive/popup.js
import { initializePopup, handleCommandShiftP } from './utils/popup/popup_handlers.js';

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
    
    // Enhanced keyboard shortcut detection - using multiple event types for redundancy
    window.addEventListener('keydown', handleCommandShiftP, true); // Use capture phase to get events early
    window.addEventListener('keyup', handleCommandShiftP, true);
    window.addEventListener('keypress', handleCommandShiftP, true);
    document.addEventListener('keydown', handleCommandShiftP, true);

    // Listen for close messages from the background script
    chrome.runtime.onMessage.addListener((message) => {
        console.log('Message received in popup:', message);
        if (message.action === 'closePopup' || message.action === 'forceClosePopup') {
            console.log('Received close popup message, force closing popup window');
            import('./utils/popup/popup_handlers.js').then(module => {
                module.forceClosePopup();
            });
        }
        // Always return true to indicate async handling
        return true;
    });

    // Initialize popup based on mode
    initializePopup(
        settingsSection,
        customTitleSection,
        customTitleInput,
        folderPathInput,
        pastPathsDatalist,
        statusDiv,
        customTitleStatus,
        saveButton,
        saveCustomTitleButton
    );
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