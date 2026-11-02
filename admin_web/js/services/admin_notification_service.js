// js/services/admin_notification_service.js

/**
 * AdminNotificationService
 * Centralized service for logging, classifying, and managing activity-based
 * notifications in the Admin (Registrar) interface.
 * 
 * Activities are organized into three primary categories:
 * - Submissions: New document uploads, school student lists, generated Annex 5 forms.
 * - Record Updates: Cross-verification updates, profile edits, masterlist imports, data clearing.
 * - Status Changes: Review queue resolutions, grantee approvals/rejections, SA/ID verifications.
 */

const CATEGORIES = {
    SUBMISSION: 'submission',
    RECORD_UPDATE: 'record_update',
    STATUS_CHANGE: 'status_change',
    SYSTEM: 'system'
};

const CATEGORY_LABELS = {
    [CATEGORIES.SUBMISSION]: 'New Submission',
    [CATEGORIES.RECORD_UPDATE]: 'Record Update',
    [CATEGORIES.STATUS_CHANGE]: 'Status Change',
    [CATEGORIES.SYSTEM]: 'System Notice'
};

export class AdminNotificationService {
    static CATEGORIES = CATEGORIES;
    static CATEGORY_LABELS = CATEGORY_LABELS;

    /**
     * Resolves the Supabase client safely.
     */
    static getSupabase() {
        if (window.supabaseClient) return window.supabaseClient;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            return window.supabase;
        }
        return null;
    }

    /**
     * Parse and classify any notification into an activity category.
     * @param {Object} notification 
     * @returns {'submission'|'record_update'|'status_change'|'system'}
     */
    static classifyCategory(notification) {
        if (!notification) return CATEGORIES.SYSTEM;

        const title = (notification.title || '').toLowerCase();
        const msg = (notification.message || '').toLowerCase();
        const combined = `${title} ${msg}`;

        // 1. Explicit prefix or bracket tag
        if (title.includes('new submission') || title.includes('[submission]') || title.includes('submission:')) {
            return CATEGORIES.SUBMISSION;
        }
        if (title.includes('record update') || title.includes('[update]') || title.includes('update:')) {
            return CATEGORIES.RECORD_UPDATE;
        }
        if (title.includes('status change') || title.includes('[status]') || title.includes('status:')) {
            return CATEGORIES.STATUS_CHANGE;
        }

        // 2. Keyword detection for Submissions
        if (
            combined.includes('submitted') ||
            combined.includes('new submission') ||
            combined.includes('document submission') ||
            combined.includes('documents submitted') ||
            combined.includes('uploaded school') ||
            combined.includes('file uploaded') ||
            combined.includes('annex form 2 generated') ||
            combined.includes('annex form 3 generated') ||
            combined.includes('billing generated') ||
            combined.includes('form exported') ||
            combined.includes('new document') ||
            combined.includes('sa number submitted') ||
            combined.includes('id validation submitted')
        ) {
            return CATEGORIES.SUBMISSION;
        }

        // 3. Keyword detection for Status Changes
        if (
            combined.includes('status change') ||
            combined.includes('status:') ||
            combined.includes('resolved') ||
            combined.includes('auto-resolve') ||
            combined.includes('marked as') ||
            combined.includes('grantee approved') ||
            combined.includes('application approved') ||
            combined.includes('application rejected') ||
            combined.includes('grantee rejected') ||
            combined.includes('sa verification:') ||
            combined.includes('id validation:') ||
            combined.includes('verified') ||
            combined.includes('revision required') ||
            combined.includes('rejected')
        ) {
            return CATEGORIES.STATUS_CHANGE;
        }

        // 4. Keyword detection for Record Updates
        if (
            combined.includes('updated') ||
            combined.includes('record update') ||
            combined.includes('cross-verification') ||
            combined.includes('cross-matched') ||
            combined.includes('masterlist imported') ||
            combined.includes('new grantees masterlist') ||
            combined.includes('cleared') ||
            combined.includes('synchronized') ||
            combined.includes('profile updated') ||
            combined.includes('settings updated') ||
            combined.includes('password changed') ||
            combined.includes('registered')
        ) {
            return CATEGORIES.RECORD_UPDATE;
        }

        return CATEGORIES.SYSTEM;
    }

    /**
     * Format a display title ensuring it contains the proper category tag.
     */
    static formatTitle(category, title) {
        const cleanTitle = (title || 'Activity Alert').replace(/^(\[[^\]]+\]|\w+ \w+:)\s*/i, '').trim();
        switch (category) {
            case CATEGORIES.SUBMISSION:
                return `New Submission: ${cleanTitle}`;
            case CATEGORIES.RECORD_UPDATE:
                return `Record Update: ${cleanTitle}`;
            case CATEGORIES.STATUS_CHANGE:
                return `Status Change: ${cleanTitle}`;
            default:
                return cleanTitle;
        }
    }

    /**
     * Dispatch and log an activity notification for the Admin (Registrar).
     * @param {Object} options
     * @param {string} options.title - Notification headline
     * @param {string} options.message - Detailed explanation of the activity
     * @param {'submission'|'record_update'|'status_change'|'system'} [options.category]
     * @param {'info'|'success'|'warning'|'error'} [options.type='info']
     * @param {Object} [options.metadata] - Extra structured metadata
     * @param {boolean} [options.showLocalPopup=true] - Whether to immediately pop up in UI
     */
    static async logActivity({
        title,
        message,
        category = CATEGORIES.RECORD_UPDATE,
        type = 'info',
        metadata = null,
        showLocalPopup = true,
        studentId = 'admin'
    }) {
        const fullTitle = this.formatTitle(category, title);
        const timestamp = new Date().toISOString();

        // 1. Persist to Supabase `notifications` table
        let insertedId = null;
        try {
            const sb = this.getSupabase();
            if (sb) {
                const { data, error } = await sb.from('notifications').insert([{
                    studentId: studentId,
                    title: fullTitle,
                    message: message,
                    type: type,
                    isRead: false,
                    timestamp: timestamp
                }]).select('id');

                if (!error && data && data.length > 0) {
                    insertedId = data[0].id;
                }
            }
        } catch (err) {
            console.warn('AdminNotificationService: Error saving notification to Supabase:', err);
        }

        // 2. Dispatch local event for instant UI reaction in this tab
        const activityPayload = {
            id: insertedId || `local_${Date.now()}`,
            title: fullTitle,
            message: message,
            category: category,
            type: type,
            isRead: false,
            timestamp: timestamp,
            metadata: metadata
        };

        window.dispatchEvent(new CustomEvent('admin_activity_logged', { detail: activityPayload }));

        // 3. Immediately trigger desktop popup if requested and available
        if (showLocalPopup && typeof window.showDesktopPopupNotification === 'function') {
            window.showDesktopPopupNotification({
                id: activityPayload.id,
                title: fullTitle,
                message: message,
                type: type,
                category: category,
                role: 'Registrar',
                timestamp: timestamp
            });
        }

        return activityPayload;
    }

    /**
     * Helper to log a Submission activity.
     */
    static async notifySubmission({ title, message, type = 'success', metadata = null }) {
        return this.logActivity({
            title,
            message,
            category: CATEGORIES.SUBMISSION,
            type,
            metadata
        });
    }

    /**
     * Helper to log a Record Update activity.
     */
    static async notifyRecordUpdate({ title, message, type = 'info', metadata = null }) {
        return this.logActivity({
            title,
            message,
            category: CATEGORIES.RECORD_UPDATE,
            type,
            metadata
        });
    }

    /**
     * Helper to log a Status Change activity.
     */
    static async notifyStatusChange({ title, message, type = 'success', metadata = null }) {
        return this.logActivity({
            title,
            message,
            category: CATEGORIES.STATUS_CHANGE,
            type,
            metadata
        });
    }
}

// Attach to window for global access across vanilla scripts if in browser
if (typeof window !== 'undefined') {
    window.AdminNotificationService = AdminNotificationService;
}
