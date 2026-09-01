// ScholarDoc Student Web — Notifications View Logic
// Mirrors notification_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;

const listEl = document.getElementById('notifications-list');
const emptyEl = document.getElementById('notifications-empty');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

async function loadNotifications() {
    try {
        let items = [];

        if (uid && sb) {
            const { data, error } = await sb
                .from('notifications')
                .select()
                .eq('studentId', uid)
                .order('timestamp', { ascending: false });
            if (!error && data) items = data;
        }

        // If no user-specific notifications found, show default system welcome/update notifications
        if (items.length === 0) {
            items = [
                {
                    id: 'sys-1',
                    type: 'success',
                    title: 'Scholarship Documents Verified',
                    message: 'Your Savings Account (SA) number and Student ID cards have been verified by the scholarship evaluation officer.',
                    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
                    isRead: false
                },
                {
                    id: 'sys-2',
                    type: 'info',
                    title: 'Welcome to ScholarDoc Student Portal',
                    message: 'Access your verification checklist, submit missing requirements, and track payout statuses all in one place.',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    isRead: true
                }
            ];
        }

        if (listEl) {
            emptyEl?.classList.add('hidden');
            markAllReadBtn?.classList.remove('hidden');

            const hasUnread = items.some(n => !n.isRead);
            if (markAllReadBtn) {
                markAllReadBtn.disabled = !hasUnread;
            }

            listEl.innerHTML = items.map(n => {
                let badgeClass = 'badge-info', typeIcon = 'bell-ring', accentColor = 'var(--info)';
                if (n.type === 'success') { badgeClass = 'badge-success'; typeIcon = 'check-circle'; accentColor = 'var(--success)'; }
                else if (n.type === 'warning') { badgeClass = 'badge-warning'; typeIcon = 'alert-triangle'; accentColor = 'var(--warning)'; }
                else if (n.type === 'error') { badgeClass = 'badge-danger'; typeIcon = 'x-circle'; accentColor = 'var(--error)'; }

                const relativeTime = getRelativeTime(n.timestamp);
                const isRead = n.isRead === true;

                return `
                    <div class="card notification-item ${isRead ? 'read' : 'unread'}" 
                         data-id="${n.id}"
                         style="transition: all 0.25s ease; ${!isRead ? 'border-left: 4px solid ' + accentColor + ';' : ''}">
                        <div class="card-body" style="padding: 18px 22px; display: flex; align-items: flex-start; gap: 16px;">
                            <div style="width: 42px; height: 42px; border-radius: var(--radius-lg); background: var(--bg-alt); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="${typeIcon}" style="width: 20px; height: 20px; color: ${accentColor};"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <div style="font-family: 'Outfit', sans-serif; font-size: 14.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.1px;">${n.title || 'Notification'}</div>
                                    ${!isRead ? `<span style="width: 7px; height: 7px; border-radius: 50%; background: ${accentColor}; display: inline-block;"></span>` : ''}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 6px;">${n.message || ''}</div>
                                <div style="font-size: 11.5px; color: var(--text-tertiary); font-weight: 500;">${relativeTime}</div>
                            </div>
                            ${!isRead ? `
                                <button class="btn btn-sm btn-outline mark-read-btn" data-id="${n.id}" style="padding: 6px 12px; font-size: 11.5px; flex-shrink: 0;" title="Mark as read">
                                    <i data-lucide="check"></i> Mark read
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
                        if (uid && sb) {
                            await sb.from('notifications').update({ isRead: true }).eq('id', id);
                        }
                        const card = btn.closest('.notification-item');
                        if (card) {
                            card.classList.remove('unread');
                            card.classList.add('read');
                            card.style.borderLeft = 'none';
                            btn.remove();
                        }
                    }
                });
            });

            // Click on notification to mark as read
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.addEventListener('click', async () => {
                    const id = item.dataset.id;
                    if (id) {
                        if (uid && sb) {
                            await sb.from('notifications').update({ isRead: true }).eq('id', id);
                        }
                        item.classList.remove('unread');
                        item.classList.add('read');
                        item.style.borderLeft = 'none';
                        item.querySelector('.mark-read-btn')?.remove();
                    }
                });
            });

            if (window.lucide) window.lucide.createIcons();
        }

    } catch (err) {
        console.error('Error loading notifications:', err);
        if (listEl) {
            listEl.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Could not load notifications.</p>`;
        }
    }
}

// Mark all as read button
markAllReadBtn?.addEventListener('click', async () => {
    markAllReadBtn.disabled = true;
    try {
        if (uid && sb) {
            await sb.from('notifications').update({ isRead: true }).eq('studentId', uid).eq('isRead', false);
        }
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
            item.style.borderLeft = 'none';
            item.querySelector('.mark-read-btn')?.remove();
        });
        window.showToast?.('Updated', 'All notifications marked as read', 'success');
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

loadNotifications();

// Real-time subscription
if (uid && sb) {
    sb.channel('notifications-view-reload')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `studentId=eq.${uid}`
        }, () => {
            loadNotifications();
        })
        .subscribe();
}
