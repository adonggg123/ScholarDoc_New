// js/services/annex_sync_service.js
/**
 * AnnexSyncService
 * Provides real-time, persistent, and deduplicated synchronization of
 * verified Form 2 (Enrolled) and Form 3 (Not Included) student records
 * between the Admin Interface (Review Queue / Annex 5 Generator) and
 * the Super Admin Reports section.
 */

const STORAGE_KEY = 'scholardoc_annex5_verified_data';
const CHANNEL_NAME = 'scholardoc_annex5_sync_channel';
const CUSTOM_EVENT_NAME = 'scholardoc_annex5_sync_event';

// Initialize BroadcastChannel if supported
let broadcastChannel = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    }
} catch (e) {
    console.warn('BroadcastChannel not supported in this environment, falling back to storage events:', e);
}

export class AnnexSyncService {
    /**
     * Extracts a stable, unique key for a grantee or verification item.
     */
    static getUniqueKey(item) {
        if (!item) return '';
        const g = item.grantee || item;
        if (g.id) return String(g.id);

        const lName = (g.last_name || g.lastName || '').trim().toLowerCase();
        const fName = (g.first_name || g.firstName || '').trim().toLowerCase();
        const mName = (g.middle_name || g.middleName || '').trim().toLowerCase();

        const combined = `${lName}_${fName}_${mName}`.replace(/[^a-z0-9]/g, '');
        if (combined) return combined;

        const rawName = (g.name || g.fullName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return rawName || Math.random().toString(36).substring(2, 9);
    }

    /**
     * Strictly deduplicates records across Form 2, Form 3, and Needs Review Queue.
     * Prevents any record from appearing in multiple lists simultaneously.
     */
    static deduplicateLists(form2List = [], form3List = [], needsReviewList = []) {
        const seenKeys = new Set();
        const cleanForm2 = [];
        const cleanForm3 = [];
        const cleanReview = [];

        // 1. Form 2: Included / Enrolled Grantees
        for (const item of (form2List || [])) {
            const key = this.getUniqueKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                const itemCopy = { ...item };
                itemCopy.classification = 'MATCHED_FORM2';
                itemCopy.isEnrolled = true;
                cleanForm2.push(itemCopy);
            }
        }

        // 2. Form 3: Not Included Grantees (Special statuses: Not enrolled, Dropped, Waived, LOA, Transferee, Graduated)
        for (const item of (form3List || [])) {
            const key = this.getUniqueKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                const itemCopy = { ...item };
                itemCopy.classification = 'INACTIVE_FORM3';
                itemCopy.isEnrolled = false;
                itemCopy.specialStatusReason = itemCopy.specialStatusReason || 'Not enrolled';
                itemCopy.remarks = itemCopy.remarks || `Categorized: ${itemCopy.specialStatusReason}`;
                cleanForm3.push(itemCopy);
            }
        }

        // 3. Needs Review Queue: Discrepancy items awaiting Admin action
        for (const item of (needsReviewList || [])) {
            const key = this.getUniqueKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                const itemCopy = { ...item };
                itemCopy.classification = 'NEEDS_REVIEW';
                cleanReview.push(itemCopy);
            }
        }

        return {
            form2List: cleanForm2,
            form3List: cleanForm3,
            needsReviewList: cleanReview
        };
    }

    /**
     * Saves verified lists to persistent storage and broadcasts update to all views.
     */
    static saveVerifiedData({ form2List, form3List, needsReviewList, updatedBy = 'Admin' }) {
        try {
            const deduplicated = this.deduplicateLists(form2List, form3List, needsReviewList);
            const totalCount = deduplicated.form2List.length + deduplicated.form3List.length + deduplicated.needsReviewList.length;

            const payload = {
                timestamp: Date.now(),
                updatedBy: updatedBy,
                totalCount: totalCount,
                form2Count: deduplicated.form2List.length,
                form3Count: deduplicated.form3List.length,
                reviewCount: deduplicated.needsReviewList.length,
                form2List: deduplicated.form2List,
                form3List: deduplicated.form3List,
                needsReviewList: deduplicated.needsReviewList
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

            // Broadcast via BroadcastChannel
            if (broadcastChannel) {
                try {
                    broadcastChannel.postMessage({ type: 'SYNC_UPDATE', payload });
                } catch (bcErr) {
                    console.warn('BroadcastChannel postMessage error:', bcErr);
                }
            }

            // Broadcast via in-window CustomEvent
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));

            return payload;
        } catch (e) {
            console.error('Error saving Annex 5 verified sync data:', e);
            return null;
        }
    }

    /**
     * Retrieves the latest verified data from storage.
     */
    static getVerifiedData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.form2List)) return null;

            // Ensure deduplication on read
            const deduplicated = this.deduplicateLists(
                parsed.form2List || [],
                parsed.form3List || [],
                parsed.needsReviewList || []
            );

            return {
                ...parsed,
                ...deduplicated,
                form2Count: deduplicated.form2List.length,
                form3Count: deduplicated.form3List.length,
                reviewCount: deduplicated.needsReviewList.length
            };
        } catch (e) {
            console.warn('Error reading Annex 5 verified sync data:', e);
            return null;
        }
    }

    /**
     * Subscribes to live synchronization updates across tabs, windows, and views.
     * @param {Function} callback Called with the updated verified data payload.
     * @returns {Function} Unsubscribe function to remove listeners.
     */
    static onSync(callback) {
        if (typeof callback !== 'function') return () => { };

        // 1. In-window custom event listener
        const handleCustomEvent = (e) => {
            if (e.detail) callback(e.detail);
        };
        window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

        // 2. Storage event listener (cross-tab fallback)
        const handleStorageEvent = (e) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    callback(parsed);
                } catch (err) {
                    console.warn('Storage event parse error:', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageEvent);

        // 3. BroadcastChannel listener (instant cross-tab)
        let handleBroadcast = null;
        if (broadcastChannel) {
            handleBroadcast = (event) => {
                if (event.data && event.data.type === 'SYNC_UPDATE' && event.data.payload) {
                    callback(event.data.payload);
                }
            };
            broadcastChannel.addEventListener('message', handleBroadcast);
        }

        // Return cleanup function
        return () => {
            window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
            window.removeEventListener('storage', handleStorageEvent);
            if (broadcastChannel && handleBroadcast) {
                broadcastChannel.removeEventListener('message', handleBroadcast);
            }
        };
    }

    /**
     * Clears all verified sync data.
     */
    static clearVerifiedData() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            const payload = {
                timestamp: Date.now(),
                updatedBy: 'System',
                totalCount: 0,
                form2Count: 0,
                form3Count: 0,
                reviewCount: 0,
                form2List: [],
                form3List: [],
                needsReviewList: []
            };
            if (broadcastChannel) {
                broadcastChannel.postMessage({ type: 'SYNC_UPDATE', payload });
            }
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));
        } catch (e) {
            console.error('Error clearing sync data:', e);
        }
    }
}
