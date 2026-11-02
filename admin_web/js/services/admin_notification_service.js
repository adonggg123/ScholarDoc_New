// js/services/admin_notification_service.js

/**
 * AdminNotificationService
 * Centralized service for logging, classifying, and managing activity-based
 * notifications in the Admin (Registrar) interface.
 * 
 * In the Registrar interface, only Record Updates are tracked.
 * All administrative registrar activities (such as masterlist sync, Annex 5 cross-matching,
 * student records updates, and file imports) are organized as Record Updates.
 */

const CATEGORIES = {
    RECORD_UPDATE: 'record_update'
};

const CATEGORY_LABELS = {
    [CATEGORIES.RECORD_UPDATE]: 'Record Update'
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
     * In the Registrar interface, only Record Updates remain.
     * @param {Object} notification 
     * @returns {'record_update'}
     */
    static classifyCategory(notification) {
        return CATEGORIES.RECORD_UPDATE;
    }

    /**
     * Format a display title ensuring it contains the Record Update category tag.
     */
    static formatTitle(category, title) {
        const cleanTitle = (title || 'Activity Alert').replace(/^(\[[^\]]+\]|\w+ \w+:)\s*/i, '').trim();
        return `Record Update: ${cleanTitle}`;
    }

    /**
     * Dispatch and log an activity notification for the Admin (Registrar).
     * @param {Object} options
     * @param {string} options.title - Notification headline
     * @param {string} options.message - Detailed explanation of the activity
     * @param {'record_update'} [options.category]
     * @param {'info'|'success'|'warning'|'error'} [options.type='info']
     * @param {Object} [options.metadata] - Extra structured metadata
     * @param {boolean} [options.showLocalPopup=true] - Whether to immediately pop up in UI
     * @param {string} [options.studentId='admin'] - Target role/identifier
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
        const fullTitle = this.formatTitle(CATEGORIES.RECORD_UPDATE, title);
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
            category: CATEGORIES.RECORD_UPDATE,
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
                category: CATEGORIES.RECORD_UPDATE,
                role: 'Registrar',
                timestamp: timestamp
            });
        }

        return activityPayload;
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
     * Backward-compatible aliases routing to Record Update in Registrar interface
     */
    static async notifySubmission({ title, message, type = 'success', metadata = null }) {
        return this.notifyRecordUpdate({ title, message, type, metadata });
    }

    static async notifyStatusChange({ title, message, type = 'success', metadata = null }) {
        return this.notifyRecordUpdate({ title, message, type, metadata });
    }
}

// Attach to window for global access across vanilla scripts if in browser
if (typeof window !== 'undefined') {
    window.AdminNotificationService = AdminNotificationService;
}
