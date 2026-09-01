// ScholarDoc Student Web — Submit Documents View Logic
// Mirrors upload_workflow_screen.dart + id_capture_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;
const profile = window.currentStudentProfile;

let currentStep = 0;
let frontImageFile = null;
let backImageFile = null;
let atmImageFile = null;
let signatureDataUrl = null;

// ─── Load existing SA ───
const saInput = document.getElementById('sa-input');
if (profile?.saNumber && saInput) {
    saInput.value = profile.saNumber;
}

// Try loading offline draft
const draftSA = localStorage.getItem('scholardoc_draft_sa');
if (draftSA && saInput && !saInput.value) {
    saInput.value = draftSA;
}

// ─── Save Draft ───
document.getElementById('save-draft-btn')?.addEventListener('click', () => {
    localStorage.setItem('scholardoc_draft_sa', saInput?.value || '');
    window.showToast?.('Draft Saved', 'Your SA number has been saved locally.', 'success');
});

// ─── Stepper Navigation ───
function goToStep(step) {
    currentStep = step;
    
    // Show/hide steps
    document.querySelectorAll('.step-content').forEach((el, i) => {
        el.classList.toggle('hidden', i !== step);
    });

    // Update stepper UI
    document.querySelectorAll('.stepper-step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i < step) el.classList.add('completed');
        if (i === step) el.classList.add('active');
    });

    // Populate review on last step
    if (step === 2) populateReview();

    if (window.lucide) window.lucide.createIcons();
}

// Step navigation buttons
document.getElementById('next-step-0')?.addEventListener('click', () => {
    if (!saInput?.value?.trim()) {
        window.showToast?.('Required', 'Please enter your SA number.', 'warning');
        return;
    }
    goToStep(1);
});

document.getElementById('prev-step-1')?.addEventListener('click', () => goToStep(0));

document.getElementById('next-step-1')?.addEventListener('click', () => {
    if (!frontImageFile) {
        window.showToast?.('Required', 'Please upload your ID front image.', 'warning');
        return;
    }
    if (!backImageFile) {
        window.showToast?.('Required', 'Please upload your ID back image.', 'warning');
        return;
    }
    if (!signatureDataUrl) {
        window.showToast?.('Required', 'Please provide your digital signature.', 'warning');
        return;
    }
    goToStep(2);
});

document.getElementById('prev-step-2')?.addEventListener('click', () => goToStep(1));

// ─── File Upload Handlers ───
function setupFileUpload(inputId, previewId, previewImgId, zoneId, badgeId, setter) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const previewImg = document.getElementById(previewImgId);
    const zone = document.getElementById(zoneId);
    const badge = document.getElementById(badgeId);

    input?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setter(file);

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (previewImg) previewImg.src = ev.target.result;
            preview?.classList.remove('hidden');
            zone?.classList.add('has-file');
            if (zone) {
                zone.innerHTML = `
                    <i data-lucide="check-circle" style="color: var(--success);"></i>
                    <h4 style="color: var(--success);">Image Selected</h4>
                    <p>${file.name} (${(file.size / 1024).toFixed(0)} KB)</p>
                `;
            }
            if (badge) {
                badge.className = 'badge badge-success';
                badge.innerHTML = '<i data-lucide="check-circle"></i> Ready';
            }
            if (window.lucide) window.lucide.createIcons();
        };
        reader.readAsDataURL(file);
    });

    // Drag & drop
    zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone?.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

setupFileUpload('front-file-input', 'front-preview', 'front-preview-img', 'front-upload-zone', 'front-badge', (f) => { frontImageFile = f; });
setupFileUpload('back-file-input', 'back-preview', 'back-preview-img', 'back-upload-zone', 'back-badge', (f) => { backImageFile = f; });
setupFileUpload('atm-file-input', 'atm-preview', 'atm-preview-img', 'atm-upload-zone', null, (f) => { atmImageFile = f; });

// ─── Signature Pad ───
const canvas = document.getElementById('signature-canvas');
const ctx = canvas?.getContext('2d');
let isDrawing = false;
let lastX = 0, lastY = 0;

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 8;
    canvas.height = 180;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

if (canvas) {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    }

    function stopDraw() {
        if (isDrawing) {
            isDrawing = false;
            signatureDataUrl = canvas.toDataURL('image/png');
            const sigBadge = document.getElementById('sig-badge');
            if (sigBadge) {
                sigBadge.className = 'badge badge-success';
                sigBadge.innerHTML = '<i data-lucide="check-circle"></i> Signed';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
}

document.getElementById('clear-signature-btn')?.addEventListener('click', () => {
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        signatureDataUrl = null;
        const sigBadge = document.getElementById('sig-badge');
        if (sigBadge) {
            sigBadge.className = 'badge badge-pending';
            sigBadge.innerHTML = '<i data-lucide="clock"></i> Required';
            if (window.lucide) window.lucide.createIcons();
        }
    }
});

// ─── Review Step ───
function populateReview() {
    const container = document.getElementById('review-content');
    if (!container) return;

    const items = [
        { label: 'SA Number', value: saInput?.value || 'N/A', icon: 'landmark' },
        { label: 'ID Front', value: frontImageFile?.name || 'Not selected', icon: 'image', ok: !!frontImageFile },
        { label: 'ID Back', value: backImageFile?.name || 'Not selected', icon: 'image', ok: !!backImageFile },
        { label: 'Digital Signature', value: signatureDataUrl ? 'Captured' : 'Not provided', icon: 'pen-tool', ok: !!signatureDataUrl },
        { label: 'ATM Card', value: atmImageFile?.name || 'Not provided (optional)', icon: 'credit-card', ok: atmImageFile !== null, optional: true },
    ];

    container.innerHTML = items.map(item => `
        <div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--crisp-border);">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: ${item.ok !== false ? 'rgba(16,185,129,0.08)' : (item.optional ? 'rgba(107,114,128,0.06)' : 'rgba(239,68,68,0.08)')}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="${item.icon}" style="width: 18px; height: 18px; color: ${item.ok !== false ? 'var(--success)' : (item.optional ? 'var(--text-secondary)' : 'var(--error)')};"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.5px; text-transform: uppercase;">${item.label}</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${item.value}</div>
            </div>
            <i data-lucide="${item.ok !== false ? 'check-circle' : (item.optional ? 'minus-circle' : 'alert-circle')}" style="width: 18px; height: 18px; color: ${item.ok !== false ? 'var(--success)' : (item.optional ? 'var(--text-secondary)' : 'var(--error)')};"></i>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ─── Submit ───
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const submitSpinner = document.getElementById('submit-spinner');

submitBtn?.addEventListener('click', async () => {
    if (!uid) return;

    submitBtn.disabled = true;
    submitBtnText.textContent = 'Submitting...';
    submitSpinner?.classList.remove('hidden');

    try {
        const timestamp = Date.now();
        const studentId = profile?.studentId || 'unknown';

        // 1. Upload ID Front
        const frontFormData = new FormData();
        frontFormData.append('file', frontImageFile);
        frontFormData.append('upload_preset', 'scholardoc_profiles');
        frontFormData.append('folder', `submissions/${uid}`);
        const frontResp = await fetch('https://api.cloudinary.com/v1_1/dc2wi71nx/image/upload', { method: 'POST', body: frontFormData });
        const frontResult = await frontResp.json();
        const frontUrl = frontResult.secure_url;

        // 2. Upload ID Back
        const backFormData = new FormData();
        backFormData.append('file', backImageFile);
        backFormData.append('upload_preset', 'scholardoc_profiles');
        backFormData.append('folder', `submissions/${uid}`);
        const backResp = await fetch('https://api.cloudinary.com/v1_1/dc2wi71nx/image/upload', { method: 'POST', body: backFormData });
        const backResult = await backResp.json();
        const backUrl = backResult.secure_url;

        // 3. Generate PDF with jsPDF
        let pdfUrl = null;
        if (window.jspdf) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            doc.setFontSize(18);
            doc.text('Document Submission', 20, 20);
            doc.setFontSize(10);
            doc.text(`Student: ${profile?.fullName || 'N/A'} | ID: ${studentId} | Date: ${new Date().toLocaleDateString()}`, 20, 30);

            // Front image
            doc.setFontSize(12);
            doc.text('ID Front', 20, 45);
            try {
                const frontDataUrl = await fileToDataUrl(frontImageFile);
                doc.addImage(frontDataUrl, 'JPEG', 20, 50, 120, 75);
            } catch (_) {}

            // Back image
            doc.text('ID Back', 155, 45);
            try {
                const backDataUrl = await fileToDataUrl(backImageFile);
                doc.addImage(backDataUrl, 'JPEG', 155, 50, 120, 75);
            } catch (_) {}

            // Signature
            if (signatureDataUrl) {
                doc.text('Digital Signature', 20, 140);
                doc.addImage(signatureDataUrl, 'PNG', 20, 145, 80, 30);
            }

            // Upload PDF
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `DOC_${timestamp}_submission.pdf`, { type: 'application/pdf' });
            const pdfFormData = new FormData();
            pdfFormData.append('file', pdfFile);
            pdfFormData.append('upload_preset', 'scholardoc_profiles');
            pdfFormData.append('folder', `submissions/${uid}`);
            const pdfResp = await fetch('https://api.cloudinary.com/v1_1/dc2wi71nx/raw/upload', { method: 'POST', body: pdfFormData });
            const pdfResult = await pdfResp.json();
            pdfUrl = pdfResult.secure_url;
        }

        // 4. Upload ATM card if provided
        let atmUrl = null;
        if (atmImageFile) {
            const atmFormData = new FormData();
            atmFormData.append('file', atmImageFile);
            atmFormData.append('upload_preset', 'scholardoc_profiles');
            atmFormData.append('folder', `submissions/${uid}`);
            const atmResp = await fetch('https://api.cloudinary.com/v1_1/dc2wi71nx/image/upload', { method: 'POST', body: atmFormData });
            const atmResult = await atmResp.json();
            atmUrl = atmResult.secure_url;
        }

        // 5. Update student record
        const updates = {
            saNumber: saInput?.value?.trim() || '',
            submittedAt: new Date().toISOString(),
            documents: {
                ...(profile?.documents || {}),
                idFrontUrl: frontUrl,
                idBackUrl: backUrl,
                submissionPdfUrl: pdfUrl,
                atmCardUrl: atmUrl,
                signatureUrl: signatureDataUrl,
                lastSubmittedAt: new Date().toISOString(),
                lastSubmittedVia: 'web',
            },
        };

        await sb.from('students').update(updates).eq('uid', uid);

        // 6. Log activity
        await sb.from('audit_logs').insert({
            action: 'Submitted documents via Student Web Portal',
            userName: profile?.fullName || 'Student',
            role: 'Student',
            studentId: studentId,
        });

        // 7. Send notification
        await sb.from('notifications').insert({
            studentId: uid,
            title: 'Documents Submitted',
            message: 'Your documents have been submitted successfully via the web portal. Please wait for admin verification.',
            type: 'success',
            isRead: false,
        });

        // Notify admin
        await sb.from('notifications').insert({
            studentId: 'admin',
            title: 'New Document Submission',
            message: `${profile?.fullName || 'A student'} submitted documents via the web portal.`,
            type: 'info',
            isRead: false,
        });

        // Clear draft
        localStorage.removeItem('scholardoc_draft_sa');

        // Update global profile
        window.currentStudentProfile = { ...window.currentStudentProfile, ...updates };

        window.showToast?.('Success!', 'Your documents have been submitted successfully.', 'success');

        // Navigate to status
        setTimeout(() => loadView('status'), 1500);

    } catch (err) {
        console.error('Submission error:', err);
        window.showToast?.('Submission Failed', err.message || 'Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = 'Submit Documents';
        submitSpinner?.classList.add('hidden');
    }
});

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

if (window.lucide) window.lucide.createIcons();
