// storage_utils.js
export const stateManager = {
  async getCustomTitleMode() {
    const result = await chrome.storage.local.get(['customTitleData']);
    return result.customTitleData && result.customTitleData.isCustomTitleFlow;
  },
  
  async setCustomTitleMode(isActive, data = {}) {
    if (isActive) {
      await chrome.storage.local.set({ 
        customTitleData: {
          isCustomTitleFlow: true,
          ...data
        }
      });
    } else {
      await chrome.storage.local.remove('customTitleData');
    }
    return isActive;
  },

  async getCustomTitleData() {
    const result = await chrome.storage.local.get(['customTitleData']);
    return result.customTitleData || null;
  },

  async getFolderPath() {
    const result = await chrome.storage.sync.get(['driveFolderPath']);
    return result.driveFolderPath || 'papers';
  },

  async saveFolderPath(path) {
    await chrome.storage.sync.set({ driveFolderPath: path });
    return path;
  },
  
  async getPathHistory() {
    const result = await chrome.storage.sync.get(['driveFolderPathHistory']);
    return result.driveFolderPathHistory || [];
  },
  
  async addToPathHistory(path, maxHistory = 100) {
    const history = await this.getPathHistory();
    const newHistory = history.filter(p => p !== path); // Remove duplicates
    newHistory.unshift(path); // Add to beginning
    
    if (newHistory.length > maxHistory) {
      newHistory.length = maxHistory; // Truncate to max length
    }
    
    await chrome.storage.sync.set({
      driveFolderPathHistory: newHistory
    });
    
    return newHistory;
  }
}; 