// window_utils.js
export const popupManager = {
  async open() {
    try {
      // First check if there's an active window at all
      let activeWindows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: false });
      if (!activeWindows || activeWindows.length === 0) {
        console.log("No active Chrome windows found. Cannot open popup without a browser window.");
        const { showNotification } = await import('./notification_utils.js');
        showNotification('INFO', 'Please open a browser window first', 'info');
        return;
      }

      // Try to get the last focused window
      try {
        const currentWindow = await chrome.windows.getLastFocused();
        
        if (currentWindow && currentWindow.focused) {
          // Only open popup if we have a focused window
          await chrome.action.openPopup();
          console.log("Popup open requested.");
        } else {
          // Try to focus a window first
          if (activeWindows.length > 0) {
            await chrome.windows.update(activeWindows[0].id, { focused: true });
            // Wait a moment for the focus to take effect
            setTimeout(async () => {
              try {
                await chrome.action.openPopup();
                console.log("Popup open requested after focusing window.");
              } catch (e) {
                console.error("Failed to open popup after focusing window:", e);
              }
            }, 100);
          } else {
            console.error("No window available to focus.");
            const { showNotification } = await import('./notification_utils.js');
            showNotification('INFO', 'Could not focus a browser window', 'info');
          }
        }
      } catch (focusError) {
        console.warn("Error getting focused window:", focusError);
        
        // Fallback: Try with any available window
        if (activeWindows.length > 0) {
          await chrome.windows.update(activeWindows[0].id, { focused: true });
          setTimeout(async () => {
            try {
              await chrome.action.openPopup();
              console.log("Popup open requested with fallback window.");
            } catch (e) {
              console.error("Failed to open popup with fallback window:", e);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error("Error opening popup:", error);
      const { showNotification } = await import('./notification_utils.js');
      showNotification('FAILURE', 'Could not open extension popup', 'failure');
    }
  },

  async close() {
    console.log("Attempting to close popup");
    
    // Method 1: Send message to popup
    chrome.runtime.sendMessage({ action: 'closePopup' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("No popup to receive message or error:", chrome.runtime.lastError);
      } else {
        console.log("Popup received close message:", response);
      }
    });
    
    // Method 2: Unfocus the popup window
    try {
      chrome.windows.getCurrent(windowInfo => {
        if (windowInfo) {
          chrome.windows.update(windowInfo.id, { focused: false });
        }
      });
    } catch (e) {
      console.error("Error trying to unfocus popup:", e);
    }
  },

  async forceClose() {
    console.log("Force closing popup");
    
    // Method 1: Send force close message to popup
    chrome.runtime.sendMessage({ action: 'forceClosePopup' }, () => {
      // Ignore errors since popup might already be closed
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
    
    // Method 3: Find and close popup windows
    try {
      chrome.windows.getAll({ populate: true }, (windows) => {
        for (const window of windows) {
          if (window.type === 'popup') {
            chrome.windows.remove(window.id);
          }
        }
      });
    } catch (e) {
      console.error("Error finding popup windows:", e);
    }
  },

  async togglePopup() {
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
        
        return true; // Indicate we closed popups
      } 
      // Otherwise, open a popup
      else {
        console.log("Toggling: No popups found, opening one");
        
        // Check if we have an active tab
        const tabs = await new Promise(resolve => {
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs || []));
        });
        
        if (tabs.length === 0) {
          console.error("No active tabs found, cannot open popup");
          return false;
        }
        
        // Open the popup
        await this.open();
        return true;
      }
    } catch (error) {
      console.error("Error toggling popup:", error);
      return false;
    }
  }
}; 