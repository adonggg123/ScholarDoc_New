// js/views/dashboard.js
const supabase = window.supabaseClient;

// Setup Header & Calendar Week Widget
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

    const greetingTextEl = document.getElementById('greeting-text');
    const greetingIconEl = document.getElementById('greeting-icon');
    if (greetingTextEl) greetingTextEl.textContent = greeting;
    if (greetingIconEl) greetingIconEl.className = `icon-${icon}`;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);

    // Calendar Week View Setup
    const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const calMonthEl = document.getElementById('cal-month');
    if (calMonthEl) calMonthEl.textContent = currentMonthLabel;

    // Calculate start of week (Sunday)
    const currentDay = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekStartStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndStr = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const calWeekEl = document.getElementById('cal-week');
    if (calWeekEl) calWeekEl.textContent = `Week of ${weekStartStr} – ${weekEndStr}`;

    const todayStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const calTodayEl = document.getElementById('cal-today-label');
    if (calTodayEl) calTodayEl.textContent = `Today: ${todayStr}`;

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
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--primary-color);">${dayName}</span>
                        <div class="dash-cal-today-circle">
                            ${dayDate}
                            <div class="dash-cal-dot"></div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${dayName}</span>
                        <div class="dash-cal-day-circle">
                            ${dayDate}
                        </div>
                    </div>
                `;
            }
        }
        daysRow.innerHTML = html;
    }
}

// Fetch and render stats with animated count-up and ratio chips
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
            else if (status === 'rejected' || status === 'flagged') rejected++;
        });

        // Set text numbers
        animateCounter('stat-total', total);
        animateCounter('stat-pending', pending);
        animateCounter('stat-approved', approved);
        animateCounter('stat-rejected', rejected);

        // Update ratio chips
        const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
        const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
        const rejectedPct = total > 0 ? Math.round((rejected / total) * 100) : 0;

        const totalBadge = document.getElementById('stat-total-badge');
        if (totalBadge) totalBadge.textContent = `${total} Total`;

        const pendingBadge = document.getElementById('stat-pending-badge');
        if (pendingBadge) pendingBadge.textContent = `${pendingPct}% Queue`;

        const approvedBadge = document.getElementById('stat-approved-badge');
        if (approvedBadge) approvedBadge.textContent = `${approvedPct}% Verified`;

        const rejectedBadge = document.getElementById('stat-rejected-badge');
        if (rejectedBadge) rejectedBadge.textContent = `${rejectedPct}% Flagged`;

        // Update progress bars
        const barPending = document.getElementById('bar-pending');
        if (barPending) barPending.style.width = `${pendingPct}%`;

        const barApproved = document.getElementById('bar-approved');
        if (barApproved) barApproved.style.width = `${approvedPct}%`;

        const barRejected = document.getElementById('bar-rejected');
        if (barRejected) barRejected.style.width = `${rejectedPct}%`;

        renderStatusDistribution(total, pending, approved, rejected);
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

// Counter animation helper
function animateCounter(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const start = 0;
    const duration = 600;
    const startTime = performance.now();

    function update(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(progress * targetValue);
        el.textContent = current;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = targetValue;
        }
    }
    requestAnimationFrame(update);
}

// Render Status Distribution Donut Chart
function renderStatusDistribution(total, pending, approved, rejected) {
    const ctx = document.getElementById('statusPieChart');
    const noData = document.getElementById('pie-no-data');
    const legend = document.getElementById('pie-legend');
    if (!ctx || !noData || !legend) return;

    if (total === 0) {
        ctx.style.display = 'none';
        noData.style.display = 'block';
        legend.innerHTML = `
            <div class="dash-legend-pill approved"><span class="dash-legend-dot"></span> Approved 0%</div>
            <div class="dash-legend-pill pending"><span class="dash-legend-dot"></span> Pending 0%</div>
            <div class="dash-legend-pill flagged"><span class="dash-legend-dot"></span> Flagged 0%</div>
        `;
        return;
    }

    ctx.style.display = 'block';
    noData.style.display = 'none';

    if (window.statusPieChartInstance) {
        window.statusPieChartInstance.destroy();
        window.statusPieChartInstance = null;
    }

    const appPct = Math.round((approved / total) * 100);
    const penPct = Math.round((pending / total) * 100);
    const rejPct = Math.round((rejected / total) * 100);

    const isDark = document.body.classList.contains('dark');
    const borderCol = isDark ? '#1E293B' : '#FFFFFF';

    const data = {
        labels: ['Approved', 'Pending', 'Flagged'],
        datasets: [{
            data: [approved, pending, rejected],
            backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
            borderWidth: 2,
            borderColor: borderCol,
            hoverOffset: 6
        }]
    };

    window.statusPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            cutout: '72%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#0A1E3F',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const pct = Math.round((value / total) * 100);
                            return ` ${context.label}: ${value} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    legend.innerHTML = `
        <div class="dash-legend-pill approved"><span class="dash-legend-dot"></span> Approved ${appPct}%</div>
        <div class="dash-legend-pill pending"><span class="dash-legend-dot"></span> Pending ${penPct}%</div>
        <div class="dash-legend-pill flagged"><span class="dash-legend-dot"></span> Flagged ${rejPct}%</div>
    `;
}

// Fetch and render Recent Activity Audit Logs
async function loadActivity() {
    try {
        const { data: logs, error } = await supabase.from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);
        
        if (error) throw error;

        const container = document.getElementById('activity-list');
        if (!container) return;

        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 12px;">
                    <i class="icon-check-circle" style="font-size: 24px; color: var(--success); opacity: 0.6; display: block; margin: 0 auto 8px;"></i>
                    No recent activity records logged.
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = logs.map(log => {
            const action = log.action || 'Administrative action';
            const name = log.userName || log.adminName || 'Admin';
            
            // Format time difference
            let timeStr = 'Just now';
            if (log.timestamp) {
                const diffMin = Math.floor((new Date() - new Date(log.timestamp)) / 60000);
                if (diffMin >= 1440) timeStr = `${Math.floor(diffMin / 1440)}d ago`;
                else if (diffMin >= 60) timeStr = `${Math.floor(diffMin / 60)}h ago`;
                else if (diffMin > 0) timeStr = `${diffMin}m ago`;
            }

            // Determine action icon & color
            let iconClass = 'icon-shield-check';
            let iconColor = 'var(--primary-color)';
            let iconBg = 'rgba(15, 50, 96, 0.08)';

            const actionLower = action.toLowerCase();
            if (actionLower.includes('login') || actionLower.includes('sign in')) {
                iconClass = 'icon-log-in';
                iconColor = '#3B82F6';
                iconBg = 'rgba(59, 130, 246, 0.12)';
            } else if (actionLower.includes('approv') || actionLower.includes('verif')) {
                iconClass = 'icon-check-circle-2';
                iconColor = '#10B981';
                iconBg = 'rgba(16, 185, 129, 0.12)';
            } else if (actionLower.includes('reject') || actionLower.includes('flag')) {
                iconClass = 'icon-alert-triangle';
                iconColor = '#EF4444';
                iconBg = 'rgba(239, 68, 68, 0.12)';
            } else if (actionLower.includes('import') || actionLower.includes('masterlist')) {
                iconClass = 'icon-file-spreadsheet';
                iconColor = '#8B5CF6';
                iconBg = 'rgba(139, 92, 246, 0.12)';
            } else if (actionLower.includes('announc') || actionLower.includes('broadcast')) {
                iconClass = 'icon-megaphone';
                iconColor = '#EC4899';
                iconBg = 'rgba(236, 72, 153, 0.12)';
            }

            return `
                <div class="dash-activity-item">
                    <div class="dash-activity-icon-box" style="background: ${iconBg}; border-color: ${iconColor};">
                        <i class="${iconClass}" style="font-size: 13px; color: ${iconColor};"></i>
                    </div>
                    <div style="flex: 1; padding-top: 1px;">
                        <p style="margin: 0 0 3px 0; font-size: 12px; line-height: 1.4; color: var(--text-primary);">
                            <strong>${name}</strong> <span style="color: var(--text-secondary); font-weight: 500;">${action}</span>
                        </p>
                        <span style="font-size: 10px; color: var(--text-secondary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="icon-clock" style="font-size: 10px; opacity: 0.7;"></i> ${timeStr}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('Error loading activity:', e);
    }
}

// Fetch and render Priority Pending Applications
async function loadPending() {
    try {
        const { data: students, error } = await supabase.from('students')
            .select('uid, fullName, course, year, createdAt')
            .eq('status', 'Pending')
            .order('createdAt', { ascending: false })
            .limit(4);
        
        if (error) throw error;

        const container = document.getElementById('pending-list');
        if (!container) return;

        if (!students || students.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 28px 16px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                        <i class="icon-check-circle" style="font-size: 22px; color: var(--success);"></i>
                    </div>
                    <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: var(--text-primary);">All Caught Up!</p>
                    <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">No pending student applications in queue.</p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = students.map(s => {
            const name = s.fullName || 'Unknown Applicant';
            const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ST';
            const course = s.course || 'General';
            const year = s.year ? `Yr ${s.year}` : '1st Year';

            let timeAgo = '';
            if (s.createdAt) {
                const diffDays = Math.floor((new Date() - new Date(s.createdAt)) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) timeAgo = ` • ${diffDays}d ago`;
                else timeAgo = ' • Today';
            }

            return `
                <div class="dash-pending-item">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="dash-avatar-circle">
                            ${initials}
                        </div>
                        <div>
                            <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 700; color: var(--text-primary);">${name}</p>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary); font-weight: 500;">
                                ${course} • ${year} <span style="opacity: 0.75;">${timeAgo}</span>
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="dash-badge-pending">PENDING</span>
                        <button class="dash-review-btn" onclick="document.querySelector('.nav-item[data-view=\\'student_records\\']')?.click()">
                            Review <i class="icon-chevron-right" style="font-size: 11px;"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('Error loading pending:', e);
    }
}

// Render Trend Chart with real data and gradients
async function renderChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (window.activeTrendChart) {
        window.activeTrendChart.destroy();
        window.activeTrendChart = null;
    }

    const isDark = document.body.classList.contains('dark');
    const primaryColor = isDark ? '#60A5FA' : '#0F3260';
    const textColor = isDark ? '#94A3B8' : '#6B7280';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

    try {
        const { data: students, error } = await supabase.from('students').select('createdAt, status');
        if (error) throw error;

        const now = new Date();
        const year = now.getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const submissionsByMonth = new Array(12).fill(0);
        const approvedByMonth = new Array(12).fill(0);

        let totalYearSubmissions = 0;

        (students || []).forEach(s => {
            if (!s.createdAt) return;
            const d = new Date(s.createdAt);
            if (d.getFullYear() === year) {
                const m = d.getMonth();
                submissionsByMonth[m]++;
                totalYearSubmissions++;
                const status = (s.status || '').toLowerCase();
                if (status === 'verified' || status === 'approved') {
                    approvedByMonth[m]++;
                }
            }
        });

        const summaryPill = document.getElementById('trend-summary-pill');
        if (summaryPill) {
            summaryPill.textContent = `${totalYearSubmissions} YTD Submissions`;
        }

        // Create linear canvas gradient for submissions
        const chartCtx = ctx.getContext('2d');
        const gradientSub = chartCtx.createLinearGradient(0, 0, 0, 240);
        gradientSub.addColorStop(0, isDark ? 'rgba(96, 165, 250, 0.28)' : 'rgba(15, 50, 96, 0.22)');
        gradientSub.addColorStop(1, isDark ? 'rgba(96, 165, 250, 0.01)' : 'rgba(15, 50, 96, 0.01)');

        const gradientApp = chartCtx.createLinearGradient(0, 0, 0, 240);
        gradientApp.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        gradientApp.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

        window.activeTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'All Submissions',
                        data: submissionsByMonth,
                        borderColor: primaryColor,
                        backgroundColor: gradientSub,
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: primaryColor,
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 1.5,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Approved Grants',
                        data: approvedByMonth,
                        borderColor: '#10B981',
                        backgroundColor: gradientApp,
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#10B981',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 1.5,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'bottom', 
                        labels: { 
                            color: textColor, 
                            font: { size: 11, weight: '600', family: 'Inter' },
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 16
                        } 
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1E293B' : '#0A1E3F',
                        titleColor: '#FFFFFF',
                        bodyColor: '#FFFFFF',
                        padding: 10,
                        cornerRadius: 8,
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: 10 } }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 10 } }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error building trend chart:', e);
    }

    if (window.trendChartThemeListener) {
        window.removeEventListener('themechanged', window.trendChartThemeListener);
    }
    window.trendChartThemeListener = () => {
        renderChart();
    };
    window.addEventListener('themechanged', window.trendChartThemeListener);
}

// Initialize Dashboard
setupHeader();
loadStats();
loadActivity();
loadPending();
renderChart();
