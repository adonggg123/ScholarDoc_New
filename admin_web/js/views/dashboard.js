// js/views/dashboard.js
const supabase = window.supabaseClient;

// Setup Header
function setupHeader() {
    const now = new Date();
    const hour = now.getHours();
    
    let greeting = 'Good Evening';
    let icon = 'moon-star';
    if (hour < 12) {
        greeting = 'Good Morning';
        icon = 'sunrise';
    } else if (hour < 17) {
        greeting = 'Good Afternoon';
        icon = 'sun';
    }

    document.getElementById('greeting-text').textContent = greeting;
    document.getElementById('greeting-icon').className = `icon-${icon}`;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);

    // Calendar Week View Setup
    const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const calMonthEl = document.getElementById('cal-month');
    if (calMonthEl) calMonthEl.textContent = currentMonthLabel;

    // Calculate start of week (Sunday)
    const currentDay = now.getDay(); // 0 is Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekStartStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndStr = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const calWeekEl = document.getElementById('cal-week');
    if (calWeekEl) calWeekEl.textContent = `Week of ${weekStartStr} – ${weekEndStr}`;

    const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const calTodayEl = document.getElementById('cal-today-label');
    if (calTodayEl) calTodayEl.textContent = `Today — ${todayStr}`;

    const daysRow = document.getElementById('cal-days-row');
    if (daysRow) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '';

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dayName = days[i];
            const dayDate = d.getDate();
            const isToday = d.toDateString() === now.toDateString();

            if (isToday) {
                html += `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--primary-color);">${dayName}</span>
                        <div style="width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #0F3260, #D4AF37); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; position: relative; box-shadow: 0 4px 10px rgba(15,50,96,0.3);">
                            ${dayDate}
                            <div style="position: absolute; bottom: -8px; width: 4px; height: 4px; border-radius: 50%; background: var(--primary-color);"></div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${dayName}</span>
                        <div style="width: 36px; height: 36px; border-radius: 12px; background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">
                            ${dayDate}
                        </div>
                    </div>
                `;
            }
        }
        daysRow.innerHTML = html;
    }
}

// Fetch and render stats
async function loadStats() {
    try {
        const { data: students, error } = await supabase.from('students').select('status');
        if (error) throw error;

        let total = students.length;
        let pending = 0;
        let approved = 0;
        let rejected = 0;

        students.forEach(s => {
            const status = (s.status || '').toLowerCase();
            if (status === 'pending') pending++;
            else if (status === 'verified' || status === 'approved') approved++;
            else if (status === 'rejected') rejected++;
        });

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-approved').textContent = approved;
        const rejectedEl = document.getElementById('stat-rejected');
        if (rejectedEl) rejectedEl.textContent = rejected;

        renderStatusDistribution(total, pending, approved, students);
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

// Render Status Distribution Bars
function renderStatusDistribution(total, pending, approved, allStudents) {
    const missing = total - (pending + approved); // Rejected or missing

    const ctx = document.getElementById('statusPieChart');
    const noData = document.getElementById('pie-no-data');
    const legend = document.getElementById('pie-legend');
    if (!ctx || !noData || !legend) return;

    if (total === 0) {
        ctx.style.display = 'none';
        noData.style.display = 'block';
        legend.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #4CAF50;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Approved</span></div>
            <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #FFC107;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Pending</span></div>
            <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #F44336;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Rejected</span></div>
        `;
        return;
    }

    ctx.style.display = 'block';
    noData.style.display = 'none';

    if (window.statusPieChartInstance) {
        window.statusPieChartInstance.destroy();
    }

    const data = {
        labels: ['Approved', 'Pending', 'Rejected'],
        datasets: [{
            data: [approved, pending, missing],
            backgroundColor: ['#4CAF50', '#FFC107', '#F44336'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    window.statusPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const pct = Math.round((value / total) * 100);
                            return ` ${context.label}: ${pct}%`;
                        }
                    }
                }
            }
        }
    });

    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #4CAF50;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Approved</span></div>
        <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #FFC107;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Pending</span></div>
        <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #F44336;"></div><span style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Rejected</span></div>
    `;
}

// Fetch Recent Activity
async function loadActivity() {
    try {
        const { data: logs, error } = await supabase.from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);
        if (error) throw error;

        const container = document.getElementById('activity-list');
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 12px;">No recent activity</div>';
            return;
        }

        container.innerHTML = logs.map(log => {
            const action = log.action || 'Unknown Action';
            const name = log.userName || log.adminName || 'Admin';
            let timeStr = 'Just now';
            if(log.timestamp) {
                const diff = Math.floor((new Date() - new Date(log.timestamp)) / 60000);
                if (diff > 60) timeStr = `${Math.floor(diff/60)}h ago`;
                else if (diff > 0) timeStr = `${diff}m ago`;
            }

            return `
                <div style="display: flex; gap: 12px; position: relative; z-index: 1;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--surface-color); border: 2px solid var(--primary-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="icon-shield-check" style="font-size: 14px; color: var(--primary-color);"></i>
                    </div>
                    <div style="padding-top: 4px;">
                        <p style="margin: 0 0 2px 0; font-size: 12px; line-height: 1.4;"><strong>${name}</strong> <span style="color: var(--text-secondary);">${action}</span></p>
                        <span style="font-size: 10px; color: var(--text-secondary); font-weight: 600;">${timeStr}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('Error loading activity:', e);
    }
}

// Fetch Pending Applications
async function loadPending() {
    try {
        const { data: students, error } = await supabase.from('students')
            .select('uid, fullName, course, year')
            .eq('status', 'Pending')
            .order('createdAt', { ascending: false })
            .limit(4);
        
        if (error) throw error;

        const container = document.getElementById('pending-list');
        if (!students || students.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 10px;">
                    <i class="icon-check-circle" style="font-size: 32px; color: var(--success); opacity: 0.5; margin-bottom: 8px;"></i>
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">All caught up! No pending applications.</p>
                </div>`;
            return;
        }

        container.innerHTML = students.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(15, 50, 96, 0.05); display: flex; align-items: center; justify-content: center;">
                        <i class="icon-user" style="color: var(--primary-color); font-size: 16px;"></i>
                    </div>
                    <div>
                        <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 700;">${s.fullName || 'Unknown'}</p>
                        <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">${s.course || 'N/A'} - ${s.year || 'N/A'}</p>
                    </div>
                </div>
                <span style="font-size: 10px; font-weight: bold; color: #F57F17; background: rgba(251, 192, 45, 0.1); padding: 4px 8px; border-radius: 12px;">PENDING</span>
            </div>
        `).join('');

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('Error loading pending:', e);
    }
}

// Render Trend Chart with real data
async function renderChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    try {
        const { data: students, error } = await supabase.from('students').select('createdAt, status');
        if (error) throw error;

        const now = new Date();
        const year = now.getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const submissionsByMonth = new Array(12).fill(0);
        const approvedByMonth = new Array(12).fill(0);

        (students || []).forEach(s => {
            if (!s.createdAt) return;
            const d = new Date(s.createdAt);
            if (d.getFullYear() === year) {
                const m = d.getMonth();
                submissionsByMonth[m]++;
                const status = (s.status || '').toLowerCase();
                if (status === 'verified' || status === 'approved') {
                    approvedByMonth[m]++;
                }
            }
        });

        // Only show months up to current month
        const currentMonth = now.getMonth();
        const labels = months.slice(0, currentMonth + 1);
        const submissionsData = submissionsByMonth.slice(0, currentMonth + 1);
        const approvedData = approvedByMonth.slice(0, currentMonth + 1);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Submissions',
                        data: submissionsData,
                        borderColor: '#0F3260',
                        backgroundColor: 'rgba(15, 50, 96, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Approved',
                        data: approvedData,
                        borderColor: '#43A047',
                        backgroundColor: 'rgba(67, 160, 71, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) {
        console.error('Error building trend chart:', e);
        // Fallback to dummy data
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Submissions',
                    data: [12, 19, 15, 25, 22, 30],
                    borderColor: '#0F3260',
                    backgroundColor: 'rgba(15, 50, 96, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// Init
setupHeader();
loadStats();
loadActivity();
loadPending();
renderChart();

