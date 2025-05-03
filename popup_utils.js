// popup_utils.js

// --- Helper Function to Update UI Elements (Path input and Datalist) ---
function updateUI(folderPathInput, pastPathsDatalist, currentPath, history = [], defaultPath) {
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

// --- Helper Function to Show Status Messages in Popup ---
function showStatus(statusDiv, customTitleStatusDiv, message, color = 'green', duration = 3000, isCustom = false) {
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