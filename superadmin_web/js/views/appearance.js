// js/views/appearance.js - ScholarDoc Super Admin Appearance & Carousel Management

let appearanceConfig = {
    themeMode: 'light',
    systemDefaultMode: 'light',
    highContrast: false,
    allowUserOverride: true,
    banners: []
};

let previewCurrentIndex = 0;
let previewAutoplayTimer = null;
let isPreviewPlaying = true;

let editingBannerId = null;
let pendingImageData = null;
let pendingDeleteBannerId = null;

// Reusable toast function
function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type === 'error' ? 'alert-circle' : 'check-circle');
        return;
    }
    let toast = document.getElementById('appearance-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appearance-toast';
        toast.style.cssText = 'position: fixed; bottom: 28px; right: 28px; z-index: 99999; padding: 13px 22px; border-radius: 12px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(14px); font-family: inherit;';
        document.body.appendChild(toast);
    }
    const isError = type === 'error';
    toast.style.background = isError ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)';
    toast.style.color = '#FFFFFF';
    toast.innerHTML = `<i class="${isError ? 'icon-alert-circle' : 'icon-check-circle'}" style="font-size: 17px;"></i> <span>${message}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(14px)';
    }, 3500);
}

// ── Image URL Resolver & Robust Multi-Attempt Fallback ───────────────────
function resolveBannerUrl(url) {
    if (!url) return 'assets/Slide_image1.jpg';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // If running over HTTP/HTTPS, prefer root-relative path '/assets/...'
    if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
        return '/' + url.replace(/^\/+/, '');
    }
    // If opened via file:// protocol, return relative path
    return url.replace(/^\/+/, '');
}

window.handleBannerImgError = function(img) {
    if (!img) return;
    const attempt = parseInt(img.dataset.attempt || '0', 10);
    img.dataset.attempt = String(attempt + 1);

    const originalSrc = img.getAttribute('data-original') || img.src;
    img.setAttribute('data-original', originalSrc);

    const cleanFilename = originalSrc.split('/').pop().split('?')[0];

    if (attempt === 0) {
        // Attempt 1: Try direct root-relative /assets/
        img.src = '/assets/' + cleanFilename;
        return;
    }
    if (attempt === 1) {
        // Attempt 2: Try relative assets/
        img.src = 'assets/' + cleanFilename;
        return;
    }
    if (attempt === 2) {
        // Attempt 3: Try parent ../assets/
        img.src = '../assets/' + cleanFilename;
        return;
    }
    if (attempt === 3) {
        // Attempt 4: Try banners subfolder
        img.src = '/assets/banners/' + cleanFilename;
        return;
    }
    if (attempt === 4) {
        // Attempt 5: Fallback to Slide_image1.jpg
        img.src = '/assets/Slide_image1.jpg';
        return;
    }

    // Final fallback: Attractive branded SVG placeholder
    img.onerror = null;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0A1E3F"/>
                    <stop offset="50%" stop-color="#0F3260"/>
                    <stop offset="100%" stop-color="#1E355A"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg)"/>
            <circle cx="400" cy="170" r="44" fill="rgba(212,175,55,0.18)"/>
            <path d="M380 175 L395 190 L425 155" fill="none" stroke="#D4AF37" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="400" y="245" font-family="'Inter', sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="-0.3">ScholarDoc Banner</text>
            <text x="400" y="275" font-family="'Inter', sans-serif" font-size="13" font-weight="500" fill="rgba(255,255,255,0.7)" text-anchor="middle">Ready for upload in Appearance Management</text>
        </svg>
    `);
};

// ── Fetch Appearance & Carousel Data ─────────────────────────────────────
async function loadAppearanceData() {
    try {
        const res = await fetch('/api/appearance');
        if (res.ok) {
            const data = await res.json();
            if (data.appearance) {
                appearanceConfig = {
                    ...appearanceConfig,
                    ...data.appearance
                };
            }
            if (Array.isArray(data.banners)) {
                appearanceConfig.banners = data.banners;
            } else if (Array.isArray(data.appearance?.banners)) {
                appearanceConfig.banners = data.appearance.banners;
            }
        }
    } catch (err) {
        console.warn('[Appearance] Could not fetch from /api/appearance, using local defaults:', err.message);
    }

    // Default banners if list is empty
    if (!appearanceConfig.banners || appearanceConfig.banners.length === 0) {
        appearanceConfig.banners = [
            { id: 'banner_1', imageUrl: 'assets/Slide_image1.jpg', order: 1, active: true, createdAt: new Date().toISOString() },
            { id: 'banner_2', imageUrl: 'assets/Slide_image2.jpg', order: 2, active: true, createdAt: new Date().toISOString() },
            { id: 'banner_3', imageUrl: 'assets/slide_image3.jpg', order: 3, active: true, createdAt: new Date().toISOString() }
        ];
    }

    // Ensure order sorting
    appearanceConfig.banners.sort((a, b) => (a.order || 0) - (b.order || 0));

    updateBannerBadges();
    renderPreviewCarousel();
    renderBannersGrid();
    syncDarkModeUI();
}

function updateBannerBadges() {
    const total = appearanceConfig.banners.length;
    const activeCount = appearanceConfig.banners.filter(b => b.active !== false).length;
    const activeLabel = document.getElementById('banners-active-count-label');

    if (activeLabel) activeLabel.textContent = `${activeCount} of ${total} Active`;

    const tabBadge = document.getElementById('tab-carousel-badge');
    if (tabBadge) tabBadge.textContent = `${activeCount} Active`;
}

// ── Tab Navigation (Banner Carousel vs Dark Mode) ────────────────────────
let currentActiveTab = 'carousel';

function switchTab(tabName) {
    if (tabName !== 'carousel' && tabName !== 'darkmode') tabName = 'carousel';
    currentActiveTab = tabName;

    try {
        localStorage.setItem('appearance_active_tab', tabName);
    } catch (_) {}

    const btnCarousel = document.getElementById('tab-btn-carousel');
    const btnDarkmode = document.getElementById('tab-btn-darkmode');
    const paneCarousel = document.getElementById('tab-content-carousel');
    const paneDarkmode = document.getElementById('tab-content-darkmode');

    const isCarousel = tabName === 'carousel';

    if (btnCarousel) {
        btnCarousel.classList.toggle('active', isCarousel);
        btnCarousel.setAttribute('aria-selected', String(isCarousel));
    }
    if (btnDarkmode) {
        btnDarkmode.classList.toggle('active', !isCarousel);
        btnDarkmode.setAttribute('aria-selected', String(!isCarousel));
    }

    if (paneCarousel) {
        paneCarousel.classList.toggle('active', isCarousel);
    }
    if (paneDarkmode) {
        paneDarkmode.classList.toggle('active', !isCarousel);
    }

    if (isCarousel) {
        // Re-render and size preview carousel when tab becomes visible
        setTimeout(() => {
            renderPreviewCarousel();
        }, 50);
    } else {
        // Save resources by pausing preview autoplay while on darkmode tab
        clearInterval(previewAutoplayTimer);
        syncDarkModeUI();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ── Live Interactive Carousel Simulator ──────────────────────────────────
function getActiveBanners() {
    return appearanceConfig.banners.filter(b => b.active !== false);
}

function renderPreviewCarousel() {
    const track = document.getElementById('preview-carousel-track');
    const dotsContainer = document.getElementById('preview-carousel-dots');
    const indicator = document.getElementById('preview-slide-indicator');
    if (!track) return;

    const activeList = getActiveBanners();

    if (activeList.length === 0) {
        track.innerHTML = `
            <div style="min-width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94A3B8; background: #0F172A;">
                <i class="icon-image" style="font-size: 32px; opacity: 0.4; margin-bottom: 8px;"></i>
                <span style="font-size: 13px; font-weight: 600;">No active banners to preview</span>
                <span style="font-size: 11px; opacity: 0.7;">Enable at least one banner below</span>
            </div>
        `;
        if (dotsContainer) dotsContainer.innerHTML = '';
        if (indicator) indicator.textContent = '0 / 0';
        clearInterval(previewAutoplayTimer);
        return;
    }

    // Clamp index
    if (previewCurrentIndex >= activeList.length) {
        previewCurrentIndex = 0;
    }

    track.innerHTML = activeList.map((banner, idx) => {
        const resolvedUrl = resolveBannerUrl(banner.imageUrl);
        return `
            <div style="min-width: 100%; height: 100%; position: relative; background: #000; overflow: hidden; flex-shrink: 0;">
                <img src="${resolvedUrl}" alt="Banner ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="window.handleBannerImgError(this)">
                <div style="position: absolute; bottom: 10px; right: 14px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 3px 9px; border-radius: 6px; font-size: 11px; color: white; font-weight: 700; z-index: 5;">
                    Slide #${banner.order || (idx + 1)}
                </div>
            </div>
        `;
    }).join('');

    if (dotsContainer) {
        dotsContainer.innerHTML = activeList.map((_, idx) => `
            <div class="preview-dot ${idx === previewCurrentIndex ? 'active' : ''}" data-index="${idx}"></div>
        `).join('');

        dotsContainer.querySelectorAll('.preview-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const idx = parseInt(dot.getAttribute('data-index'), 10);
                goToPreviewSlide(idx);
                restartAutoplay();
            });
        });
    }

    goToPreviewSlide(previewCurrentIndex);
    restartAutoplay();
}

function goToPreviewSlide(index) {
    const activeList = getActiveBanners();
    if (activeList.length === 0) return;

    previewCurrentIndex = (index + activeList.length) % activeList.length;
    const track = document.getElementById('preview-carousel-track');
    const indicator = document.getElementById('preview-slide-indicator');
    const dots = document.querySelectorAll('#preview-carousel-dots .preview-dot');

    if (track) {
        track.style.transform = `translateX(-${previewCurrentIndex * 100}%)`;
    }

    if (indicator) {
        indicator.textContent = `${previewCurrentIndex + 1} / ${activeList.length}`;
    }

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === previewCurrentIndex);
    });
}

function restartAutoplay() {
    clearInterval(previewAutoplayTimer);
    if (!isPreviewPlaying) return;
    const activeList = getActiveBanners();
    if (activeList.length <= 1) return;

    previewAutoplayTimer = setInterval(() => {
        goToPreviewSlide(previewCurrentIndex + 1);
    }, 4500);
}

// ── Render Banners Management Grid ───────────────────────────────────────
function renderBannersGrid() {
    const container = document.getElementById('banners-grid-container');
    const emptyState = document.getElementById('banners-empty-state');
    if (!container) return;

    const list = appearanceConfig.banners;
    if (list.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = list.map((banner, index) => {
        const isActive = banner.active !== false;
        const isFirst = index === 0;
        const isLast = index === list.length - 1;
        const resolvedUrl = resolveBannerUrl(banner.imageUrl);

        return `
            <div class="banner-card" data-id="${banner.id}">
                <!-- Thumbnail Preview -->
                <div style="position: relative; width: 100%; height: 160px; background: #0F172A; overflow: hidden;">
                    <img src="${resolvedUrl}" alt="Banner ${banner.order || (index + 1)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="window.handleBannerImgError(this)">
                    
                    <!-- Sequence Badge -->
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px); color: white; padding: 3px 9px; border-radius: 8px; font-size: 11px; font-weight: 800; border: 1px solid rgba(255,255,255,0.15); z-index: 5;">
                        #${index + 1}
                    </div>

                    <!-- Status Pill -->
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 5;">
                        <span class="banner-status-pill" data-id="${banner.id}" style="display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 12px; background: ${isActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(100, 116, 139, 0.9)'}; color: white; backdrop-filter: blur(4px);">
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: white;"></span>
                            ${isActive ? 'Active' : 'Hidden'}
                        </span>
                    </div>
                </div>

                <!-- Card Body & Controls -->
                <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: space-between;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="font-size: 14px; font-weight: 800; color: var(--text-primary); display: block;">Slide #${index + 1}</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">Order: ${banner.order || (index + 1)} • Carousel Slide</span>
                        </div>

                        <!-- Native Working Switch Button -->
                        <button type="button" class="sch-switch-btn banner-switch ${isActive ? 'active' : ''}" data-id="${banner.id}" role="switch" aria-checked="${isActive}" title="Toggle Banner Visibility">
                            <span class="sch-switch-knob"></span>
                        </button>
                    </div>

                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 0;">

                    <!-- Action Buttons -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                        <!-- Reorder Arrows with Lucide Chevron Icons -->
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn-banner-move-up icon-btn" data-id="${banner.id}" ${isFirst ? 'disabled style="opacity: 0.3; cursor: not-allowed; width: 30px; height: 30px;"' : 'style="cursor: pointer; width: 30px; height: 30px;"'} title="Move Earlier in Sequence">
                                <i class="icon-chevron-up" style="font-size: 15px;"></i>
                            </button>
                            <button type="button" class="btn-banner-move-down icon-btn" data-id="${banner.id}" ${isLast ? 'disabled style="opacity: 0.3; cursor: not-allowed; width: 30px; height: 30px;"' : 'style="cursor: pointer; width: 30px; height: 30px;"'} title="Move Later in Sequence">
                                <i class="icon-chevron-down" style="font-size: 15px;"></i>
                            </button>
                        </div>

                        <!-- Edit & Delete -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button type="button" class="btn-banner-replace btn" data-id="${banner.id}" style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 8px; background: rgba(15, 50, 96, 0.08); color: var(--primary-color); border: 1px solid var(--border-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-refresh-cw" style="font-size: 11px;"></i> Replace
                            </button>
                            <button type="button" class="btn-banner-delete icon-btn" data-id="${banner.id}" style="width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.08); color: #EF4444; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Delete Banner">
                                <i class="icon-trash-2" style="font-size: 13px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.banner-switch').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const willBeActive = !btn.classList.contains('active');
            btn.classList.toggle('active', willBeActive);
            btn.setAttribute('aria-checked', String(willBeActive));

            // Update status pill immediately
            const pill = container.querySelector(`.banner-status-pill[data-id="${id}"]`);
            if (pill) {
                pill.style.background = willBeActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(100, 116, 139, 0.9)';
                pill.innerHTML = `<span style="width: 5px; height: 5px; border-radius: 50%; background: white;"></span> ${willBeActive ? 'Active' : 'Hidden'}`;
            }

            await updateBannerActive(id, willBeActive);
        });
    });

    container.querySelectorAll('.btn-banner-move-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            moveBanner(id, -1);
        });
    });

    container.querySelectorAll('.btn-banner-move-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            moveBanner(id, 1);
        });
    });

    container.querySelectorAll('.btn-banner-replace').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            openUploadModalForReplace(id);
        });
    });

    container.querySelectorAll('.btn-banner-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            openDeleteModal(id);
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

// ── Banner Actions: Active, Reorder, Replace, Delete ──────────────────────
async function updateBannerActive(id, active) {
    const banner = appearanceConfig.banners.find(b => b.id === id);
    if (!banner) return;
    banner.active = active;

    updateBannerBadges();
    renderPreviewCarousel();

    try {
        await fetch('/api/banners/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active })
        });
        showToast(`Banner marked as ${active ? 'Active' : 'Hidden'}.`);
    } catch (err) {
        console.error('Error updating banner active state:', err);
    }
}

async function moveBanner(id, delta) {
    const list = appearanceConfig.banners;
    const currentIndex = list.findIndex(b => b.id === id);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    // Reassign order
    list.forEach((b, i) => b.order = i + 1);

    renderBannersGrid();
    renderPreviewCarousel();

    try {
        const orderIds = list.map(b => b.id);
        await fetch('/api/banners/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: orderIds })
        });
        showToast('Banner sequence updated.');
    } catch (err) {
        console.error('Error reordering banners:', err);
    }
}

// ── Upload & Replace Banner Modal (Pure Image Upload, No Text) ────────────
function openUploadModalForNew() {
    editingBannerId = null;
    pendingImageData = null;

    const modal = document.getElementById('modal-banner-upload');
    const title = document.getElementById('modal-banner-title');
    const subtitle = document.getElementById('modal-banner-subtitle');
    const confirmBtnText = document.getElementById('btn-confirm-banner-text');
    const switchActive = document.getElementById('btn-modal-banner-active');

    if (title) title.textContent = 'Upload Carousel Banner';
    if (subtitle) subtitle.textContent = 'Upload an image for the rotating carousel. No text input is required.';
    if (confirmBtnText) confirmBtnText.textContent = 'Upload Banner';
    if (switchActive) {
        switchActive.classList.add('active');
        switchActive.setAttribute('aria-checked', 'true');
    }

    resetDropzone();
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function openUploadModalForReplace(id) {
    editingBannerId = id;
    pendingImageData = null;

    const banner = appearanceConfig.banners.find(b => b.id === id);
    const modal = document.getElementById('modal-banner-upload');
    const title = document.getElementById('modal-banner-title');
    const subtitle = document.getElementById('modal-banner-subtitle');
    const confirmBtnText = document.getElementById('btn-confirm-banner-text');
    const switchActive = document.getElementById('btn-modal-banner-active');

    if (title) title.textContent = 'Replace Banner Image';
    if (subtitle) subtitle.textContent = 'Select a new image to replace this slide. Existing order will be preserved.';
    if (confirmBtnText) confirmBtnText.textContent = 'Replace Image';
    if (switchActive && banner) {
        const isAct = banner.active !== false;
        switchActive.classList.toggle('active', isAct);
        switchActive.setAttribute('aria-checked', String(isAct));
    }

    resetDropzone();
    if (banner && banner.imageUrl) {
        showDropzonePreview(resolveBannerUrl(banner.imageUrl), 'Current Banner');
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function closeUploadModal() {
    const modal = document.getElementById('modal-banner-upload');
    if (modal) modal.classList.add('hidden');
    editingBannerId = null;
    pendingImageData = null;
    resetDropzone();
}

function resetDropzone() {
    const emptyView = document.getElementById('dropzone-empty-view');
    const previewView = document.getElementById('dropzone-preview-view');
    const fileInput = document.getElementById('input-banner-file');

    if (emptyView) emptyView.classList.remove('hidden');
    if (previewView) previewView.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

function showDropzonePreview(imageSrc, fileSizeText = '') {
    const emptyView = document.getElementById('dropzone-empty-view');
    const previewView = document.getElementById('dropzone-preview-view');
    const previewImg = document.getElementById('img-upload-preview');
    const sizeEl = document.getElementById('preview-file-size');

    if (emptyView) emptyView.classList.add('hidden');
    if (previewView) previewView.classList.remove('hidden');
    if (previewImg) previewImg.src = imageSrc;
    if (sizeEl) sizeEl.textContent = fileSizeText || 'Image Selected';
}

function handleFileSelection(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (PNG, JPG, JPEG, WEBP).', 'error');
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showToast('Image file size must be less than 8MB.', 'error');
        return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeDisplay = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingImageData = e.target.result;
        showDropzonePreview(pendingImageData, sizeDisplay);
    };
    reader.onerror = () => {
        showToast('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
}

async function handleConfirmBannerUpload() {
    if (!pendingImageData && !editingBannerId) {
        showToast('Please select an image file to upload.', 'error');
        return;
    }

    const switchActive = document.getElementById('btn-modal-banner-active');
    const isActive = switchActive ? switchActive.classList.contains('active') : true;
    const confirmBtn = document.getElementById('btn-confirm-banner-upload');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        if (editingBannerId) {
            // Update existing banner
            const payload = { id: editingBannerId, active: isActive };
            if (pendingImageData) {
                payload.image = pendingImageData;
            }

            const res = await fetch('/api/banners/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Update failed');
            const data = await res.json();
            if (data.banners) appearanceConfig.banners = data.banners;
            showToast('Banner image updated successfully.');
        } else {
            // Create new banner
            const res = await fetch('/api/banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: pendingImageData,
                    active: isActive
                })
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            if (data.banners) appearanceConfig.banners = data.banners;
            showToast('New banner uploaded successfully.');
        }

        updateBannerBadges();
        renderPreviewCarousel();
        renderBannersGrid();
        closeUploadModal();
    } catch (err) {
        showToast(err.message || 'Error processing banner image.', 'error');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

// ── Delete Banner Confirmation ───────────────────────────────────────────
function openDeleteModal(id) {
    pendingDeleteBannerId = id;
    const banner = appearanceConfig.banners.find(b => b.id === id);
    const modal = document.getElementById('modal-banner-delete');
    const thumb = document.getElementById('delete-banner-thumbnail');

    if (thumb && banner) thumb.src = resolveBannerUrl(banner.imageUrl);
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function closeDeleteModal() {
    const modal = document.getElementById('modal-banner-delete');
    if (modal) modal.classList.add('hidden');
    pendingDeleteBannerId = null;
}

async function handleConfirmDelete() {
    if (!pendingDeleteBannerId) return;
    const id = pendingDeleteBannerId;
    const confirmBtn = document.getElementById('btn-confirm-delete');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        const res = await fetch('/api/banners/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error('Delete failed');
        const data = await res.json();
        if (data.banners) appearanceConfig.banners = data.banners;

        updateBannerBadges();
        renderPreviewCarousel();
        renderBannersGrid();
        closeDeleteModal();
        showToast('Banner removed from carousel.');
    } catch (err) {
        showToast(err.message || 'Error deleting banner.', 'error');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

// ── Reset Defaults ───────────────────────────────────────────────────────
async function handleResetDefaultBanners() {
    if (!confirm('Restore the default USTP official carousel banners? This will reset your custom banners list.')) {
        return;
    }
    try {
        const res = await fetch('/api/banners/reset', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data.banners) appearanceConfig.banners = data.banners;
            updateBannerBadges();
            renderPreviewCarousel();
            renderBannersGrid();
            showToast('Default carousel banners restored.');
        }
    } catch (err) {
        showToast('Could not reset banners: ' + err.message, 'error');
    }
}

// ── Dark Mode Management ─────────────────────────────────────────────────
function syncDarkModeUI() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const savedMode = appearanceConfig.themeMode || localStorage.getItem('theme_mode') || 'light';
    const isDark = document.body.classList.contains('dark') || currentTheme === 'dark';

    // 1. Update selection cards
    document.querySelectorAll('.theme-choice-card').forEach(card => {
        const mode = card.getAttribute('data-mode');
        const isSelected = mode === savedMode;
        card.classList.toggle('selected', isSelected);
    });

    // 2. Update instant switch button
    const instantSwitch = document.getElementById('btn-toggle-instant-darkmode');
    if (instantSwitch) {
        instantSwitch.classList.toggle('active', isDark);
        instantSwitch.setAttribute('aria-checked', String(isDark));
    }

    // 3. Update header pill & tab button badge
    const pillIcon = document.getElementById('active-theme-pill-icon');
    const pillText = document.getElementById('active-theme-pill-text');
    if (pillIcon) pillIcon.className = isDark ? 'icon-moon' : 'icon-sun';
    if (pillText) pillText.textContent = isDark ? 'Dark Theme' : 'Light Theme';

    const tabDarkBadge = document.getElementById('tab-darkmode-badge');
    if (tabDarkBadge) {
        tabDarkBadge.textContent = savedMode === 'system' ? 'Auto' : (isDark ? 'Dark' : 'Light');
    }
    const tabDarkIcon = document.getElementById('tab-darkmode-icon');
    if (tabDarkIcon) {
        tabDarkIcon.className = isDark ? 'icon-moon' : 'icon-sun';
    }

    // 4. Update dropdowns and switches
    const sysSelect = document.getElementById('select-system-default-theme');
    if (sysSelect) sysSelect.value = appearanceConfig.systemDefaultMode || 'light';

    const btnOverride = document.getElementById('btn-toggle-allow-override');
    if (btnOverride) {
        const isAllow = appearanceConfig.allowUserOverride !== false;
        btnOverride.classList.toggle('active', isAllow);
        btnOverride.setAttribute('aria-checked', String(isAllow));
    }

    const btnContrast = document.getElementById('btn-toggle-high-contrast');
    if (btnContrast) {
        const isContrast = Boolean(appearanceConfig.highContrast);
        btnContrast.classList.toggle('active', isContrast);
        btnContrast.setAttribute('aria-checked', String(isContrast));
    }

    if (window.lucide) window.lucide.createIcons();
}

function applyTheme(themeName, modeName = themeName) {
    let effectiveTheme = themeName;
    if (themeName === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }

    localStorage.setItem('theme', effectiveTheme);
    localStorage.setItem('theme_mode', modeName);
    appearanceConfig.themeMode = modeName;

    // Update topbar theme button icon if present in admin.js
    const topbarIcon = document.getElementById('theme-toggle-icon');
    if (topbarIcon) {
        topbarIcon.className = effectiveTheme === 'dark' ? 'icon-sun' : 'icon-moon';
    }

    // Dispatch global theme change event
    window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: effectiveTheme } }));

    syncDarkModeUI();
}

async function handleSaveAppearancePreferences() {
    const sysSelect = document.getElementById('select-system-default-theme');
    const btnOverride = document.getElementById('btn-toggle-allow-override');
    const btnContrast = document.getElementById('btn-toggle-high-contrast');
    const btn = document.getElementById('btn-save-appearance');

    if (btn) btn.disabled = true;

    const payload = {
        themeMode: appearanceConfig.themeMode || 'light',
        systemDefaultMode: sysSelect ? sysSelect.value : 'light',
        allowUserOverride: btnOverride ? btnOverride.classList.contains('active') : true,
        highContrast: btnContrast ? btnContrast.classList.contains('active') : false
    };

    appearanceConfig = { ...appearanceConfig, ...payload };

    try {
        const res = await fetch('/api/appearance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Appearance preferences successfully saved across the system.');
        } else {
            showToast('Preferences saved in current session.', 'success');
        }
    } catch (err) {
        showToast('Preferences saved locally in your browser session.', 'success');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ── Event Setup ──────────────────────────────────────────────────────────
function setupAppearanceEvents() {
    // 0. Tab Switching Buttons (Banner Carousel vs Dark Mode)
    const btnTabCarousel = document.getElementById('tab-btn-carousel');
    const btnTabDarkmode = document.getElementById('tab-btn-darkmode');
    if (btnTabCarousel) {
        btnTabCarousel.addEventListener('click', () => switchTab('carousel'));
    }
    if (btnTabDarkmode) {
        btnTabDarkmode.addEventListener('click', () => switchTab('darkmode'));
    }

    // 1. Carousel Simulator Controls
    const btnPrev = document.getElementById('btn-preview-prev');
    const btnNext = document.getElementById('btn-preview-next');
    const btnPlay = document.getElementById('btn-toggle-carousel-play');
    const playIcon = document.getElementById('carousel-play-icon');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            goToPreviewSlide(previewCurrentIndex - 1);
            restartAutoplay();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            goToPreviewSlide(previewCurrentIndex + 1);
            restartAutoplay();
        });
    }

    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            isPreviewPlaying = !isPreviewPlaying;
            if (playIcon) {
                playIcon.className = isPreviewPlaying ? 'icon-pause' : 'icon-play';
            }
            if (isPreviewPlaying) {
                restartAutoplay();
            } else {
                clearInterval(previewAutoplayTimer);
            }
            if (window.lucide) window.lucide.createIcons();
        });
    }

    // 2. Upload Modal Controls
    const btnOpenCreate = document.getElementById('btn-open-create-banner');
    const btnEmptyAdd = document.getElementById('btn-empty-add-banner');
    const btnCloseModal = document.getElementById('btn-close-upload-modal');
    const btnCancelUpload = document.getElementById('btn-cancel-banner-upload');
    const btnConfirmUpload = document.getElementById('btn-confirm-banner-upload');
    const dropzone = document.getElementById('banner-dropzone');
    const fileInput = document.getElementById('input-banner-file');
    const btnChangeImg = document.getElementById('btn-change-image');
    const switchModalActive = document.getElementById('btn-modal-banner-active');

    if (btnOpenCreate) btnOpenCreate.addEventListener('click', openUploadModalForNew);
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openUploadModalForNew);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeUploadModal);
    if (btnCancelUpload) btnCancelUpload.addEventListener('click', closeUploadModal);
    if (btnConfirmUpload) btnConfirmUpload.addEventListener('click', handleConfirmBannerUpload);

    if (switchModalActive) {
        switchModalActive.addEventListener('click', () => {
            const isActive = !switchModalActive.classList.contains('active');
            switchModalActive.classList.toggle('active', isActive);
            switchModalActive.setAttribute('aria-checked', String(isActive));
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target.id === 'btn-change-image' || e.target.closest('#btn-change-image')) {
                fileInput.click();
                return;
            }
            if (document.getElementById('dropzone-empty-view').classList.contains('hidden')) return;
            fileInput.click();
        });

        if (btnChangeImg) {
            btnChangeImg.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                handleFileSelection(fileInput.files[0]);
            }
        });

        // Drag and Drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-color)';
            dropzone.style.background = 'rgba(15, 50, 96, 0.05)';
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'rgba(0,0,0,0.015)';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'rgba(0,0,0,0.015)';
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
    }

    // 3. Delete Modal Controls
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', handleConfirmDelete);

    // 4. Reset Defaults
    const btnReset = document.getElementById('btn-reset-default-banners');
    if (btnReset) btnReset.addEventListener('click', handleResetDefaultBanners);

    // 5. Dark Mode Controls
    document.querySelectorAll('.theme-choice-card').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.getAttribute('data-mode');
            applyTheme(mode, mode);
        });
    });

    const instantSwitch = document.getElementById('btn-toggle-instant-darkmode');
    if (instantSwitch) {
        instantSwitch.addEventListener('click', () => {
            const isDarkNow = !document.body.classList.contains('dark');
            applyTheme(isDarkNow ? 'dark' : 'light', isDarkNow ? 'dark' : 'light');
        });
    }

    const rowAllowOverride = document.getElementById('row-allow-override');
    const btnAllowOverride = document.getElementById('btn-toggle-allow-override');
    if (rowAllowOverride && btnAllowOverride) {
        rowAllowOverride.addEventListener('click', () => {
            const willBeActive = !btnAllowOverride.classList.contains('active');
            btnAllowOverride.classList.toggle('active', willBeActive);
            btnAllowOverride.setAttribute('aria-checked', String(willBeActive));
            appearanceConfig.allowUserOverride = willBeActive;
        });
    }

    const rowHighContrast = document.getElementById('row-high-contrast');
    const btnHighContrast = document.getElementById('btn-toggle-high-contrast');
    if (rowHighContrast && btnHighContrast) {
        rowHighContrast.addEventListener('click', () => {
            const willBeActive = !btnHighContrast.classList.contains('active');
            btnHighContrast.classList.toggle('active', willBeActive);
            btnHighContrast.setAttribute('aria-checked', String(willBeActive));
            appearanceConfig.highContrast = willBeActive;
        });
    }

    const btnSaveAppearance = document.getElementById('btn-save-appearance');
    if (btnSaveAppearance) {
        btnSaveAppearance.addEventListener('click', handleSaveAppearancePreferences);
    }

    // Listen for OS system theme changes if in 'system' mode
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (appearanceConfig.themeMode === 'system') {
                applyTheme('system', 'system');
            }
        });
    }
}

// ── Initialize View ──────────────────────────────────────────────────────
loadAppearanceData();
setupAppearanceEvents();

// Initial tab activation (respect hash like #darkmode or #carousel, or fallback to saved / default)
let initialTab = 'carousel';
if (window.location.hash === '#darkmode' || window.location.hash === '#section-darkmode') {
    initialTab = 'darkmode';
} else {
    try {
        const savedTab = localStorage.getItem('appearance_active_tab');
        if (savedTab === 'darkmode' || savedTab === 'carousel') {
            initialTab = savedTab;
        }
    } catch (_) {}
}
switchTab(initialTab);
