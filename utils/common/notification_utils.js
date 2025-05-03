// notification_utils.js
export function showNotification(title, message, type) {
  chrome.notifications.create('', {
    type: 'basic',
    iconUrl: 'images/icon_128.png',
    title: title,
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error(`Error showing notification: ${chrome.runtime.lastError.message}`);
    } else {
      console.log(`Notification ${type}: ${notificationId}`);
    }
  });
}

// Helper for popup UI status messages
export function showStatus(statusDiv, customTitleStatusDiv, message, color = 'green', duration = 3000, isCustom = false) {
  const targetDiv = isCustom ? customTitleStatusDiv : statusDiv;
  if (!targetDiv) {
    console.error("Target status div not found!");
    return;
  }
  targetDiv.textContent = message;
  targetDiv.style.color = color;
  if (duration > 0) {
    setTimeout(() => { targetDiv.textContent = ''; }, duration);
  }
}

// Helper for updating popup UI
export function updateUI(folderPathInput, pastPathsDatalist, currentPath, history = [], defaultPath) {
  // Set input field value or placeholder
  folderPathInput.value = currentPath || defaultPath;
  if (!currentPath) {
    folderPathInput.placeholder = `Default: ${defaultPath}`;
  }

  // Update Datalist
  pastPathsDatalist.innerHTML = ''; // Clear existing options
  history.forEach(path => {
    const option = document.createElement('option');
    option.value = path;
    pastPathsDatalist.appendChild(option);
  });
} 