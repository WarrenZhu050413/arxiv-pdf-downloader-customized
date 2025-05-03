// error_utils.js
import { showNotification } from './notification_utils.js';

export const errorHandler = {
  handleChromeError(operation, callback) {
    if (chrome.runtime.lastError) {
      console.error(`Error during ${operation}:`, chrome.runtime.lastError);
      showNotification('FAILURE', `Error: ${chrome.runtime.lastError.message || 'Unknown error'}`, 'failure');
      return false;
    }
    if (callback) callback();
    return true;
  },

  async tryCatch(operation, func, errorMessage) {
    try {
      return await func();
    } catch (error) {
      console.error(`Error during ${operation}:`, error);
      showNotification('FAILURE', errorMessage || error.message || 'Unknown error', 'failure');
      return null;
    }
  }
}; 