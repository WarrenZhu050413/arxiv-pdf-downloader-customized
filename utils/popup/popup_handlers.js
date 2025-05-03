// popup_handlers.js
import { showStatus, updateUI } from '../common/notification_utils.js';
import { stateManager } from '../common/storage_utils.js';
import { errorHandler } from '../common/error_utils.js';

// --- Global Constants ---
export const MAX_HISTORY = 100;
export const DEFAULT_PATH = 'papers';

// --- Core Logic Functions ---

// --- Function to handle saving the path ---
export async function savePath(folderPathInput, statusDiv, customTitleStatus) {
    const rawInputPath = folderPathInput.value.trim();
    const currentPathToSave = rawInputPath === '' ? DEFAULT_PATH : rawInputPath.replace(/^\/+|\/+$/g, '');

    if (rawInputPath === '') {
        folderPathInput.value = DEFAULT_PATH;
    }

    try {
        // Save the path
        await stateManager.saveFolderPath(currentPathToSave);
        
        // Add to history
        const newHistory = await stateManager.addToPathHistory(currentPathToSave, MAX_HISTORY);
        
        // Show success message
        const message = rawInputPath === '' ? `Path reset to default "${DEFAULT_PATH}".` : 'Folder path saved!';
        const color = rawInputPath === '' ? 'orange' : 'green';
        showStatus(statusDiv, customTitleStatus, message, color, 1500, false);
        
        // Update UI
        updateUI(folderPathInput, document.getElementById('pastPaths'), currentPathToSave, newHistory, DEFAULT_PATH);
        
        // Close popup after success
        setTimeout(() => window.close(), 500);
    } catch (error) {
        console.error("Error saving settings:", error);
        showStatus(statusDiv, customTitleStatus, 'Error saving settings.', 'red', 0, false);
    }
}

// --- Function to handle saving with custom title ---
export async function saveCustomTitle(customTitleInput, saveCustomTitleButton, statusDiv, customTitleStatus) {
    const customTitle = customTitleInput.value.trim();
    if (!customTitle) {
        showStatus(statusDiv, customTitleStatus, 'Please enter a title.', 'red', 3000, true);
        customTitleInput.focus();
        return;
    }

    // Get the custom title data
    const customTitleData = await stateManager.getCustomTitleData();
    if (!customTitleData) {
        showStatus(statusDiv, customTitleStatus, 'Error: No custom title data found.', 'red', 0, true);
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
    showStatus(statusDiv, customTitleStatus, 'Saving...', 'blue', 0, true);
    saveCustomTitleButton.disabled = true;
    customTitleInput.disabled = true;

    try {
        // Send message to background script
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'uploadCustomTitle', data: dataToSend }, 
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                }
            );
        });

        // Clear custom title data
        await stateManager.setCustomTitleMode(false);

        // Re-enable UI
        saveCustomTitleButton.disabled = false;
        customTitleInput.disabled = false;

        if (response && response.success) {
            console.log("Received success response from background.");
            showStatus(statusDiv, customTitleStatus, 'Saved successfully!', 'green', 1500, true);
            setTimeout(() => window.close(), 1500);
        } else {
            console.error("Received failure response from background:", response);
            const errorMsg = (response && response.message) ? response.message : 'Upload failed.';
            showStatus(statusDiv, customTitleStatus, errorMsg, 'red', 0, true);
            customTitleInput.focus();
        }
    } catch (error) {
        console.error("Error receiving response from background:", error);
        showStatus(statusDiv, customTitleStatus, 
            `Error: ${error.message || 'Unknown communication error.'}`, 'red', 0, true);
        saveCustomTitleButton.disabled = false;
        customTitleInput.disabled = false;
    }
}

// --- Load saved path and history ---
export async function loadSettings(folderPathInput, pastPathsDatalist, statusDiv, customTitleStatus) {
    try {
        const folderPath = await stateManager.getFolderPath();
        const history = await stateManager.getPathHistory();
        
        updateUI(folderPathInput, pastPathsDatalist, folderPath, history, DEFAULT_PATH);
        folderPathInput.focus();
        const textLength = folderPathInput.value.length;
        folderPathInput.setSelectionRange(textLength, textLength);
    } catch (error) {
        console.error("Error loading settings:", error);
        showStatus(statusDiv, customTitleStatus, 'Error loading settings.', 'red', 0, false);
    }
}

// Enhanced force-close popup function
export function forceClosePopup() {
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
        
        // Method 3: Self-destruct via reload
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

// Handle Command+Shift+P keyboard shortcut
export function handleCommandShiftP(event) {
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

// --- Initialization function for popup ---
export async function initializePopup(
    settingsSection, 
    customTitleSection, 
    customTitleInput, 
    folderPathInput, 
    pastPathsDatalist, 
    statusDiv, 
    customTitleStatus,
    saveButton,
    saveCustomTitleButton
) {
    try {
        // Check if we're in custom title mode
        const customTitleData = await stateManager.getCustomTitleData();
        
        if (customTitleData && customTitleData.isCustomTitleFlow) {
            // Setup for Custom Title Mode
            console.log("Popup opened in custom title flow.", customTitleData);
            settingsSection.style.display = 'none';
            customTitleSection.style.display = 'block';
            customTitleInput.value = customTitleData.originalTitle || '';
            customTitleInput.focus();
            customTitleInput.select();
            
            // Attach custom title listeners
            saveCustomTitleButton.addEventListener('click', () => 
                saveCustomTitle(customTitleInput, saveCustomTitleButton, statusDiv, customTitleStatus));
            
            customTitleInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveCustomTitle(customTitleInput, saveCustomTitleButton, statusDiv, customTitleStatus);
                }
            });
        } else {
            // Setup for Settings Mode
            console.log("Popup opened in standard settings mode.");
            customTitleSection.style.display = 'none';
            settingsSection.style.display = 'block';
            
            // Load settings
            await loadSettings(folderPathInput, pastPathsDatalist, statusDiv, customTitleStatus);
            
            // Attach settings listeners
            saveButton.addEventListener('click', () => 
                savePath(folderPathInput, statusDiv, customTitleStatus));
            
            folderPathInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    savePath(folderPathInput, statusDiv, customTitleStatus);
                }
            });
        }
    } catch (error) {
        console.error("Error initializing popup:", error);
        settingsSection.style.display = 'block';
        customTitleSection.style.display = 'none';
        await loadSettings(folderPathInput, pastPathsDatalist, statusDiv, customTitleStatus);
    }
} 