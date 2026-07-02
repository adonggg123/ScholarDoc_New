// ScholarDoc Student Web — Notifications View Logic
// Mirrors notification_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;

const listEl = document.getElementById('notifications-list');
const emptyEl = document.getElementById('notifications-empty');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

async function loadNotifications() {
    if (!uid) return;

    try {
        const { data, error } = await sb
            .from('notifications')
            .select()
            .eq('studentId', uid)
            .order('timestamp', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            if (listEl) listEl.innerHTML = '';
            emptyEl?.classList.remove('hidden');
            markAllReadBtn?.classList.add('hidden');
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        emptyEl?.classList.add('hidden');
        markAllReadBtn?.classList.remove('hidden');

        // Check if there are any unread ones, otherwise disable mark all read button
        const hasUnread = data.some(n => !n.isRead);
        if (markAllReadBtn) {
            markAllReadBtn.disabled = !hasUnread;
        }

        listEl.innerHTML = data.map(n => {
            let typeColor = '#3B82F6', typeIcon = 'bell';
            if (n.type === 'success') { typeColor = '#10B981'; typeIcon = 'check-circle'; }
            else if (n.type === 'warning') { typeColor = '#F59E0B'; typeIcon = 'alert-triangle'; }
            else if (n.type === 'error') { typeColor = '#EF4444'; typeIcon = 'x-circle'; }

            const relativeTime = getRelativeTime(n.timestamp);
            const isRead = n.isRead === true;

            return `
                <div class="card notification-item ${isRead ? 'read' : 'unread'}" 
                     data-id="${n.id}"
                     style="margin-bottom: 12px; transition: all 0.3s; ${!isRead ? 'border-left: 4px solid ' + typeColor + ';' : ''}">
                    <div class="card-body" style="padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: ${typeColor}12; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="icon-${typeIcon}" style="width: 18px; height: 18px; color: ${typeColor};"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${n.title || ''}</span>
                                ${!isRead ? '<span style="width: 6px; height: 6px; border-radius: 50%; background: ' + typeColor + '; display: inline-block;"></span>' : ''}
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 4px;">${n.message || ''}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">${relativeTime}</div>
                        </div>
                        ${!isRead ? `
                            <button class="btn btn-sm btn-outline mark-read-btn" data-id="${n.id}" style="padding: 4px 8px; font-size: 11px;" title="Mark as read">
                                Mark read
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) {
                    btn.disabled = true;
                    await sb.from('notifications').update({ isRead: true }).eq('id', id);
                    loadNotifications();
                }
            });
        });

        // Click on notification to mark as read
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                if (id) {
                    await sb.from('notifications').update({ isRead: true }).eq('id', id);
                    loadNotifications();
                }
            });
        });

    } catch (err) {
        console.error('Error loading notifications:', err);
        if (listEl) {
            listEl.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Could not load notifications.</p>`;
        }
    }
}

// Mark all as read button
markAllReadBtn?.addEventListener('click', async () => {
    if (!uid) return;
    markAllReadBtn.disabled = true;
    try {
        await sb.from('notifications').update({ isRead: true }).eq('studentId', uid).eq('isRead', false);
        loadNotifications();
        window.showToast?.('Success', 'All notifications marked as read', 'success');
    } catch (err) {
        console.error('Error marking all as read:', err);
        markAllReadBtn.disabled = false;
    }
});

// Relative time helper
function getRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Initial load
loadNotifications();

// Real-time subscription to reload
const channel = sb.channel('notifications-view-reload')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `studentId=eq.${uid}`
    }, () => {
        loadNotifications();
    })
    .subscribe();
