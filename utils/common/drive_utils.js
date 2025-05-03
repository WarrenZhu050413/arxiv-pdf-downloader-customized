// drive_utils.js
import { showNotification } from './notification_utils.js';

// --- GoogleDriveUploader Class ---
export class GoogleDriveUploader {
    constructor() {
        this.apiUrl = 'https://www.googleapis.com/drive/v3/files';
        this.uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    }

    async uploadFile(file, folderPath) {
        console.log(`Uploading file: ${file.name} to path: ${folderPath}`);

        try {
            const token = await this.authenticateUser();
            if (!token) {
                console.error('Failed to authenticate user');
                throw new Error('Failed to authenticate user');
            }

            const blob = await this.fetchFileBlob(file.path);
            const parentFolderId = await this.findOrCreateFolderHierarchy(folderPath, token);
            console.log(`Final parent folder ID: ${parentFolderId} for path: ${folderPath}`);

            const result = await this.putOnDrive({
                blob: blob,
                filename: file.name,
                mimetype: blob.type,
                parent: parentFolderId,
                token: token
            });

            console.log('File uploaded successfully:', result);
            return result;
        } catch (error) {
            console.error(`Error uploading file to path '${folderPath}':`, error);
            throw error;
        }
    }

    async authenticateUser() {
        console.log('Authenticating user...');
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ 'interactive': true }, (token) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
                } else {
                    console.log('Authenticated successfully.');
                    resolve(token);
                }
            });
        });
    }

    async fetchFileBlob(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error fetching PDF! status: ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            console.error('Error fetching file blob:', error);
            throw error;
        }
    }

    async findOrCreateFolderHierarchy(folderPath, token) {
        const pathComponents = folderPath.split('/').filter(Boolean);
        let parentId = 'root';
        console.log(`Resolving path components: ${pathComponents.join('/')}`);

        for (const component of pathComponents) {
            console.log(`Searching for folder '${component}' within parent '${parentId}'...`);
            const query = encodeURIComponent(`name='${component}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
            const folderSearchUrl = `${this.apiUrl}?q=${query}&fields=files(id)`;

            try {
                const searchResponse = await fetch(folderSearchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!searchResponse.ok) {
                    const errorBody = await searchResponse.text();
                    throw new Error(`Google Drive API error searching folder '${component}' (Status: ${searchResponse.status}): ${errorBody}`);
                }
                const searchResult = await searchResponse.json();

                if (searchResult.files && searchResult.files.length > 0) {
                    parentId = searchResult.files[0].id;
                    console.log(`Folder '${component}' found with ID: ${parentId}`);
                } else {
                    console.log(`Folder '${component}' not found. Creating within parent '${parentId}'...`);
                    const createResponse = await fetch(this.apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name: component,
                            parents: [parentId],
                            mimeType: 'application/vnd.google-apps.folder'
                        })
                    });
                    if (!createResponse.ok) {
                       const errorBody = await createResponse.text();
                       throw new Error(`Google Drive API error creating folder '${component}' (Status: ${createResponse.status}): ${errorBody}`);
                    }
                    const createResult = await createResponse.json();
                    parentId = createResult.id;
                    console.log(`Folder '${component}' created with ID: ${parentId}`);
                }
            } catch (error) {
                console.error(`Error processing folder component '${component}' in path '${folderPath}':`, error);
                throw new Error(`Failed to find or create folder '${component}': ${error.message}`);
            }
        }
        return parentId;
    }

    async putOnDrive(file) {
        const metadata = {
            name: file.filename,
            parents: [file.parent]
        };
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file.blob);
        console.log(`Uploading '${file.filename}' to parent folder ID: ${file.parent}`);

        try {
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${file.token}`
                },
                body: formData
            });
            if (!response.ok) {
                 const errorBody = await response.text();
                throw new Error(`Google Drive API error uploading file (Status: ${response.status}): ${errorBody}`);
            }
            const result = await response.json();
            console.log('File upload API result:', result);
            return result;
        } catch (error) {
            console.error('Error in putOnDrive:', error);
            throw error;
        }
    }
}

// Generic upload function that uses the class and returns status
export async function uploadToDrive(fileInfo, folderPath, token = null) {
    console.log(`Initiating upload for: ${fileInfo.name} to path: ${folderPath}`);
    try {
        const googleDriveUploader = new GoogleDriveUploader();
        // Authentication happens within uploadFile if needed
        await googleDriveUploader.uploadFile(fileInfo, folderPath);
        const successMsg = `File '${fileInfo.name}' uploaded to path '${folderPath}' successfully.`;
        showNotification('SUCCESS', successMsg, 'success');
        return { success: true, message: successMsg }; // Return success status
    } catch (error) {
        console.error(`Error uploading '${fileInfo.name}' to '${folderPath}':`, error);
        let displayError = error.message || 'An unknown error occurred during upload.';
         // Refine error messages slightly
         if (displayError.includes("Authentication failed")) {
             displayError = "Authentication failed. Please try the command again.";
         } else if (displayError.includes("HTTP error fetching PDF")) {
             displayError = "Could not download the paper PDF.";
         } else if (displayError.includes("Failed to find or create folder")) {
             displayError = `Error setting up Drive folder structure: ${error.message}`;
         } else if (displayError.includes("Google Drive API error uploading file")) {
             displayError = `Drive upload failed: ${error.message}`;
         }
        const errorMsg = `Error uploading to '${folderPath}': ${displayError}`;
        showNotification('FAILURE', errorMsg, 'failure');
        return { success: false, message: errorMsg }; // Return failure status
    }
} 