// js/views/audit_logs.js
const supabase = window.supabaseClient;

let allLogs = [];
let roleFilter = 'All';

async function loadLogs() {
    try {
        const { data, error } = await supabase.from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;
        allLogs = data || [];
        applyFilters();
    } catch (e) {
        console.error('Error loading logs:', e);
        document.getElementById('logs-container').innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <i class="icon-alert-circle" style="font-size: 48px; color: var(--error); margin-bottom: 16px; display: block;"></i>
                <div style="color: var(--text-secondary);">Permission Denied or Error loading logs</div>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

function applyFilters() {
    const searchVal = document.getElementById('log-search').value.toLowerCase();
    const dateVal = document.getElementById('log-date').value; // YYYY-MM-DD
    
    // Toggle the 24H badge and clear button
    const badge24h = document.getElementById('filter-badge-24h');
    const btnClearDate = document.getElementById('clear-date-btn');
    if (dateVal) {
        badge24h.style.display = 'none';
        btnClearDate.style.display = 'block';
    } else {
        badge24h.style.display = 'flex';
        btnClearDate.style.display = 'none';
    }

    const now = new Date();
    
    const filtered = allLogs.filter(log => {
        // 1. Role Filter
        const r = log.role || 'Admin';
        if (roleFilter !== 'All' && r !== roleFilter) return false;

        // 2. Search Filter
        if (searchVal) {
            const action = (log.action || '').toLowerCase();
            const name = (log.adminName || '').toLowerCase();
            const sid = (log.studentId || '').toLowerCase();
            if (!action.includes(searchVal) && !name.includes(searchVal) && !sid.includes(searchVal)) {
                return false;
            }
        }

        // 3. Date Filter
        if (dateVal) {
            // Match exact calendar day
            if (!log.timestamp) return false;
            const logDate = new Date(log.timestamp);
            const targetDate = new Date(dateVal); // parses as UTC/local depending on browser, safe enough for YYYY-MM-DD
            if (logDate.getFullYear() !== targetDate.getFullYear() || 
                logDate.getMonth() !== targetDate.getMonth() || 
                logDate.getDate() !== targetDate.getDate()) {
                return false;
            }
        } else {
            // Default: 24h window
            if (!log.timestamp) return true; // keep old if no timestamp
            const logDate = new Date(log.timestamp);
            const diffHours = (now - logDate) / (1000 * 60 * 60);
            if (diffHours > 24) return false;
        }

        return true;
    });

    renderList(filtered);
}

function renderList(logs) {
    const container = document.getElementById('logs-container');
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <i class="icon-search" style="font-size: 48px; color: rgba(0,0,0,0.2); margin-bottom: 16px; display: block;"></i>
                <div style="color: var(--text-secondary);">No matching activity logs found.</div>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = logs.map(log => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
        const name = log.adminName || 'Admin User';
        const role = log.role || 'Admin';
        const action = log.action || 'Performed an action';

        return `
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px; align-items: flex-start;">
                <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(15, 50, 96, 0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="${role === 'Admin' ? 'icon-shield-check' : 'icon-user'}" style="font-size: 20px; color: var(--primary-color);"></i>
                </div>
                <div>
                    <div style="font-size: 14px; font-weight: 700;">${name} <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">(${role})</span></div>
                    <div style="font-size: 13px; margin: 4px 0;">${action}</div>
                    <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <i class="icon-clock" style="font-size: 12px;"></i> ${time}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// Event Listeners
document.getElementById('log-search').addEventListener('input', applyFilters);
document.getElementById('log-date').addEventListener('change', applyFilters);

document.getElementById('clear-date-btn').addEventListener('click', () => {
    document.getElementById('log-date').value = '';
    applyFilters();
});

document.querySelectorAll('.role-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        roleFilter = e.target.getAttribute('data-role');
        applyFilters();
    });
});

window.loadLogs = loadLogs;

// Init
loadLogs();
