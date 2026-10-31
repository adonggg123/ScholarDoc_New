const fs = require('fs');

const modalHtml = `
    <!-- OTP CHANNEL SELECTION MODAL -->
    <div id="otpChannelModal" class="grantee-modal-backdrop" aria-hidden="true" role="dialog" aria-modal="true">
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
                <!-- SMS Option -->
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

                <!-- Email Option -->
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
    </div>
`;

const files = [
    'login.html',
    'superadmin_web/login.html',
    'admin_web/login.html'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (content.includes('id="otpChannelModal"')) {
        console.log(`otpChannelModal already exists in ${file}`);
        continue;
    }

    const anchor = '<script type="module" src="app.js"></script>';
    if (content.includes(anchor)) {
        content = content.replace(anchor, modalHtml + '\n    ' + anchor);
        fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
        console.log(`Added otpChannelModal to ${file}`);
    } else {
        console.warn(`Anchor not found in ${file}`);
    }
}

