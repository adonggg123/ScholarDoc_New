const fs = require('fs');

const cssRules = `
/* ─── ScholarDoc OTP Channel Selection Modal ─── */
.channel-modal-card {
    max-width: 480px;
    border-radius: 10px;
    padding: 30px 24px;
}

.channel-options-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
}

.channel-option-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 2px solid #E2E8F0;
    border-radius: 10px;
    background: #FFFFFF;
    cursor: pointer;
    position: relative;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: left;
}

.channel-option-card input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.channel-option-card:hover:not(.disabled) {
    border-color: #F5B025;
    background: #FFFDF7;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(10, 25, 49, 0.08);
}

.channel-option-card.selected {
    border-color: #F5B025;
    background: #FFFDF7;
    box-shadow: 0 0 0 3px rgba(245, 176, 37, 0.22), 0 6px 16px rgba(245, 176, 37, 0.12);
}

.channel-option-card.disabled {
    opacity: 0.55;
    cursor: not-allowed;
    background: #F8FAFC;
    border-color: #E2E8F0;
}

.channel-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: #F1F5F9;
    color: #0A1931;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
}

.channel-icon-box i {
    width: 20px;
    height: 20px;
}

.channel-option-card.selected .channel-icon-box {
    background: #0A1931;
    color: #F5B025;
}

.channel-text-content {
    flex: 1;
    min-width: 0;
}

.channel-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
}

.channel-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #0A1931;
}

.channel-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.instant-badge {
    background: #FEF3C7;
    color: #92400E;
}

.official-badge {
    background: #EFF6FF;
    color: #1E40AF;
}

.unavailable-badge {
    background: #F1F5F9;
    color: #94A3B8;
}

.channel-target {
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    color: #0A1931;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
}

.channel-desc {
    font-size: 11.5px;
    color: #64748B;
}

.channel-radio-indicator {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #CBD5E1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: transparent;
    transition: all 0.2s ease;
}

.channel-radio-indicator i {
    width: 13px;
    height: 13px;
    stroke-width: 3;
}

.channel-option-card.selected .channel-radio-indicator {
    background: #F5B025;
    border-color: #F5B025;
    color: #FFFFFF;
}

.channel-security-note {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #64748B;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 8px 12px;
    margin-top: 10px;
}

.channel-security-note i {
    width: 14px;
    height: 14px;
    color: #0A1931;
    flex-shrink: 0;
}
`;

const files = [
    'superadmin_web/style.css',
    'admin_web/style.css',
    'student_web/style.css'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        if (!content.includes('channel-option-card')) {
            content += '\n' + cssRules;
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Appended channel modal styles to ${file}`);
        } else {
            console.log(`Styles already present in ${file}`);
        }
    }
}

