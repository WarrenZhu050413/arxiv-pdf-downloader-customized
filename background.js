// background.js - Main background script
import { commandHandlers, handleCustomTitleUpload } from './utils/background/command_handlers.js';
import { popupManager } from './utils/common/window_utils.js';
import { showNotification } from './utils/common/notification_utils.js';
import { stateManager } from './utils/common/storage_utils.js';

// --- Commands Event Listener ---
chrome.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);
    
    const handler = commandHandlers[command];
    if (handler) {
        await handler();
    } else {
        console.warn("Unrecognized command received:", command);
    }
});

// --- Messages Event Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in background:', message);
    
    // Handle different message types
    if (message.action === 'uploadCustomTitle') {
        handleCustomTitleUpload(message.data, sendResponse);
        return true; // Indicate asynchronous response
    }
    
    if (message.action === 'forceClosePopup') {
        popupManager.forceClose();
        sendResponse({ success: true });
        return true;
    }
    
    console.warn("Received unknown message action:", message.action);
    return false;
});

console.log('Background script loaded with modular architecture.'); 