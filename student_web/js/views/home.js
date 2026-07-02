// ScholarDoc Student Web — Home Dashboard View Logic
// Mirrors home_screen.dart

const sb = window.supabaseClient;
const profile = window.currentStudentProfile;
const uid = window.currentStudentUid;

// ─── Greeting ───
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

if (profile) {
    const firstName = (profile.fullName || 'Student').split(' ')[0];
    if (nameEl) nameEl.textContent = `${firstName}!`;

    // Verification badge
    const status = profile.status || 'Pending';
    let badgeColor, badgeIcon, badgeText;
    if (status === 'Approved' || status === 'Verified') {
        badgeColor = '#10B981'; badgeIcon = 'badge-check'; badgeText = 'Verified Scholar';
    } else if (status === 'Rejected' || status === 'Needs Correction') {
        badgeColor = '#EF4444'; badgeIcon = 'alert-triangle'; badgeText = 'Needs Correction';
    } else {
        badgeColor = '#F59E0B'; badgeIcon = 'hourglass'; badgeText = 'Pending Approval';
    }

    if (badgeContainer) {
        badgeContainer.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; 
                        background-color: ${badgeColor}1A; border: 1px solid ${badgeColor}40;">
                <i data-lucide="${badgeIcon}" style="width: 13px; height: 13px; color: ${badgeColor};"></i>
                <span style="font-size: 9px; font-weight: 800; color: ${badgeColor}; letter-spacing: 0.8px; text-transform: uppercase;">${badgeText}</span>
            </div>
        `;
    }

    // Avatar
    const photoUrl = profile.profilePictureUrl;
    if (photoUrl && avatarEl) {
        avatarEl.innerHTML = `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
}

// ─── Scholarship Status Card ───
function renderStatusCard() {
    const card = document.getElementById('scholarship-status-card');
    if (!card || !profile) return;

    const scholarshipName = profile.scholarshipName || 'No Scholarship Assigned';
    const status = profile.status || 'Pending';
    const submittedDate = profile.submittedAt 
        ? new Date(profile.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : (profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A');

    let statusColor = '#F59E0B', statusIcon = 'hourglass';
    if (status === 'Approved' || status === 'Verified') {
        statusColor = '#10B981'; statusIcon = 'badge-check';
    } else if (status === 'Rejected' || status === 'Needs Correction') {
        statusColor = '#EF4444'; statusIcon = 'alert-triangle';
    }

    card.innerHTML = `
        <div style="background: linear-gradient(135deg, ${statusColor}0D, ${statusColor}05); padding: 18px 22px; border-bottom: 1px solid var(--crisp-border);">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 4px; height: 36px; background: ${statusColor}; border-radius: 4px;"></div>
                <div style="flex: 1;">
                    <div style="font-size: 9px; font-weight: 800; color: var(--text-secondary); letter-spacing: 1.5px; opacity: 0.6;">SCHOLARSHIP ACCOUNT</div>
                    <div style="font-size: 18px; font-weight: 900; color: var(--primary-color); letter-spacing: -0.5px; margin-top: 4px;">${scholarshipName}</div>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; background: ${statusColor}1A;">
                    <i data-lucide="${statusIcon}" style="width: 14px; height: 14px; color: ${statusColor};"></i>
                    <span style="font-size: 12px; font-weight: 800; color: ${statusColor};">${status}</span>
                </div>
            </div>
        </div>
        <div style="padding: 14px 22px; display: flex; align-items: center; gap: 12px;">
            <div style="padding: 8px; background: var(--crisp-border); border-radius: 10px;">
                <i data-lucide="calendar-check" style="width: 16px; height: 16px; color: var(--text-secondary); opacity: 0.7;"></i>
            </div>
            <div>
                <div style="font-size: 8px; font-weight: 800; color: var(--text-secondary); letter-spacing: 0.8px; opacity: 0.5;">LAST SYNCHRONIZED</div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${submittedDate}</div>
            </div>
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
        el.style.cssText = `
            display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;
            padding: 8px 4px; border-radius: 12px; cursor: pointer; transition: all 0.2s;
            ${isToday ? 'background: linear-gradient(135deg, var(--primary-color), var(--primary-light)); box-shadow: 0 4px 12px rgba(15,50,96,0.25);' : ''}
        `;
        el.innerHTML = `
            <span style="font-size: 10px; font-weight: 600; color: ${isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)'}; text-transform: uppercase;">${dayNames[i]}</span>
            <span style="font-size: 16px; font-weight: 800; color: ${isToday ? 'white' : 'var(--text-primary)'};">${day.getDate()}</span>
            ${isToday ? '<div style="width: 4px; height: 4px; border-radius: 50%; background: #FBC02D;"></div>' : ''}
        `;
        container.appendChild(el);
    }
}

renderCalendar();

// ─── Carousel ───
let currentSlide = 0;
const totalSlides = 3;
const track = document.getElementById('carousel-track');
const dots = document.querySelectorAll('.carousel-dot');

function goToSlide(index) {
    currentSlide = index;
    if (track) track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => {
        dot.style.opacity = i === index ? '1' : '0.5';
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

// ─── Announcements ───
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (!container) return;

    try {
        const { data, error } = await sb
            .from('announcements')
            .select()
            .eq('isActive', true)
            .order('createdAt', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 32px;">
                    <i data-lucide="megaphone" style="width: 36px; height: 36px; opacity: 0.3;"></i>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">No recent updates.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = data.map(a => {
            let typeColor = '#64748B', typeIcon = 'info';
            if (a.type === 'Deadline') { typeColor = '#EF4444'; typeIcon = 'calendar-range'; }
            if (a.type === 'Update') { typeColor = '#10B981'; typeIcon = 'bell-ring'; }

            const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

            return `
                <div class="card" style="margin-bottom: 12px; cursor: pointer;" onclick="this.querySelector('.announcement-content').classList.toggle('hidden')">
                    <div class="card-body" style="padding: 16px 20px;">
                        <div style="display: flex; align-items: flex-start; gap: 14px;">
                            <div style="width: 40px; height: 40px; border-radius: 12px; background: ${typeColor}12; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="${typeIcon}" style="width: 18px; height: 18px; color: ${typeColor};"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <span style="font-size: 9px; font-weight: 700; color: ${typeColor}; letter-spacing: 0.5px; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; background: ${typeColor}12;">${a.type || 'General'}</span>
                                    <span style="font-size: 11px; color: var(--text-secondary);">•</span>
                                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">${date}</span>
                                </div>
                                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${a.title || ''}</div>
                                <div class="announcement-content hidden" style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-top: 8px;">${a.content || ''}</div>
                            </div>
                            <i data-lucide="chevron-down" style="width: 16px; height: 16px; color: var(--text-secondary); opacity: 0.5; flex-shrink: 0;"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();

    } catch (err) {
        console.error('Error loading announcements:', err);
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Could not load announcements.</p>`;
    }
}

loadAnnouncements();

// Re-initialize Lucide
if (window.lucide) window.lucide.createIcons();
