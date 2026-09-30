// js/services/email_notification_service.js

/**
 * EmailNotificationService
 * Connects the ScholarDoc Super Admin web portal to the Supabase Edge Function
 * (`send-grantee-notification`) to automate sending official scholarship acceptance
 * emails and app download links via Gmail SMTP.
 */

export class EmailNotificationService {
    /**
     * Resolves the Supabase Edge Function endpoint URL.
     */
    static getFunctionUrl() {
        const supabase = window.supabaseClient;
        if (supabase && supabase.supabaseUrl) {
            return `${supabase.supabaseUrl}/functions/v1/send-grantee-notification`;
        }
        return 'https://ywavesulvkqwpsejprxp.supabase.co/functions/v1/send-grantee-notification';
    }

    /**
     * Sends an email notification to a single confirmed student grantee.
     * @param {string} studentIdentifier - The student's UID, ID, or student_no.
     * @param {Object} options - { force: boolean } (if true, bypasses duplicate check).
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    static async notifyGrantee(studentIdentifier, { force = false } = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client is not initialized.');
        }

        try {
            console.log(`[EmailNotificationService] Sending notification for student: ${studentIdentifier}`);

            // Preferred: Use the built-in Supabase Functions client
            if (supabase.functions && typeof supabase.functions.invoke === 'function') {
                const { data, error } = await supabase.functions.invoke('send-grantee-notification', {
                    body: {
                        student_id: studentIdentifier,
                        force: force
                    }
                });

                if (error) {
                    console.error('[EmailNotificationService] Edge function error:', error);
                    return { success: false, error: error.message || 'Edge function invocation failed.' };
                }

                return data;
            }

            // Fallback: Direct HTTP POST fetch with authorization headers
            const anonKey = supabase.supabaseKey || supabase.headers?.apikey || '';
            const res = await fetch(this.getFunctionUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    student_id: studentIdentifier,
                    force: force
                })
            });

            const result = await res.json();
            return result;
        } catch (err) {
            console.error('[EmailNotificationService] Notification error:', err);
            return { success: false, error: err.message || 'Network error sending email notification.' };
        }
    }

    /**
     * Sends email notifications to all pending grantees who have not yet received an email.
     * @param {Object} options - { limit: number, force: boolean }
     * @returns {Promise<{success: boolean, sent: number, skipped: number, failed: number, message: string}>}
     */
    static async notifyAllPendingGrantees({ limit = 50, force = false } = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client is not initialized.');
        }

        try {
            console.log('[EmailNotificationService] Starting batch notification for pending grantees...');

            if (supabase.functions && typeof supabase.functions.invoke === 'function') {
                const { data, error } = await supabase.functions.invoke('send-grantee-notification', {
                    body: {
                        mode: 'batch',
                        limit: limit,
                        force: force
                    }
                });

                if (error) throw error;
                return data;
            }

            const anonKey = supabase.supabaseKey || '';
            const res = await fetch(this.getFunctionUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    mode: 'batch',
                    limit: limit,
                    force: force
                })
            });

            return await res.json();
        } catch (err) {
            console.error('[EmailNotificationService] Batch error:', err);
            return {
                success: false,
                sent: 0,
                failed: 0,
                skipped: 0,
                message: err.message || 'Failed to trigger batch email notifications.'
            };
        }
    }

    /**
     * Retrieves counts of grantees who have and have not received email notifications.
     */
    static async getNotificationStats() {
        const supabase = window.supabaseClient;
        if (!supabase) return { total: 0, sent: 0, pending: 0 };

        try {
            const { data, error } = await supabase
                .from('student_grantees')
                .select('uid, student_no, email_sent_at, email_status, email_address, email');

            if (error || !data) return { total: 0, sent: 0, pending: 0 };

            const total = data.length;
            const sent = data.filter(s => s.email_sent_at || s.email_status === 'sent').length;
            const pending = data.filter(s => !s.email_sent_at && (s.email_address || s.email)).length;

            return { total, sent, pending };
        } catch (err) {
            console.warn('[EmailNotificationService] Could not fetch stats:', err);
            return { total: 0, sent: 0, pending: 0 };
        }
    }

    /**
     * Renders a UI badge indicating whether the student has received the notification email.
     * @param {Object} student - Student grantee record.
     * @returns {string} HTML string
     */
    static renderStatusBadge(student) {
        const sentAt = student.email_sent_at || student.emailSentAt;
        const status = student.email_status || student.emailStatus;

        if (sentAt || status === 'sent') {
            const dateStr = sentAt ? new Date(sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Sent';
            return `<span title="Email sent on ${sentAt || 'N/A'}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #15803d; background: #dcfce7; border: 1px solid #86efac; white-space: nowrap;">
                <i class="icon-mail" style="font-size: 11px;"></i> Notified (${dateStr})
            </span>`;
        }

        if (status === 'failed') {
            return `<span title="${student.email_error || 'Failed to send'}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #b91c1c; background: #fee2e2; border: 1px solid #fca5a5; white-space: nowrap;">
                <i class="icon-alert-triangle" style="font-size: 11px;"></i> Email Failed
            </span>`;
        }

        const hasEmail = Boolean(student.email_address || student.email);
        if (!hasEmail) {
            return `<span title="No email address recorded" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #64748b; background: #f1f5f9; border: 1px solid #cbd5e1; white-space: nowrap;">
                <i class="icon-mail" style="font-size: 11px; opacity: 0.6;"></i> No Email
            </span>`;
        }

        return `<span title="Pending email notification" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; white-space: nowrap;">
            <i class="icon-clock" style="font-size: 11px;"></i> Pending Email
        </span>`;
    }
}
