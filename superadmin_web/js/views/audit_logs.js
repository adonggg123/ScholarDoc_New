// js/views/audit_logs.js
(function () {
    const supabase = window.supabaseClient;

    let allLogs = [];
    let currentFilteredLogs = [];
    let roleFilter = 'All';
    let activePreset = 'this-month'; // Default: By Month

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function formatDateInput(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatDisplayDate(d) {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Set Date Preset (Default: This Month)
    function setDatePreset(preset, triggerFilter = true) {
        activePreset = preset;
        const now = new Date();
        const fromInput = document.getElementById('log-date-from');
        const toInput = document.getElementById('log-date-to');

        if (!fromInput || !toInput) return;

        if (preset === 'this-month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            fromInput.value = formatDateInput(firstDay);
            toInput.value = formatDateInput(lastDay);
        } else if (preset === 'last-month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            fromInput.value = formatDateInput(firstDay);
            toInput.value = formatDateInput(lastDay);
        } else if (preset === 'today') {
            const todayStr = formatDateInput(now);
            fromInput.value = todayStr;
            toInput.value = todayStr;
        } else if (preset === '7days') {
            const past7 = new Date();
            past7.setDate(now.getDate() - 6);
            fromInput.value = formatDateInput(past7);
            toInput.value = formatDateInput(now);
        } else if (preset === 'all') {
            fromInput.value = '';
            toInput.value = '';
        }

        // Update active preset button highlight
        document.querySelectorAll('.date-chip').forEach(btn => {
            if (btn.getAttribute('data-range') === preset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (triggerFilter) {
            applyFilters();
        }
    }

    async function loadLogs() {
        const container = document.getElementById('logs-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                    <i class="icon-refresh-cw" style="font-size: 28px; animation: spin 1.2s linear infinite; display: inline-block; margin-bottom: 12px; color: var(--primary-color);"></i>
                    <div style="font-weight: 600; font-size: 14px;">Refreshing operation logs...</div>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            const { data, error } = await supabase.from('audit_logs')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;
            allLogs = data || [];
            applyFilters();
        } catch (e) {
            console.error('Error loading logs:', e);
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <i class="icon-alert-circle" style="font-size: 48px; color: var(--error, #EF4444); margin-bottom: 16px; display: block;"></i>
                        <div style="color: var(--text-primary); font-weight: 700; font-size: 16px; margin-bottom: 6px;">Failed to Load Logs</div>
                        <div style="color: var(--text-secondary); font-size: 13px;">${e.message || 'Check database permissions or network connection.'}</div>
                    </div>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    function applyFilters() {
        const searchInput = document.getElementById('log-search');
        const fromInput = document.getElementById('log-date-from');
        const toInput = document.getElementById('log-date-to');
        const badgeWindowText = document.getElementById('badge-window-text');
        const logCountBadge = document.getElementById('log-count-badge');
        const dateRangeCaption = document.getElementById('date-range-caption');

        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const fromVal = fromInput ? fromInput.value : '';
        const toVal = toInput ? toInput.value : '';

        const now = new Date();

        // Update badge text based on the active range
        if (badgeWindowText) {
            if (activePreset === 'this-month') {
                badgeWindowText.textContent = `THIS MONTH: ${MONTH_NAMES[now.getMonth()].toUpperCase()} ${now.getFullYear()}`;
            } else if (activePreset === 'last-month') {
                const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                badgeWindowText.textContent = `LAST MONTH: ${MONTH_NAMES[prevM.getMonth()].toUpperCase()} ${prevM.getFullYear()}`;
            } else if (activePreset === 'today') {
                badgeWindowText.textContent = `TODAY (${formatDisplayDate(now)})`;
            } else if (activePreset === '7days') {
                badgeWindowText.textContent = 'PAST 7 DAYS';
            } else if (activePreset === 'all' || (!fromVal && !toVal)) {
                badgeWindowText.textContent = 'ALL TIME';
            } else {
                badgeWindowText.textContent = `CUSTOM: ${fromVal || 'Start'} to ${toVal || 'Now'}`;
            }
        }

        if (dateRangeCaption) {
            if (fromVal && toVal) {
                const [y1, m1, d1] = fromVal.split('-').map(Number);
                const [y2, m2, d2] = toVal.split('-').map(Number);
                const dFrom = new Date(y1, m1 - 1, d1);
                const dTo = new Date(y2, m2 - 1, d2);
                dateRangeCaption.textContent = `${formatDisplayDate(dFrom)} — ${formatDisplayDate(dTo)}`;
            } else if (fromVal) {
                dateRangeCaption.textContent = `From ${fromVal} onwards`;
            } else if (toVal) {
                dateRangeCaption.textContent = `Up to ${toVal}`;
            } else {
                dateRangeCaption.textContent = 'Showing all dates';
            }
        }

        currentFilteredLogs = allLogs.filter(log => {
            // 1. Role Filter
            const rawRole = log.role || 'Admin';
            const normalizedRole = (rawRole === 'SuperAdmin' || rawRole === 'Super Admin') ? 'Super Admin' : rawRole;
            if (roleFilter !== 'All') {
                if (roleFilter === 'Super Admin' && normalizedRole !== 'Super Admin') return false;
                if (roleFilter === 'Admin' && normalizedRole !== 'Admin') return false;
                if (roleFilter === 'Student' && normalizedRole !== 'Student') return false;
            }

            // 2. Search Filter (action, user name, studentId)
            if (searchVal) {
                const action = (log.action || '').toLowerCase();
                const name = (log.userName || log.adminName || '').toLowerCase();
                const sid = (log.studentId || '').toLowerCase();
                const details = (log.details || log.metadata ? JSON.stringify(log.details || log.metadata) : '').toLowerCase();
                if (!action.includes(searchVal) && !name.includes(searchVal) && !sid.includes(searchVal) && !details.includes(searchVal)) {
                    return false;
                }
            }

            // 3. Date Range Filter
            if (fromVal || toVal) {
                if (!log.timestamp) return false;
                const logDate = new Date(log.timestamp);
                if (isNaN(logDate.getTime())) return false;

                if (fromVal) {
                    const [y1, m1, d1] = fromVal.split('-').map(Number);
                    const fromDate = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
                    if (logDate < fromDate) return false;
                }

                if (toVal) {
                    const [y2, m2, d2] = toVal.split('-').map(Number);
                    const toDate = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
                    if (logDate > toDate) return false;
                }
            }

            return true;
        });

        // Update count badge
        if (logCountBadge) {
            logCountBadge.textContent = `${currentFilteredLogs.length} of ${allLogs.length} logs`;
        }

        renderList(currentFilteredLogs);
    }

    function renderList(logs) {
        const container = document.getElementById('logs-container');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <i class="icon-search" style="font-size: 44px; color: var(--text-secondary); opacity: 0.35; margin-bottom: 16px; display: block;"></i>
                    <div style="color: var(--text-primary); font-weight: 700; font-size: 15px; margin-bottom: 6px;">No logs match your filter</div>
                    <div style="color: var(--text-secondary); font-size: 13px; max-width: 380px; margin: 0 auto 16px;">
                        Try selecting "All Time" or picking a broader date range to review historical entries.
                    </div>
                    <button class="btn btn-secondary" onclick="window.setDatePresetAndFilter('all')" style="padding: 8px 16px; font-size: 12px; font-weight: 700; border-radius: 10px; cursor: pointer;">
                        Show All Time Logs
                    </button>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = logs.map(log => {
            const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }) : 'N/A';

            const name = log.userName || log.adminName || 'System User';
            const rawRole = log.role || 'Admin';
            const role = (rawRole === 'SuperAdmin' || rawRole === 'Super Admin') ? 'Super Admin' : rawRole;
            const action = log.action || 'Performed system activity';
            const studentId = log.studentId ? `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: rgba(0,0,0,0.04); border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace; color: var(--text-primary);"><i class="icon-user" style="font-size: 10px;"></i>ID: ${log.studentId}</span>` : '';

            const isSuper = role === 'Super Admin';
            const isAdmin = role === 'Admin';
            const isStudent = role === 'Student';

            let iconName = 'icon-user';
            let iconColor = 'var(--text-secondary)';
            let badgeBg = 'rgba(0,0,0,0.05)';

            if (isSuper) {
                iconName = 'icon-shield-check';
                iconColor = '#D4AF37'; // Gold
                badgeBg = 'rgba(212, 175, 55, 0.14)';
            } else if (isAdmin) {
                iconName = 'icon-shield';
                iconColor = 'var(--primary-color, #0F3260)';
                badgeBg = 'rgba(15, 50, 96, 0.1)';
            } else if (isStudent) {
                iconName = 'icon-graduation-cap';
                iconColor = '#10B981'; // Emerald
                badgeBg = 'rgba(16, 185, 129, 0.12)';
            }

            return `
                <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px; align-items: flex-start; transition: background 0.15s;" onmouseover="this.style.background='rgba(0,0,0,0.015)'" onmouseout="this.style.background='transparent'">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: ${badgeBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="${iconName}" style="font-size: 20px; color: ${iconColor};"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-size: 14px; font-weight: 800; color: var(--text-primary);">${name}</span>
                                <span style="padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; background: ${badgeBg}; color: ${iconColor};">${role}</span>
                                ${studentId}
                            </div>
                            <div style="font-size: 11.5px; color: var(--text-secondary); font-weight: 600; display: flex; align-items: center; gap: 5px;">
                                <i class="icon-clock" style="font-size: 12px;"></i> ${timeStr}
                            </div>
                        </div>
                        <div style="font-size: 13.5px; color: var(--text-primary); font-weight: 500; line-height: 1.45; word-break: break-word;">${action}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // Export Filtered Logs to CSV
    function exportAuditLogsCsv() {
        if (!currentFilteredLogs || currentFilteredLogs.length === 0) {
            alert('No logs currently match your filter to export.');
            return;
        }

        const headers = ['Timestamp', 'User Name', 'Role', 'Student ID', 'Action'];
        const rows = currentFilteredLogs.map(log => {
            const time = log.timestamp ? new Date(log.timestamp).toISOString() : '';
            const name = (log.userName || log.adminName || '').replace(/"/g, '""');
            const role = (log.role || 'Admin').replace(/"/g, '""');
            const sid = (log.studentId || '').replace(/"/g, '""');
            const action = (log.action || '').replace(/"/g, '""');
            return `"${time}","${name}","${role}","${sid}","${action}"`;
        });

        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `ScholarDoc_Audit_Logs_${activePreset}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Bind Event Listeners
    const searchEl = document.getElementById('log-search');
    if (searchEl) {
        searchEl.addEventListener('input', applyFilters);
    }

    const dateFromEl = document.getElementById('log-date-from');
    const dateToEl = document.getElementById('log-date-to');

    function onCustomDateChanged() {
        activePreset = 'custom';
        document.querySelectorAll('.date-chip').forEach(b => b.classList.remove('active'));
        applyFilters();
    }

    if (dateFromEl) dateFromEl.addEventListener('change', onCustomDateChanged);
    if (dateToEl) dateToEl.addEventListener('change', onCustomDateChanged);

    const resetDateBtn = document.getElementById('reset-date-btn');
    if (resetDateBtn) {
        resetDateBtn.addEventListener('click', () => {
            setDatePreset('this-month');
        });
    }

    document.querySelectorAll('.date-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const range = chip.getAttribute('data-range');
            if (range) {
                setDatePreset(range);
            }
        });
    });

    document.querySelectorAll('.role-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            roleFilter = chip.getAttribute('data-role') || 'All';
            applyFilters();
        });
    });

    // Expose helpers globally for inline onclick handlers
    window.loadLogs = loadLogs;
    window.exportAuditLogsCsv = exportAuditLogsCsv;
    window.setDatePresetAndFilter = (preset) => setDatePreset(preset);

    // Initialize: Default to "This Month" and fetch logs
    setDatePreset('this-month', false);
    loadLogs();
})();
