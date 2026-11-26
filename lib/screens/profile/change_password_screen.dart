import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../services/password_policy.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'password_change_otp_screen.dart';

typedef PasswordChangePrepareCallback = Future<Map<String, dynamic>> Function({
  required String currentPassword,
  required String newPassword,
  required String confirmPassword,
});

typedef PasswordUpdateCallback = Future<void> Function({
  required String currentPassword,
  required String newPassword,
  required String confirmPassword,
  required String otpVerificationToken,
  String? otpChannel,
});

class ChangePasswordScreen extends StatefulWidget {
  final String? studentId;
  final bool hasCustomPassword;
  final DateTime? passwordUpdatedAt;
  final PasswordChangePrepareCallback? onPreparePasswordChange;
  final PasswordChangeSendOtpFn? onSendPasswordChangeOtp;
  final PasswordChangeVerifyOtpFn? onVerifyPasswordChangeOtp;
  final PasswordChangePollStatusFn? onPollOtpDeliveryStatus;
  final PasswordUpdateCallback? onUpdatePassword;

  const ChangePasswordScreen({
    super.key,
    this.studentId,
    this.hasCustomPassword = false,
    this.passwordUpdatedAt,
    this.onPreparePasswordChange,
    this.onSendPasswordChangeOtp,
    this.onVerifyPasswordChangeOtp,
    this.onPollOtpDeliveryStatus,
    this.onUpdatePassword,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final _currentFocusNode = FocusNode();
  final _newFocusNode = FocusNode();
  final _confirmFocusNode = FocusNode();

  AuthService? _authService;

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isSubmitting = false;
  bool _isUpdatingAfterOtp = false;
  String? _errorMessage;

  List<String> get _studentIdVariants {
    final raw = (widget.studentId ?? '').trim();
    if (raw.isEmpty) return const [];
    final stripped = raw.replaceAll('-', '').replaceAll(' ', '');
    return {
      raw,
      if (stripped.isNotEmpty) stripped,
    }.toList();
  }

  @override
  void initState() {
    super.initState();
    _currentPasswordController.addListener(_onInputChanged);
    _newPasswordController.addListener(_onInputChanged);
    _confirmPasswordController.addListener(_onInputChanged);
  }

  void _onInputChanged() {
    if (!mounted) return;
    setState(() {
      if (_errorMessage != null) {
        _errorMessage = null;
      }
    });
  }

  @override
  void dispose() {
    _currentPasswordController.removeListener(_onInputChanged);
    _newPasswordController.removeListener(_onInputChanged);
    _confirmPasswordController.removeListener(_onInputChanged);

    // Clear sensitive text buffers before disposing
    _currentPasswordController.clear();
    _newPasswordController.clear();
    _confirmPasswordController.clear();

    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _currentFocusNode.dispose();
    _newFocusNode.dispose();
    _confirmFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;
    FocusScope.of(context).unfocus();

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _isUpdatingAfterOtp = false;
      _errorMessage = null;
    });

    try {
      final currentPwd = _currentPasswordController.text;
      final newPwd = _newPasswordController.text;
      final confirmPwd = _confirmPasswordController.text;

      // Step 1: Validate current password & fetch available OTP channels (Email / SMS)
      final prepareFn = widget.onPreparePasswordChange ??
          (_authService ??= AuthService()).preparePasswordChange;
      final channelInfo = await prepareFn(
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
      );

      if (!mounted) return;
      final resolvedStudentId = (channelInfo['studentId']?.toString().trim() ?? '')
              .isNotEmpty
          ? channelInfo['studentId'].toString().trim()
          : (widget.studentId ?? '').trim();

      if (resolvedStudentId.isEmpty) {
        throw Exception(
          'Unable to resolve your Student ID for verification. Please sign in again.',
        );
      }

      // Pause form spinner while student selects Email/SMS and completes OTP verification
      setState(() => _isSubmitting = false);

      // Step 2: Require student to choose Email or SMS and dispatch OTP
      final sendRes = await _showVerificationMethodModal(
        studentId: resolvedStudentId,
        channelInfo: channelInfo,
      );

      if (!mounted || sendRes == null) {
        // User cancelled method selection — do NOT update password
        return;
      }

      // Step 3: Navigate to dedicated Password Change OTP Verification Screen
      final otpResult = await _openPasswordChangeOtpScreen(
        studentId: resolvedStudentId,
        sendRes: sendRes,
      );

      if (!mounted || otpResult == null || otpResult.verificationToken.isEmpty) {
        // User cancelled or did not verify OTP — do NOT update password
        return;
      }

      // Step 4: OTP verified — execute password update with verified proof token
      setState(() {
        _isSubmitting = true;
        _isUpdatingAfterOtp = true;
        _errorMessage = null;
      });

      final updateFn = widget.onUpdatePassword ??
          (_authService ??= AuthService()).updateStudentPassword;

      await updateFn(
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
        otpVerificationToken: otpResult.verificationToken,
        otpChannel: otpResult.channel,
      );

      // Immediately clear plaintext fields from controllers
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();

      try {
        HapticFeedback.mediumImpact();
      } catch (_) {}

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final cleaned = e
          .toString()
          .replaceAll(RegExp(r'^Exception:\s*'), '')
          .trim();
      setState(() {
        _errorMessage = cleaned.isNotEmpty
            ? cleaned
            : 'Unable to update password. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _isUpdatingAfterOtp = false;
        });
      }
    }
  }

  Future<Map<String, dynamic>?> _showVerificationMethodModal({
    required String studentId,
    required Map<String, dynamic> channelInfo,
  }) {
    final maskedPhone =
        (channelInfo['maskedPhone'] as String?) ?? 'Not registered';
    final maskedEmail =
        (channelInfo['maskedEmail'] as String?) ?? 'Not registered';
    final availRaw = channelInfo['availableChannels'];
    final availMap = availRaw is Map ? availRaw : const {};
    final bool canSms = availMap['sms'] is bool
        ? (availMap['sms'] as bool)
        : (maskedPhone != 'Not registered' && maskedPhone.trim().isNotEmpty);
    final bool canEmail = availMap['email'] is bool
        ? (availMap['email'] as bool)
        : (maskedEmail != 'Not registered' && maskedEmail.trim().isNotEmpty);

    // Require explicit user choice when both Email and SMS are available;
    // pre-select only when a single channel is available.
    String? selectedChannel;
    if (canEmail && !canSms) {
      selectedChannel = 'email';
    } else if (canSms && !canEmail) {
      selectedChannel = 'sms';
    }

    bool isSending = false;
    String? modalError;

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            final bool isDark = modalContext.isDark;
            final bool canSubmit =
                !isSending && selectedChannel != null && (canEmail || canSms);
            final String buttonLabel = selectedChannel == 'email'
                ? 'Send Code via Email'
                : (selectedChannel == 'sms'
                    ? 'Send Code via SMS'
                    : 'Select Email or SMS to Continue');

            return Container(
              key: const Key('pwd_otp_method_modal'),
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(modalContext).size.height * 0.90,
              ),
              decoration: BoxDecoration(
                color: modalContext.surfaceC,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                border: Border(
                  top: BorderSide(color: modalContext.crispBorder, width: 1.5),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x330F172A),
                    blurRadius: 32,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: SingleChildScrollView(
                  padding: EdgeInsets.only(
                    left: 22,
                    right: 22,
                    top: 14,
                    bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Drag handle
                      Center(
                        child: Container(
                          width: 44,
                          height: 4,
                          decoration: BoxDecoration(
                            color: modalContext.crispBorder,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Shield icon badge
                      Center(
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFFBC02D)
                                .withValues(alpha: isDark ? 0.16 : 0.2),
                            border: Border.all(
                              color: const Color(0xFFFBC02D)
                                  .withValues(alpha: 0.6),
                              width: 1.8,
                            ),
                          ),
                          child: Icon(
                            LucideIcons.shieldCheck,
                            color: isDark
                                ? const Color(0xFFFBC02D)
                                : const Color(0xFF0F3260),
                            size: 26,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Eyebrow pill
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: modalContext.bgC,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: modalContext.crispBorder),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                LucideIcons.keyRound,
                                size: 12,
                                color: Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                'PASSWORD CHANGE VERIFICATION',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                  color: modalContext.textPri,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      Text(
                        'Choose Verification Method',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 19.5,
                          fontWeight: FontWeight.w800,
                          color: modalContext.textPri,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Before updating your password, select where you would like to receive your 6-digit One-Time Password (OTP):',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: modalContext.textSec,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 16),

                      if (modalError != null) ...[
                        Container(
                          key: const Key('pwd_otp_method_error_banner'),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppTheme.error
                                .withValues(alpha: isDark ? 0.18 : 0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: AppTheme.error.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                LucideIcons.alertCircle,
                                color: AppTheme.error,
                                size: 16,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  modalError!,
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isDark
                                        ? const Color(0xFFFCA5A5)
                                        : const Color(0xFFB91C1C),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Option 1: Email
                      _buildVerificationMethodCard(
                        context: modalContext,
                        cardKey: const Key('pwd_otp_method_email'),
                        title: 'Email Address',
                        badge: 'Fast Inbox',
                        badgeBg: isDark
                            ? const Color(0xFF1E3A8A).withValues(alpha: 0.4)
                            : const Color(0xFFEFF6FF),
                        badgeFg: isDark
                            ? const Color(0xFF93C5FD)
                            : const Color(0xFF1E40AF),
                        target: maskedEmail,
                        description:
                            'Receive your 6-digit code in your registered email inbox',
                        icon: LucideIcons.mail,
                        isSelected: selectedChannel == 'email',
                        isEnabled: canEmail,
                        onTap: () {
                          if (!canEmail || isSending) return;
                          setModalState(() {
                            selectedChannel = 'email';
                            modalError = null;
                          });
                        },
                      ),
                      const SizedBox(height: 10),

                      // Option 2: SMS
                      _buildVerificationMethodCard(
                        context: modalContext,
                        cardKey: const Key('pwd_otp_method_sms'),
                        title: 'SMS / Mobile Number',
                        badge: 'Instant SMS',
                        badgeBg: isDark
                            ? const Color(0xFF92400E).withValues(alpha: 0.35)
                            : const Color(0xFFFEF3C7),
                        badgeFg: isDark
                            ? const Color(0xFFFDE68A)
                            : const Color(0xFF92400E),
                        target: maskedPhone,
                        description:
                            'Receive your 6-digit code via SMS on your registered mobile',
                        icon: LucideIcons.messageSquare,
                        isSelected: selectedChannel == 'sms',
                        isEnabled: canSms,
                        onTap: () {
                          if (!canSms || isSending) return;
                          setModalState(() {
                            selectedChannel = 'sms';
                            modalError = null;
                          });
                        },
                      ),
                      const SizedBox(height: 14),

                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: modalContext.bgC,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: modalContext.crispBorder),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              LucideIcons.lock,
                              size: 13,
                              color: _accentIconColor(modalContext),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Your verification code is single-use and valid for 10 minutes.',
                                style: GoogleFonts.inter(
                                  fontSize: 11.5,
                                  color: modalContext.textSec,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Primary CTA: Send Verification Code
                      SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          key: const Key('pwd_otp_send_method_button'),
                          onPressed: canSubmit
                              ? () async {
                                  final chosen = selectedChannel!;
                                  setModalState(() {
                                    isSending = true;
                                    modalError = null;
                                  });
                                  try {
                                    final sendFn =
                                        widget.onSendPasswordChangeOtp ??
                                            (_authService ??= AuthService())
                                                .sendPasswordChangeOtp;
                                    final sendRes = await sendFn(
                                      studentId: studentId,
                                      channel: chosen,
                                    );
                                    if (!sheetCtx.mounted) return;
                                    Navigator.of(sheetCtx).pop({
                                      ...sendRes,
                                      'channel':
                                          sendRes['channel'] ?? chosen,
                                      'maskedPhone':
                                          sendRes['maskedPhone'] ?? maskedPhone,
                                      'maskedEmail':
                                          sendRes['maskedEmail'] ?? maskedEmail,
                                      'availableChannels':
                                          sendRes['availableChannels'] ??
                                              {
                                                'sms': canSms,
                                                'email': canEmail,
                                              },
                                    });
                                  } catch (e) {
                                    setModalState(() {
                                      isSending = false;
                                      modalError = e
                                          .toString()
                                          .replaceAll(
                                            RegExp(r'^Exception:\s*'),
                                            '',
                                          )
                                          .trim();
                                    });
                                  }
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFFBC02D),
                            foregroundColor: const Color(0xFF0A1931),
                            disabledBackgroundColor:
                                modalContext.crispBorder,
                            disabledForegroundColor: modalContext.textSec,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: isSending
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    valueColor: AlwaysStoppedAnimation(
                                      Color(0xFF0A1931),
                                    ),
                                  ),
                                )
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      selectedChannel == 'email'
                                          ? LucideIcons.mail
                                          : (selectedChannel == 'sms'
                                              ? LucideIcons.send
                                              : LucideIcons.shieldCheck),
                                      size: 16,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      buttonLabel,
                                      style: GoogleFonts.inter(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      TextButton(
                        key: const Key('pwd_otp_method_cancel_button'),
                        onPressed: isSending
                            ? null
                            : () => Navigator.of(sheetCtx).pop(null),
                        child: Text(
                          'Cancel',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: modalContext.textSec,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildVerificationMethodCard({
    required BuildContext context,
    required Key cardKey,
    required String title,
    required String badge,
    required Color badgeBg,
    required Color badgeFg,
    required String target,
    required String description,
    required IconData icon,
    required bool isSelected,
    required bool isEnabled,
    required VoidCallback onTap,
  }) {
    final bool isDark = context.isDark;
    final Color activeBorder =
        isDark ? const Color(0xFFFBC02D) : const Color(0xFF0F3260);

    return GestureDetector(
      key: cardKey,
      onTap: isEnabled ? onTap : null,
      child: Opacity(
        opacity: isEnabled ? 1.0 : 0.52,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark
                    ? const Color(0xFFFBC02D).withValues(alpha: 0.1)
                    : const Color(0xFFF8FAFC))
                : context.bgC,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? activeBorder : context.crispBorder,
              width: isSelected ? 2.0 : 1.2,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: isSelected
                      ? activeBorder.withValues(alpha: isDark ? 0.2 : 0.1)
                      : context.surfaceC,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: context.crispBorder),
                ),
                child: Icon(
                  icon,
                  size: 19,
                  color: isSelected ? activeBorder : context.textSec,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                              color: context.textPri,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: isEnabled ? badgeBg : context.surfaceC,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isEnabled ? badge : 'Not linked',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isEnabled ? badgeFg : context.textSec,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      target,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: isEnabled ? activeBorder : context.textSec,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: context.textSec,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                isSelected
                    ? LucideIcons.checkCircle2
                    : LucideIcons.circle,
                size: 20,
                color: isSelected
                    ? const Color(0xFF16A34A)
                    : context.crispBorder,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<PasswordChangeOtpResult?> _openPasswordChangeOtpScreen({
    required String studentId,
    required Map<String, dynamic> sendRes,
  }) {
    final maskedPhone =
        (sendRes['maskedPhone'] as String?) ?? 'Not registered';
    final maskedEmail = sendRes['maskedEmail'] as String?;
    final initialChannel = (sendRes['channel'] as String?) ?? 'email';
    final availRaw = sendRes['availableChannels'];
    final availMap = availRaw is Map ? availRaw : const {};
    final smsAvailable =
        availMap['sms'] is bool ? (availMap['sms'] as bool) : true;
    final emailAvailable = availMap['email'] is bool
        ? (availMap['email'] as bool)
        : (maskedEmail != null && maskedEmail.trim().isNotEmpty);
    final deliveryStatus = (sendRes['deliveryStatus'] as String?) ?? 'sent';
    final deliveryMessage =
        (sendRes['deliveryMessage'] as String?) ?? (sendRes['message'] as String?);
    final deliveryError = sendRes['deliveryError'] as String?;
    final deliveryLatencyMs = (sendRes['deliveryLatencyMs'] as num?)?.toInt();
    final challengeToken = sendRes['challengeToken'] as String?;

    Map<String, int>? channelCooldowns;
    final cooldownsRaw = sendRes['channelCooldowns'];
    if (cooldownsRaw is Map) {
      channelCooldowns = {
        'sms': (cooldownsRaw['sms'] as num?)?.toInt() ?? 0,
        'email': (cooldownsRaw['email'] as num?)?.toInt() ?? 0,
      };
    }

    final expiresIn = (sendRes['expiresIn'] as num?)?.toInt() ?? 600;
    final resendCooldown = (sendRes['resendCooldown'] as num?)?.toInt() ?? 30;

    return Navigator.of(context).push<PasswordChangeOtpResult>(
      MaterialPageRoute(
        builder: (_) => PasswordChangeOtpScreen(
          studentId: studentId,
          maskedPhone: maskedPhone,
          maskedEmail: maskedEmail,
          initialChannel: initialChannel,
          smsAvailable: smsAvailable,
          emailAvailable: emailAvailable,
          initialDeliveryStatus: deliveryStatus,
          initialDeliveryMessage: deliveryMessage,
          initialDeliveryError: deliveryError,
          initialDeliveryLatencyMs: deliveryLatencyMs,
          initialChannelCooldowns: channelCooldowns,
          expiresIn: expiresIn,
          resendCooldown: resendCooldown,
          initialChallengeToken: challengeToken,
          onSendOtp: widget.onSendPasswordChangeOtp,
          onVerifyOtp: widget.onVerifyPasswordChangeOtp,
          onPollDeliveryStatus: widget.onPollOtpDeliveryStatus,
        ),
      ),
    );
  }

  Color _accentIconColor(BuildContext context) =>
      context.isDark ? const Color(0xFFFBC02D) : AppTheme.primaryColor;

  Color _strengthColor(PasswordStrengthLevel level) {
    switch (level) {
      case PasswordStrengthLevel.weak:
        return AppTheme.error;
      case PasswordStrengthLevel.fair:
        return const Color(0xFFF59E0B);
      case PasswordStrengthLevel.good:
        return const Color(0xFF2563EB);
      case PasswordStrengthLevel.strong:
        return AppTheme.success;
      case PasswordStrengthLevel.empty:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final newPassword = _newPasswordController.text;
    final currentPassword = _currentPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final strength = PasswordPolicy.evaluateStrength(newPassword);

    final bool ruleLength = PasswordPolicy.hasMinLength(newPassword);
    final bool ruleCase = PasswordPolicy.hasUppercase(newPassword) &&
        PasswordPolicy.hasLowercase(newPassword);
    final bool ruleDigit = PasswordPolicy.hasDigit(newPassword);
    final bool ruleDistinct = newPassword.isNotEmpty &&
        PasswordPolicy.isDifferentFromCurrent(newPassword, currentPassword) &&
        PasswordPolicy.isNotStudentId(newPassword, _studentIdVariants);
    final bool ruleNoSpaces = newPassword.isNotEmpty &&
        PasswordPolicy.hasNoEdgeWhitespace(newPassword);

    final bool confirmMatches = confirmPassword.isNotEmpty &&
        newPassword.isNotEmpty &&
        confirmPassword == newPassword;

    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Change Password'),
        backgroundColor: context.surfaceC,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildSecurityHeaderCard(context),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: context.surfaceC,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: context.crispBorder, width: 1.5),
                  boxShadow: AppTheme.softShadow,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_errorMessage != null) ...[
                        _buildErrorBanner(context, _errorMessage!),
                        const SizedBox(height: 16),
                      ],

                      // 1. Current Password
                      _buildFieldLabel(context, 'Current Password *'),
                      TextFormField(
                        key: const Key('current_password_field'),
                        controller: _currentPasswordController,
                        focusNode: _currentFocusNode,
                        obscureText: _obscureCurrent,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _newFocusNode.requestFocus(),
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: context.textPri,
                        ),
                        decoration: _passwordFieldDecoration(
                          context: context,
                          icon: LucideIcons.lock,
                          hintText: 'Enter current password',
                          helperText: widget.hasCustomPassword
                              ? 'Verify your existing password to continue'
                              : 'Use your Student ID if you have not changed your password yet',
                          obscured: _obscureCurrent,
                          toggleKey:
                              const Key('toggle_current_password_visibility'),
                          onToggle: () => setState(
                            () => _obscureCurrent = !_obscureCurrent,
                          ),
                        ),
                        validator: PasswordPolicy.validateCurrentPassword,
                      ),

                      const SizedBox(height: 18),

                      // 2. New Password
                      _buildFieldLabel(context, 'New Password *'),
                      TextFormField(
                        key: const Key('new_password_field'),
                        controller: _newPasswordController,
                        focusNode: _newFocusNode,
                        obscureText: _obscureNew,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.newPassword],
                        onFieldSubmitted: (_) =>
                            _confirmFocusNode.requestFocus(),
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: context.textPri,
                        ),
                        decoration: _passwordFieldDecoration(
                          context: context,
                          icon: LucideIcons.keyRound,
                          hintText: 'Create a strong new password',
                          obscured: _obscureNew,
                          toggleKey:
                              const Key('toggle_new_password_visibility'),
                          onToggle: () =>
                              setState(() => _obscureNew = !_obscureNew),
                        ),
                        validator: (val) => PasswordPolicy.validateNewPassword(
                          val,
                          currentPassword: _currentPasswordController.text.trim(),
                          studentIds: _studentIdVariants,
                        ),
                      ),

                      // Strength Meter Bar
                      if (newPassword.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _buildStrengthMeter(context, strength),
                      ],

                      const SizedBox(height: 14),

                      // Live Requirements Checklist
                      _buildRequirementsCard(
                        context: context,
                        ruleLength: ruleLength,
                        ruleCase: ruleCase,
                        ruleDigit: ruleDigit,
                        ruleDistinct: ruleDistinct,
                        ruleNoSpaces: ruleNoSpaces,
                      ),

                      const SizedBox(height: 18),

                      // 3. Confirm New Password
                      _buildFieldLabel(context, 'Confirm New Password *'),
                      TextFormField(
                        key: const Key('confirm_password_field'),
                        controller: _confirmPasswordController,
                        focusNode: _confirmFocusNode,
                        obscureText: _obscureConfirm,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.newPassword],
                        onFieldSubmitted: (_) => _handleSubmit(),
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: context.textPri,
                        ),
                        decoration: _passwordFieldDecoration(
                          context: context,
                          icon: LucideIcons.shieldCheck,
                          hintText: 'Re-enter your new password',
                          obscured: _obscureConfirm,
                          toggleKey:
                              const Key('toggle_confirm_password_visibility'),
                          onToggle: () => setState(
                            () => _obscureConfirm = !_obscureConfirm,
                          ),
                        ),
                        validator: (val) =>
                            PasswordPolicy.validateConfirmPassword(
                          val,
                          _newPasswordController.text,
                        ),
                      ),

                      if (confirmPassword.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              confirmMatches
                                  ? LucideIcons.checkCircle2
                                  : LucideIcons.alertCircle,
                              size: 14,
                              color: confirmMatches
                                  ? AppTheme.success
                                  : AppTheme.error,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              confirmMatches
                                  ? 'Passwords match'
                                  : 'Passwords do not match yet',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: confirmMatches
                                    ? AppTheme.success
                                    : AppTheme.error,
                              ),
                            ),
                          ],
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Security Notice
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: context.bgC,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: context.crispBorder),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              LucideIcons.info,
                              size: 15,
                              color: _accentIconColor(context),
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                'For your protection, you will verify this change with a 6-digit OTP via Email or SMS before your password is updated. This device stays signed in while other devices are signed out.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  height: 1.45,
                                  color: context.textSec,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Primary Submit Button
                      SizedBox(
                        height: 52,
                        child: ElevatedButton.icon(
                          key: const Key('submit_change_password_button'),
                          onPressed: _isSubmitting ? null : _handleSubmit,
                          icon: _isSubmitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(LucideIcons.shieldCheck, size: 18),
                          label: Text(
                            _isSubmitting
                                ? (_isUpdatingAfterOtp
                                    ? 'Updating Password...'
                                    : 'Verifying Credentials...')
                                : 'Verify & Update Password',
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryColor,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor:
                                AppTheme.primaryColor.withValues(alpha: 0.55),
                            disabledForegroundColor: Colors.white70,
                            elevation: 1,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecurityHeaderCard(BuildContext context) {
    final bool isCustom = widget.hasCustomPassword;
    final String? formattedDate = widget.passwordUpdatedAt != null
        ? DateFormat('MMM d, yyyy • h:mm a')
            .format(widget.passwordUpdatedAt!.toLocal())
        : null;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0A2446), Color(0xFF0F3260), Color(0xFF1E3A8A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFFBC02D).withValues(alpha: 0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryColor.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: const Color(0xFFFBC02D).withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFFBC02D).withValues(alpha: 0.45),
              ),
            ),
            child: const Icon(
              LucideIcons.keyRound,
              color: Color(0xFFFBC02D),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (isCustom
                            ? const Color(0xFF4ADE80)
                            : const Color(0xFFFBC02D))
                        .withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isCustom ? 'PASSWORD PROTECTED' : 'ACCOUNT SECURITY',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.7,
                      color: isCustom
                          ? const Color(0xFF86EFAC)
                          : const Color(0xFFFDE047),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  isCustom
                      ? 'Update Your Scholar Password'
                      : 'Replace Your Initial Password',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isCustom
                      ? (formattedDate != null
                          ? 'Last updated $formattedDate. Choose a new password to keep your scholarship account protected.'
                          : 'Choose a new strong password to keep your scholarship records secure.')
                      : 'Now that your first login is verified, replace your default Student ID password with a private password only you know.',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.45,
                    color: Colors.white.withValues(alpha: 0.85),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(BuildContext context, String message) {
    return Container(
      key: const Key('change_password_error_banner'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.error.withValues(alpha: context.isDark ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.error.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(
              LucideIcons.alertCircle,
              size: 16,
              color: AppTheme.error,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.4,
                fontWeight: FontWeight.w600,
                color: context.isDark
                    ? const Color(0xFFFCA5A5)
                    : const Color(0xFFB91C1C),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStrengthMeter(
    BuildContext context,
    PasswordStrengthResult strength,
  ) {
    final activeColor = _strengthColor(strength.level);
    return Column(
      key: const Key('password_strength_meter'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Password Strength',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: context.textSec,
              ),
            ),
            Text(
              strength.label,
              key: const Key('password_strength_label'),
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: activeColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: List.generate(4, (index) {
            final bool filled = index < strength.score;
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 5,
                margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
                decoration: BoxDecoration(
                  color: filled
                      ? activeColor
                      : context.crispBorder.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildRequirementsCard({
    required BuildContext context,
    required bool ruleLength,
    required bool ruleCase,
    required bool ruleDigit,
    required bool ruleDistinct,
    required bool ruleNoSpaces,
  }) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: context.bgC,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.crispBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'PASSWORD REQUIREMENTS',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.7,
              color: context.textSec,
            ),
          ),
          const SizedBox(height: 8),
          _buildRequirementRow(
            context,
            'At least 8 characters (up to 72)',
            ruleLength,
          ),
          const SizedBox(height: 5),
          _buildRequirementRow(
            context,
            'Uppercase (A–Z) and lowercase (a–z) letters',
            ruleCase,
          ),
          const SizedBox(height: 5),
          _buildRequirementRow(
            context,
            'At least one number (0–9)',
            ruleDigit,
          ),
          const SizedBox(height: 5),
          _buildRequirementRow(
            context,
            'Different from your current password & Student ID',
            ruleDistinct,
          ),
          const SizedBox(height: 5),
          _buildRequirementRow(
            context,
            'No leading or trailing spaces',
            ruleNoSpaces,
          ),
        ],
      ),
    );
  }

  Widget _buildRequirementRow(
    BuildContext context,
    String text,
    bool satisfied,
  ) {
    return Row(
      children: [
        Icon(
          satisfied ? LucideIcons.checkCircle2 : LucideIcons.circle,
          size: 14,
          color: satisfied ? AppTheme.success : context.textSec,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: satisfied ? FontWeight.w700 : FontWeight.w500,
              color: satisfied ? context.textPri : context.textSec,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFieldLabel(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          color: context.textSec,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  InputDecoration _passwordFieldDecoration({
    required BuildContext context,
    required IconData icon,
    required String hintText,
    String? helperText,
    required bool obscured,
    required Key toggleKey,
    required VoidCallback onToggle,
  }) {
    return InputDecoration(
      prefixIcon: Icon(icon, size: 16, color: _accentIconColor(context)),
      suffixIcon: IconButton(
        key: toggleKey,
        tooltip: obscured ? 'Show password' : 'Hide password',
        icon: Icon(
          obscured ? LucideIcons.eyeOff : LucideIcons.eye,
          size: 18,
          color: context.textSec,
        ),
        onPressed: onToggle,
      ),
      hintText: hintText,
      helperText: helperText,
      helperMaxLines: 2,
      filled: true,
      fillColor: context.bgC,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.crispBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFFBC02D), width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.error, width: 2),
      ),
    );
  }
}
