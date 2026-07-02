// ScholarDoc Student Web — Storage Service (Cloudinary)
// Mirrors storage_service.dart and cloudinary_service.dart

const StorageService = {
    CLOUD_NAME: 'dc2wi71nx',
    UPLOAD_PRESET: 'scholardoc_profiles',

    /**
     * Upload a file to Cloudinary
     * @param {File|Blob} file - The file to upload
     * @param {string} folder - Folder path in Cloudinary
     * @param {string} [resourceType='auto'] - 'auto', 'image', or 'raw'
     * @returns {Promise<string>} The secure URL of the uploaded file
     */
    async uploadFile(file, folder = 'submissions', resourceType = 'auto') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.UPLOAD_PRESET);
        formData.append('folder', folder);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${this.CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err?.error?.message || 'Upload failed');
        }

        const result = await response.json();
        if (!result.secure_url) {
            throw new Error('Upload succeeded but no URL returned');
        }
        return result.secure_url;
    },

    /**
     * Upload raw bytes as a file to Cloudinary
     * @param {Uint8Array} bytes - Raw file bytes
     * @param {string} fileName - File name
     * @param {string} folder - Folder path
     * @returns {Promise<string>} The secure URL
     */
    async uploadBytes(bytes, fileName, folder = 'submissions') {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const file = new File([blob], fileName, { type: 'application/pdf' });
        return this.uploadFile(file, folder, 'raw');
    },

    /**
     * Upload a profile picture
     * @param {File} file - Image file
     * @returns {Promise<string>} The secure URL
     */
    async uploadProfilePicture(file) {
        return this.uploadFile(file, 'profile_pictures', 'image');
    }
};

window.StorageService = StorageService;
