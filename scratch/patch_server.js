const fs = require('fs');

const serverFile = 'server.js';
let content = fs.readFileSync(serverFile, 'utf8');

const targetStr = `                // 4. Resolve Registered SMS & Email Delivery Targets
                const contacts = resolveGranteeOtpContacts(grantee);
                const smsConfigured = Boolean(getSemaphoreApiKey());
                const emailConfigured = Boolean(getGmailTransporter({ pooled: true }));
                const canSendSms = contacts.hasSms && smsConfigured;
                const canSendEmail = contacts.hasEmail && emailConfigured;

                if (!contacts.hasSms && !contacts.hasEmail) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        isFirstLogin: true,
                        error: \`No valid Philippine mobile number or email address is registered for Student ID "\${cleanId}". Please visit the Scholarship Office to register your contact details.\`
                    }));
                    return;
                }

                // Determine initial delivery channel
                let selectedChannel = 'sms';
                if (requestedChannelRaw === 'email') {
                    if (!contacts.hasEmail) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            isFirstLogin: true,
                            error: \`No valid email address is registered for Student ID "\${cleanId}". Please choose SMS delivery instead.\`
                        }));
                        return;
                    }
                    selectedChannel = 'email';
                } else if (requestedChannelRaw === 'sms') {
                    if (!contacts.hasSms) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            isFirstLogin: true,
                            error: \`No valid Philippine mobile number is registered for Student ID "\${cleanId}". Please choose Email delivery instead.\`
                        }));
                        return;
                    }
                    selectedChannel = 'sms';
                } else {
                    // Default preference: SMS when valid & configured, automatically falling back to Email if SMS unavailable
                    if (canSendSms) selectedChannel = 'sms';
                    else if (canSendEmail) selectedChannel = 'email';
                    else selectedChannel = contacts.hasSms ? 'sms' : 'email';
                }

                if (selectedChannel === 'sms' && !smsConfigured) {
                    if (canSendEmail) {
                        selectedChannel = 'email';
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'SMS gateway is not configured on the server (missing SEMAPHORE_API_KEY).'
                        }));
                        return;
                    }
                }
                if (selectedChannel === 'email' && !emailConfigured) {
                    if (canSendSms) {
                        selectedChannel = 'sms';
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Email SMTP gateway is not configured on the server.'
                        }));
                        return;
                    }
                }

                const availableChannels = {
                    sms: contacts.hasSms,
                    email: contacts.hasEmail
                };
                const displayMaskedPhone = contacts.maskedPhone || 'Not registered';
                const displayMaskedEmail = contacts.maskedEmail || null;`;

const replacementStr = `                // 4. Resolve Registered SMS & Email Delivery Targets
                const contacts = resolveGranteeOtpContacts(grantee);
                const smsConfigured = Boolean(getSemaphoreApiKey());
                const emailConfigured = Boolean(getGmailTransporter({ pooled: true }));
                const canSendSms = Boolean(contacts.hasSms && smsConfigured);
                const canSendEmail = Boolean(contacts.hasEmail && emailConfigured);

                const availableChannels = {
                    sms: canSendSms,
                    email: canSendEmail
                };
                const displayMaskedPhone = contacts.maskedPhone || 'Not registered';
                const displayMaskedEmail = contacts.maskedEmail || 'Not registered';

                if (!contacts.hasSms && !contacts.hasEmail) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        isFirstLogin: true,
                        error: \`No valid Philippine mobile number or email address is registered for Student ID "\${cleanId}". Please visit the Scholarship Office to register your contact details.\`
                    }));
                    return;
                }

                if (!canSendSms && !canSendEmail) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        isFirstLogin: true,
                        error: 'Both SMS and Email dispatch gateways are temporarily unavailable on the server. Please contact system support.'
                    }));
                    return;
                }

                // 4.1 First-Login Workflow: User must first choose their preferred OTP delivery method (SMS or Email)
                if (!requestedChannelRaw) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        requiresOtp: true,
                        isFirstLogin: true,
                        requiresChannelSelection: true,
                        studentId: cleanId,
                        fullName: grantee.full_name || grantee.fullName || 'Student Scholar',
                        maskedPhone: displayMaskedPhone,
                        maskedEmail: displayMaskedEmail,
                        availableChannels,
                        message: 'Credentials verified. Please choose your preferred OTP delivery method (SMS or Email).'
                    }));
                    return;
                }

                // Determine chosen delivery channel
                let selectedChannel = '';
                if (requestedChannelRaw === 'email') {
                    if (!canSendEmail) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            isFirstLogin: true,
                            requiresChannelSelection: true,
                            availableChannels,
                            error: !contacts.hasEmail
                                ? \`No valid email address is registered for Student ID "\${cleanId}". Please choose SMS delivery instead.\`
                                : 'Email SMTP gateway is temporarily unavailable. Please choose SMS delivery instead.'
                        }));
                        return;
                    }
                    selectedChannel = 'email';
                } else if (requestedChannelRaw === 'sms') {
                    if (!canSendSms) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            isFirstLogin: true,
                            requiresChannelSelection: true,
                            availableChannels,
                            error: !contacts.hasSms
                                ? \`No valid Philippine mobile number is registered for Student ID "\${cleanId}". Please choose Email delivery instead.\`
                                : 'SMS gateway is temporarily unavailable. Please choose Email delivery instead.'
                        }));
                        return;
                    }
                    selectedChannel = 'sms';
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: \`Invalid delivery channel "\${requestedChannelRaw}". Please select either SMS or Email.\`
                    }));
                    return;
                }`;

// Normalize line breaks for matching
const normalize = s => s.replace(/\r\n/g, '\n');
const normContent = normalize(content);
const normTarget = normalize(targetStr);
const normReplacement = normalize(replacementStr);

if (!normContent.includes(normTarget)) {
    console.error('Target string not found in server.js');
    process.exit(1);
}

const updated = normContent.replace(normTarget, normReplacement);
// Write back using original CRLF
fs.writeFileSync(serverFile, updated.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully patched server.js!');

