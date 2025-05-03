// command_handlers.js
import { stateManager } from '../common/storage_utils.js';
import { popupManager } from '../common/window_utils.js';
import { showNotification } from '../common/notification_utils.js';
import { errorHandler } from '../common/error_utils.js';
import { getUrlAndName } from './site_handlers.js';
import { constructFilename } from '../common/file_utils.js';
import { uploadToDrive } from '../common/drive_utils.js';

// Debounce settings
const download_interval = 1000;
let lastDownload = { url: '', time: 0 };
let lastPopupAction = { action: null, time: 0 };
const POPUP_ACTION_DEBOUNCE = 1000; // 1000ms debounce for popup actions

// Handlers for each command
export const commandHandlers = {
  SavePaper: async function() {
    return await errorHandler.tryCatch('SavePaper', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error("No active tab found.");
      }
      
      const tab = tabs[0];
      const now = Date.now();
      
      // Debounce check
      if (lastDownload.url === tab.url && now - lastDownload.time < download_interval) {
        showNotification('INFO', `Skipping duplicate download request for URL: ${tab.url}`, 'info');
        return;
      }
      lastDownload = { url: tab.url, time: now };
      
      // Get paper details and save
      const urlResult = await getUrlAndName(tab);
      if (!urlResult) {
        showNotification('INFO', 'Current page is not a supported paper page.', 'info');
        return;
      }
      
      const [filepdf_url, title, identifier, idType] = urlResult;
      if (!filepdf_url || !identifier) {
        throw new Error("Could not determine PDF URL or identifier.");
      }
      
      const save_filename = constructFilename(title, identifier, identifier, idType);
      const fileInfo = { path: filepdf_url, name: save_filename };
      showNotification('INFO', `Saving: ${fileInfo.name}`, 'info');
      
      const folderPath = await stateManager.getFolderPath();
      await uploadToDrive(fileInfo, folderPath);
    }, "Error saving paper");
  },
  
  SavePaperWithCustomTitle: async function() {
    return await errorHandler.tryCatch('SavePaperWithCustomTitle', async () => {
      // Check if already in custom title mode
      const isCustomMode = await stateManager.getCustomTitleMode();
      
      if (isCustomMode) {
        // Exit custom title mode
        await stateManager.setCustomTitleMode(false);
        await popupManager.forceClose();
        return;
      }
      
      // First open popup for better UX
      await popupManager.open();
      
      // Then load data in parallel
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error("No active tab found.");
      }
      
      const tab = tabs[0];
      const now = Date.now();
      
      // Debounce check
      if (lastDownload.url === tab.url && now - lastDownload.time < download_interval) {
        showNotification('INFO', `Skipping duplicate download request for URL: ${tab.url}`, 'info');
        return;
      }
      lastDownload = { url: tab.url, time: now };
      
      // Get paper details
      const urlResult = await getUrlAndName(tab);
      if (!urlResult) {
        showNotification('INFO', 'Current page is not a supported paper page.', 'info');
        popupManager.forceClose();
        return;
      }
      
      const [filepdf_url, title, identifier, idType] = urlResult;
      if (!filepdf_url || !identifier) {
        throw new Error("Could not determine PDF URL or identifier.");
      }
      
      // Set the custom title data
      await stateManager.setCustomTitleMode(true, {
        pdfUrl: filepdf_url,
        originalTitle: title,
        identifier: identifier,
        idType: idType
      });
    }, "Error initializing custom title mode");
  },
  
  maybe_open_popup: async function() {
    return await errorHandler.tryCatch('maybe_open_popup', async () => {
      const now = Date.now();
      if (lastPopupAction.action === 'close' && 
          (now - lastPopupAction.time < POPUP_ACTION_DEBOUNCE)) {
        console.log("Ignoring popup open request due to recent close action");
        return;
      }
      
      lastPopupAction = { action: 'open', time: now };
      
      // Use existing toggle function for better UX
      await popupManager.togglePopup();
    }, "Error toggling popup");
  },
  
  close_popup: async function() {
    return await errorHandler.tryCatch('close_popup', async () => {
      const now = Date.now();
      lastPopupAction = { action: 'close', time: now };
      
      await popupManager.forceClose();
    }, "Error closing popup");
  }
};

// Handle custom title upload
export async function handleCustomTitleUpload(data, sendResponse) {
  try {
    const { customTitle, originalData } = data;
    const { pdfUrl, identifier, idType } = originalData;
    
    if (!pdfUrl || !identifier || !customTitle) {
      console.error("Invalid data received for custom upload:", data);
      sendResponse({ success: false, message: 'Missing required data for custom save.' });
      return;
    }
    
    const folderPath = await stateManager.getFolderPath();
    
    const saveFilename = constructFilename(customTitle, identifier, identifier, idType);
    const fileInfo = { path: pdfUrl, name: saveFilename };
    
    console.log(`Uploading custom title file '${saveFilename}' to path: '${folderPath}'`);
    const uploadResult = await uploadToDrive(fileInfo, folderPath);
    sendResponse(uploadResult);
  } catch (error) {
    console.error("Error handling custom title upload:", error);
    sendResponse({ success: false, message: error.message || 'Unknown error during upload' });
  }
} 