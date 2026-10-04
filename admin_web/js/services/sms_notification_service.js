// js/services/sms_notification_service.js

/**
 * SmsNotificationService
 * Connects ScholarDoc Web Interfaces to the backend Semaphore SMS engine
 * to dispatch real-time SMS alerts to students' registered Philippine mobile numbers.
 * 
 * Note: Credentials remain secure on the server side and are NEVER exposed here.
 */

export class SmsNotificationService {
    static getEdgeFunctionUrl() {
        const supabase = window.supabaseClient;
        if (supabase && supabase.supabaseUrl) {
            return `${supabase.supabaseUrl}/functions/v1/send-sms-notification`;
        }
        return 'https://ywavesulvkqwpsejprxp.supabase.co/functions/v1/send-sms-notification';
    }

    static async getAccountInfo() {
        try {
            const res = await fetch('/api/sms/account');
            if (res.ok) {
                return await res.json();
            }
        } catch (_) {}

        try {
            const res = await fetch(this.getEdgeFunctionUrl(), { method: 'GET' });
            if (res.ok) {
                return await res.json();
            }
        } catch (_) {}

        return { configured: false, status: 'unavailable', message: 'Unable to reach SMS server.' };
    }

    static async sendStudentSms(studentIdentifier, { eventType = 'custom', title, message, feedback, phone, force = false, fullName, studentNo, course, scholarshipName } = {}) {
        const payload = {
            student_id: studentIdentifier,
            uid: studentIdentifier,
            student_no: studentNo,
            event_type: eventType,
            title,
            message,
            feedback,
            phone,
            force,
            fullName,
            course,
            scholarshipName
        };

        try {
            const res = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) return data;
            if (data && (data.error || data.message)) return data;
        } catch (_) {}

        try {
            const res = await fetch(this.getEdgeFunctionUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message || 'SMS service unreachable' };
        }
    }

    static async notifyGranteeSms(studentIdentifier, { force = false, phone, fullName, studentNo, course, scholarshipName } = {}) {
        return this.sendStudentSms(studentIdentifier, {
            eventType: 'grantee_confirmed',
            force,
            phone,
            fullName,
            studentNo,
            course,
            scholarshipName
        });
    }

    static async notifyAllPendingGranteesSms({ limit = 100, force = false } = {}) {
        try {
            const res = await fetch('/api/sms/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: 'grantee_confirmed',
                    limit,
                    force
                })
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    static async broadcastSms(title, message) {
        try {
            const res = await fetch('/api/sms/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, message })
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    static async getSmsLogs() {
        try {
            const res = await fetch('/api/sms/logs');
            if (res.ok) {
                const data = await res.json();
                return data.logs || [];
            }
        } catch (_) {}
        return [];
    }

    static renderStatusBadge(student) {
        const sentAt = student.sms_sent_at || student.smsSentAt;
        const status = (student.sms_status || student.smsStatus || '').toLowerCase();
        const sentTo = student.sms_sent_to || student.smsSentTo || student.mobile_number || student.contactNumber;
        const error = student.sms_error || '';

        if (sentAt || status === 'sent' || status === 'delivered') {
            const dateStr = sentAt ? new Date(sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sent';
            return `
                <span title="SMS delivered to ${sentTo || 'phone'} on ${dateStr}" style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(5, 150, 105, 0.12); color: #059669; border: 1px solid rgba(5, 150, 105, 0.25); white-space: nowrap; cursor: default;">
                    <i class="icon-message-square" style="font-size: 11px;"></i>
                    <span>SMS Sent</span>
                </span>
            `;
        }

        if (status === 'queued' || status === 'pending') {
            return `
                <span title="SMS queued for dispatch" style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.3); white-space: nowrap; cursor: default;">
                    <i class="icon-clock" style="font-size: 11px;"></i>
                    <span>SMS Queued</span>
                </span>
            `;
        }

        if (status === 'failed') {
            return `
                <span title="${error || 'SMS delivery failed'}" style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(239, 68, 68, 0.1); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.25); white-space: nowrap; cursor: help;">
                    <i class="icon-alert-circle" style="font-size: 11px;"></i>
                    <span>SMS Failed</span>
                </span>
            `;
        }

        return `
            <span title="No SMS sent yet" style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(148, 163, 184, 0.12); color: #64748B; border: 1px solid rgba(148, 163, 184, 0.25); white-space: nowrap; cursor: default;">
                <i class="icon-message-square" style="font-size: 11px;"></i>
                <span>No SMS</span>
            </span>
        `;
    }
}
