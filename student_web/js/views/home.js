// ScholarDoc Student Web — Home Dashboard View Logic
// Mirrors home_screen.dart

const sb = window.supabaseClient;
const profile = window.currentStudentProfile || {
    fullName: 'Jude Student',
    studentId: '2024-00123',
    scholarshipName: 'TES Scholarship',
    status: 'Verified',
    course: 'BS Information Technology',
    year: '3rd Year',
    submittedAt: new Date().toISOString()
};
const uid = window.currentStudentUid;

// ─── Dynamic Time Greeting ───
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

const greetingEl = document.getElementById('home-greeting');
const nameEl = document.getElementById('home-name');
const badgeContainer = document.getElementById('home-badge-container');
const avatarEl = document.getElementById('home-avatar');

if (greetingEl) greetingEl.textContent = getGreeting().toUpperCase();

const currentProf = window.currentStudentProfile || profile;
if (currentProf) {
    const firstName = (currentProf.fullName || 'Student').split(' ')[0];
    if (nameEl) nameEl.textContent = `${firstName}!`;

    // Verification badge
    const status = currentProf.status || 'Verified';
    let badgeClass = 'badge-success', badgeIcon = 'badge-check', badgeText = 'Verified Scholar';
    if (status === 'Pending') {
        badgeClass = 'badge-pending'; badgeIcon = 'hourglass'; badgeText = 'Pending Approval';
    } else if (status === 'Rejected' || status === 'Needs Correction') {
        badgeClass = 'badge-danger'; badgeIcon = 'alert-triangle'; badgeText = 'Needs Correction';
    }

    if (badgeContainer) {
        badgeContainer.innerHTML = `
            <span class="badge ${badgeClass}">
                <i data-lucide="${badgeIcon}"></i> ${badgeText}
            </span>
        `;
    }

    // Avatar
    const photoUrl = currentProf.profilePictureUrl;
    if (photoUrl && avatarEl) {
        avatarEl.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
}

// ─── Scholarship Status Card ───
function renderStatusCard() {
    const card = document.getElementById('scholarship-status-card');
    if (!card) return;

    const prof = window.currentStudentProfile || profile;
    const scholarshipName = prof?.scholarshipName || 'TES Scholarship Program';
    const status = prof?.status || 'Verified';
    const submittedDate = prof?.submittedAt 
        ? new Date(prof.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    let badgeClass = 'badge-success', statusIcon = 'badge-check';
    if (status === 'Pending') {
        badgeClass = 'badge-pending'; statusIcon = 'hourglass';
    } else if (status === 'Rejected' || status === 'Needs Correction') {
        badgeClass = 'badge-danger'; statusIcon = 'alert-triangle';
    }

    card.innerHTML = `
        <div style="padding: 20px 22px; border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div>
                    <div style="font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 1.2px; text-transform: uppercase;">SCHOLARSHIP PROGRAM</div>
                    <div style="font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: var(--primary); margin-top: 3px; letter-spacing: -0.2px;">${scholarshipName}</div>
                </div>
                <span class="badge ${badgeClass}">
                    <i data-lucide="${statusIcon}"></i> ${status}
                </span>
            </div>
        </div>
        <div style="padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; background: var(--bg-alt);">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i data-lucide="clock" style="width: 15px; height: 15px; color: var(--text-tertiary);"></i>
                <span style="font-size: 12px; color: var(--text-secondary);">Last Synced</span>
            </div>
            <span style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">${submittedDate}</span>
        </div>
    `;
    
    if (window.lucide) window.lucide.createIcons();
}

document.getElementById('status-loading')?.remove();
renderStatusCard();

// ─── Calendar Week Strip ───
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    const monthEl = document.getElementById('calendar-month');
    if (!container) return;

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sun
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (monthEl) monthEl.textContent = `${months[today.getMonth()]} ${today.getFullYear()}`;

    container.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const isToday = day.toDateString() === today.toDateString();

        const el = document.createElement('div');
        el.className = `calendar-day ${isToday ? 'today' : ''}`;
        el.innerHTML = `
            <span class="calendar-day-name">${dayNames[i]}</span>
            <span class="calendar-day-num">${day.getDate()}</span>
            ${isToday ? '<div style="width: 4px; height: 4px; border-radius: 50%; background: var(--gold); margin-top: 2px;"></div>' : ''}
        `;
        container.appendChild(el);
    }
}

renderCalendar();

// ─── Carousel Banner ───
let currentSlide = 0;
const totalSlides = 3;
const track = document.getElementById('carousel-track');
const dots = document.querySelectorAll('.carousel-dot');

function goToSlide(index) {
    currentSlide = index;
    if (track) track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => {
        dot.style.opacity = i === index ? '1' : '0.4';
        dot.classList.toggle('active', i === index);
    });
}

dots.forEach(dot => {
    dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.index)));
});

// Auto-advance carousel
setInterval(() => {
    goToSlide((currentSlide + 1) % totalSlides);
}, 5000);

// ─── Announcements Feed ───
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (!container) return;

    try {
        let items = [];
        if (sb) {
            const { data, error } = await sb
                .from('announcements')
                .select()
                .eq('isActive', true)
                .order('createdAt', { ascending: false })
                .limit(4);
            if (!error && data && data.length > 0) items = data;
        }

        if (items.length === 0) {
            items = [
                {
                    type: 'Update',
                    title: '1st Semester TES Grant Billing Verification Ongoing',
                    content: 'Please ensure your Savings Account number and uploaded ID back cards are clear and up to date for billing review.',
                    createdAt: new Date().toISOString()
                },
                {
                    type: 'Deadline',
                    title: 'Final Document Submission Deadline for 2026 Scholars',
                    content: 'All scholars must complete their requirement submissions and digital signatures before the end of the month.',
                    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
                }
            ];
        }

        container.innerHTML = items.map(a => {
            let badgeClass = 'badge-info', typeIcon = 'bell-ring';
            if (a.type === 'Deadline') { badgeClass = 'badge-danger'; typeIcon = 'calendar-range'; }
            if (a.type === 'Update') { badgeClass = 'badge-success'; typeIcon = 'bell-ring'; }

            const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

            return `
                <div class="card" style="margin-bottom: 12px; cursor: pointer; transition: all 0.2s ease;" onclick="this.querySelector('.announcement-content').classList.toggle('hidden')">
                    <div class="card-body" style="padding: 16px 20px;">
                        <div style="display: flex; align-items: flex-start; gap: 14px;">
                            <div style="width: 38px; height: 38px; border-radius: var(--radius-lg); background: var(--bg-alt); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="${typeIcon}" style="width: 17px; height: 17px; color: var(--primary);"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <span class="badge ${badgeClass}" style="padding: 2px 8px; font-size: 9.5px;">${a.type || 'General'}</span>
                                    <span style="font-size: 11px; color: var(--text-tertiary);">•</span>
                                    <span style="font-size: 11.5px; color: var(--text-secondary); font-weight: 500;">${date}</span>
                                </div>
                                <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.1px;">${a.title || ''}</div>
                                <div class="announcement-content hidden" style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">${a.content || ''}</div>
                            </div>
                            <i data-lucide="chevron-down" style="width: 16px; height: 16px; color: var(--text-tertiary); flex-shrink: 0; margin-top: 2px;"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();

    } catch (err) {
        console.error('Error loading announcements:', err);
    }
}

loadAnnouncements();

// Re-initialize Lucide icons
if (window.lucide) window.lucide.createIcons();
