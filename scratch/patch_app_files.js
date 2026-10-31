const fs = require('fs');

const channelModalCode = `
// Interactive First-Login OTP Delivery Method (SMS or Email) Selection Modal presenter
function showOtpChannelSelectionModal(cleanId, password, otpData) {
    let modal = document.getElementById('otpChannelModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'otpChannelModal';
        modal.className = 'grantee-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = \`
            <div class="grantee-modal-card channel-modal-card">
                <div class="grantee-modal-handle"></div>
                <button type="button" class="grantee-modal-close" id="otpChannelModalCloseBtn" aria-label="Close modal">
                    <i data-lucide="x"></i>
                </button>

                <div class="grantee-hero-icon-wrapper">
                    <div class="grantee-hero-icon" style="background: linear-gradient(135deg, rgba(10,25,49,0.08) 0%, rgba(245,176,37,0.18) 100%); border-color: rgba(245,176,37,0.45); color: #0A1931;">
                        <i data-lucide="shield-check" style="color: #0A1931;"></i>
                    </div>
                </div>

                <div class="grantee-eyebrow-wrapper">
                    <span class="grantee-eyebrow-badge" style="background: #FFFBEB; border-color: #FDE68A; color: #92400E;">
                        <i data-lucide="key-round" style="color: #F59E0B;"></i> FIRST-TIME LOGIN SECURITY SETUP
                    </span>
                </div>

                <h2 class="grantee-modal-title" style="text-align: center;">Choose Verification Method</h2>
                <p class="grantee-modal-subtitle" style="text-align: center; margin-bottom: 18px;">
                    Welcome, <strong id="channelStudentName">Student Scholar</strong>! For your account protection, select where you would like to receive your 6-digit one-time password (OTP):
                </p>

                <div class="alert-banner error hidden" id="channelModalError" style="margin-bottom: 16px;">
                    <i data-lucide="alert-circle"></i>
                    <span id="channelModalErrorMsg"></span>
                </div>

                <div class="channel-options-group" role="radiogroup" aria-label="Verification delivery method">
                    <!-- SMS Card -->
                    <label class="channel-option-card selected" id="smsOptionCard" for="channelRadioSms">
                        <input type="radio" name="otpDeliveryChannel" id="channelRadioSms" value="sms" checked>
                        <div class="channel-icon-box">
                            <i data-lucide="message-square"></i>
                        </div>
                        <div class="channel-text-content">
                            <div class="channel-header-row">
                                <span class="channel-name">SMS / Mobile Number</span>
                                <span class="channel-badge instant-badge" id="smsBadgeLabel">Instant SMS</span>
                            </div>
                            <div class="channel-target" id="channelDisplayPhone">Loading mobile...</div>
                            <div class="channel-desc">Dispatched directly to your registered mobile number</div>
                        </div>
                        <div class="channel-radio-indicator">
                            <i data-lucide="check"></i>
                        </div>
                    </label>

                    <!-- Email Card -->
                    <label class="channel-option-card" id="emailOptionCard" for="channelRadioEmail">
                        <input type="radio" name="otpDeliveryChannel" id="channelRadioEmail" value="email">
                        <div class="channel-icon-box">
                            <i data-lucide="mail"></i>
                        </div>
                        <div class="channel-text-content">
                            <div class="channel-header-row">
                                <span class="channel-name">Email Address</span>
                                <span class="channel-badge official-badge" id="emailBadgeLabel">Official Email</span>
                            </div>
                            <div class="channel-target" id="channelDisplayEmail">Loading email...</div>
                            <div class="channel-desc">Dispatched to your registered scholar email address</div>
                        </div>
                        <div class="channel-radio-indicator">
                            <i data-lucide="check"></i>
                        </div>
                    </label>
                </div>

                <div class="channel-security-note">
                    <i data-lucide="lock"></i>
                    <span>Your OTP code is single-use and will remain valid for 10 minutes.</span>
                </div>

                <div class="grantee-modal-actions" style="margin-top: 18px;">
                    <button type="button" class="grantee-btn-primary" id="btnSendOtpChoice">
                        <span id="btnSendOtpChoiceText"><i data-lucide="send" style="width:16px;height:16px;margin-right:6px;vertical-align:-2px;"></i> Send Verification Code</span>
                        <div class="spinner hidden" id="btnSendOtpSpinner"></div>
                    </button>
                    <button type="button" class="grantee-btn-secondary" id="btnCancelChannelSelection">
                        Back to Login
                    </button>
                </div>
            </div>
        \`;
        document.body.appendChild(modal);
    }

    // Populate data
    const nameEl = modal.querySelector('#channelStudentName');
    const phoneEl = modal.querySelector('#channelDisplayPhone');
    const emailEl = modal.querySelector('#channelDisplayEmail');
    const smsCard = modal.querySelector('#smsOptionCard');
    const emailCard = modal.querySelector('#emailOptionCard');
    const smsRadio = modal.querySelector('#channelRadioSms');
    const emailRadio = modal.querySelector('#channelRadioEmail');
    const smsBadge = modal.querySelector('#smsBadgeLabel');
    const emailBadge = modal.querySelector('#emailBadgeLabel');
    const errorBox = modal.querySelector('#channelModalError');
    const errorMsg = modal.querySelector('#channelModalErrorMsg');
    const sendBtn = modal.querySelector('#btnSendOtpChoice');
    const sendBtnText = modal.querySelector('#btnSendOtpChoiceText');
    const sendBtnSpinner = modal.querySelector('#btnSendOtpSpinner');
    const closeBtn = modal.querySelector('#otpChannelModalCloseBtn');
    const cancelBtn = modal.querySelector('#btnCancelChannelSelection');

    if (errorBox) errorBox.classList.add('hidden');

    if (nameEl) nameEl.textContent = otpData.fullName || 'Student Scholar';
    if (phoneEl) phoneEl.textContent = otpData.maskedPhone || 'Not registered';
    if (emailEl) emailEl.textContent = otpData.maskedEmail || 'Not registered';

    const canSms = Boolean(otpData.availableChannels && otpData.availableChannels.sms);
    const canEmail = Boolean(otpData.availableChannels && otpData.availableChannels.email);

    if (smsCard && smsRadio) {
        if (!canSms) {
            smsCard.classList.add('disabled');
            smsRadio.disabled = true;
            if (smsBadge) {
                smsBadge.textContent = 'Unavailable';
                smsBadge.className = 'channel-badge unavailable-badge';
            }
        } else {
            smsCard.classList.remove('disabled');
            smsRadio.disabled = false;
            if (smsBadge) {
                smsBadge.textContent = 'Instant SMS';
                smsBadge.className = 'channel-badge instant-badge';
            }
        }
    }

    if (emailCard && emailRadio) {
        if (!canEmail) {
            emailCard.classList.add('disabled');
            emailRadio.disabled = true;
            if (emailBadge) {
                emailBadge.textContent = 'Unavailable';
                emailBadge.className = 'channel-badge unavailable-badge';
            }
        } else {
            emailCard.classList.remove('disabled');
            emailRadio.disabled = false;
            if (emailBadge) {
                emailBadge.textContent = 'Official Email';
                emailBadge.className = 'channel-badge official-badge';
            }
        }
    }

    // Default selection: choose SMS if available, otherwise Email
    let currentSelected = canSms ? 'sms' : (canEmail ? 'email' : 'sms');
    const updateSelection = (channel) => {
        currentSelected = channel;
        if (channel === 'sms' && canSms) {
            smsCard?.classList.add('selected');
            emailCard?.classList.remove('selected');
            if (smsRadio) smsRadio.checked = true;
            if (emailRadio) emailRadio.checked = false;
        } else if (channel === 'email' && canEmail) {
            emailCard?.classList.add('selected');
            smsCard?.classList.remove('selected');
            if (emailRadio) emailRadio.checked = true;
            if (smsRadio) smsRadio.checked = false;
        }
    };
    updateSelection(currentSelected);

    if (smsCard && canSms) {
        smsCard.onclick = () => updateSelection('sms');
    }
    if (emailCard && canEmail) {
        emailCard.onclick = () => updateSelection('email');
    }

    if (window.lucide) lucide.createIcons();

    // Show modal
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Send Button click handler
    if (sendBtn) {
        sendBtn.onclick = async () => {
            if (errorBox) errorBox.classList.add('hidden');
            if (sendBtn) sendBtn.disabled = true;
            if (sendBtnText) sendBtnText.classList.add('hidden');
            if (sendBtnSpinner) sendBtnSpinner.classList.remove('hidden');

            try {
                const res = await fetch('/api/auth/student-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId: cleanId,
                        password: password,
                        channel: currentSelected
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || data.message || ('Failed to send OTP via ' + currentSelected.toUpperCase() + '.'));
                }

                // Store in session storage
                try {
                    sessionStorage.setItem('scholardoc_pending_otp_student', JSON.stringify({
                        studentId: cleanId,
                        password: password,
                        channel: currentSelected,
                        maskedPhone: data.maskedPhone || otpData.maskedPhone,
                        maskedEmail: data.maskedEmail || otpData.maskedEmail,
                        availableChannels: data.availableChannels || otpData.availableChannels,
                        expiresIn: data.expiresIn || 600,
                        resendCooldown: data.resendCooldown || 30
                    }));
                } catch (_) {}

                // Redirect to OTP verification page
                window.location.href = '/otp.html?student_id=' + encodeURIComponent(cleanId) + '&channel=' + encodeURIComponent(currentSelected);

            } catch (err) {
                if (errorBox && errorMsg) {
                    errorMsg.textContent = err.message || 'An error occurred while dispatching the OTP. Please try again.';
                    errorBox.classList.remove('hidden');
                }
                if (sendBtn) sendBtn.disabled = false;
                if (sendBtnText) sendBtnText.classList.remove('hidden');
                if (sendBtnSpinner) sendBtnSpinner.classList.add('hidden');
            }
        };
    }
}
`;

const files = [
    'superadmin_web/app.js',
    'admin_web/app.js',
    'student_web/app.js'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    // 1. Insert showOtpChannelSelectionModal function if not present
    if (!content.includes('function showOtpChannelSelectionModal')) {
        const insertAfterTarget = "document.addEventListener('keydown', onKeydown);\n}";
        if (content.includes(insertAfterTarget)) {
            content = content.replace(insertAfterTarget, insertAfterTarget + '\n' + channelModalCode);
        } else {
            console.error('Could not find insert anchor in ' + file);
            continue;
        }
    }

    // 2. Update requiresOtp handling in form submit
    const oldOtpBlock = `                // If First Login: DO NOT ALLOW ACCESS TO SYSTEM. Redirect to OTP verification page!
                if (otpData.requiresOtp === true) {
                    try {
                        sessionStorage.setItem('scholardoc_pending_otp_student', JSON.stringify({
                            studentId: cleanId,
                            password: password,
                            maskedPhone: otpData.maskedPhone,
                            expiresIn: otpData.expiresIn || 300,
                            resendCooldown: otpData.resendCooldown || 60
                        }));
                    } catch (_) {}
                    window.location.href = \`/otp.html?student_id=\${encodeURIComponent(cleanId)}&phone=\${encodeURIComponent(otpData.maskedPhone || '')}\`;
                    return;
                }`;

    const newOtpBlock = `                // If First Login: DO NOT ALLOW ACCESS TO SYSTEM. Channel selection & OTP required!
                if (otpData.requiresOtp === true) {
                    setLoading(false);
                    if (otpData.requiresChannelSelection === true) {
                        showOtpChannelSelectionModal(cleanId, password, otpData);
                        return;
                    }
                    try {
                        sessionStorage.setItem('scholardoc_pending_otp_student', JSON.stringify({
                            studentId: cleanId,
                            password: password,
                            channel: otpData.channel || 'sms',
                            maskedPhone: otpData.maskedPhone,
                            maskedEmail: otpData.maskedEmail,
                            availableChannels: otpData.availableChannels,
                            expiresIn: otpData.expiresIn || 600,
                            resendCooldown: otpData.resendCooldown || 30
                        }));
                    } catch (_) {}
                    window.location.href = \`/otp.html?student_id=\${encodeURIComponent(cleanId)}&channel=\${encodeURIComponent(otpData.channel || 'sms')}\`;
                    return;
                }`;

    if (content.includes(oldOtpBlock)) {
        content = content.replace(oldOtpBlock, newOtpBlock);
        console.log('Updated OTP handling in ' + file);
    } else {
        console.warn('Old OTP block not matched in ' + file);
    }

    fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log('Successfully updated ' + file);
}
