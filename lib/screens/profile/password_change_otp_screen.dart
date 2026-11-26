import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

typedef PasswordChangeSendOtpFn = Future<Map<String, dynamic>> Function({
  required String studentId,
  required String channel,
});

typedef PasswordChangeVerifyOtpFn = Future<Map<String, dynamic>> Function({
  required String studentId,
  required String otp,
  String? challengeToken,
});

typedef PasswordChangePollStatusFn = Future<Map<String, dynamic>?> Function({
  required String studentId,
});

/// Returned when a student successfully verifies their password-change OTP.
class PasswordChangeOtpResult {
  final String verificationToken;
  final String channel;

  const PasswordChangeOtpResult({
    required this.verificationToken,
    required this.channel,
  });
}

class PasswordChangeOtpScreen extends StatefulWidget {
  final String studentId;
  final String maskedPhone;
  final String? maskedEmail;
  final String initialChannel;
  final bool smsAvailable;
  final bool emailAvailable;
  final String initialDeliveryStatus;
  final String? initialDeliveryMessage;
  final String? initialDeliveryError;
  final int? initialDeliveryLatencyMs;
  final Map<String, int>? initialChannelCooldowns;
  final int expiresIn;
  final int resendCooldown;
  final String? initialChallengeToken;
  final PasswordChangeSendOtpFn? onSendOtp;
  final PasswordChangeVerifyOtpFn? onVerifyOtp;
  final PasswordChangePollStatusFn? onPollDeliveryStatus;

  const PasswordChangeOtpScreen({
    super.key,
    required this.studentId,
    required this.maskedPhone,
    this.maskedEmail,
    required this.initialChannel,
    this.smsAvailable = true,
    this.emailAvailable = true,
    this.initialDeliveryStatus = 'sent',
    this.initialDeliveryMessage,
    this.initialDeliveryError,
    this.initialDeliveryLatencyMs,
    this.initialChannelCooldowns,
    this.expiresIn = 600,
    this.resendCooldown = 30,
    this.initialChallengeToken,
    this.onSendOtp,
    this.onVerifyOtp,
    this.onPollDeliveryStatus,
  });

  @override
  State<PasswordChangeOtpScreen> createState() =>
      _PasswordChangeOtpScreenState();
}

class _PasswordChangeOtpScreenState extends State<PasswordChangeOtpScreen> {
  AuthService? _authService;
  final List<TextEditingController> _controllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  final List<FocusNode> _keyListenerNodes = List.generate(
    6,
    (_) => FocusNode(),
  );

  bool _isVerifying = false;
  bool _isResending = false;
  String? _errorMessage;

  late String _selectedChannel;
  late String _maskedPhone;
  String? _maskedEmail;
  late bool _smsAvailable;
  late bool _emailAvailable;

  late String _deliveryStatus; // 'sending' | 'sent' | 'failed'
  String? _deliveryMessage;
  String? _deliveryError;
  int? _deliveryLatencyMs;
  String? _challengeToken;

  late int _expireRemaining;
  late int _smsCooldown;
  late int _emailCooldown;
  int _telemetryPollCount = 0;

  Timer? _expireTimer;
  Timer? _cooldownTimer;
  Timer? _telemetryTimer;

  bool get _isEmail => _selectedChannel == 'email';
  int get _activeCooldown => _isEmail ? _emailCooldown : _smsCooldown;

  String get _activeTargetDisplay {
    if (_isEmail) {
      return (_maskedEmail != null &&
              _maskedEmail!.trim().isNotEmpty &&
              _maskedEmail != 'Not registered')
          ? _maskedEmail!
          : 'your registered email';
    }
    return (_maskedPhone.trim().isNotEmpty && _maskedPhone != 'Not registered')
        ? _maskedPhone
        : 'your registered mobile number';
  }

  String get _currentOtp => _controllers.map((c) => c.text).join();

  @override
  void initState() {
    super.initState();
    _selectedChannel =
        widget.initialChannel.trim().toLowerCase() == 'sms' ? 'sms' : 'email';
    _maskedPhone = widget.maskedPhone;
    _maskedEmail = widget.maskedEmail;
    _smsAvailable = widget.smsAvailable;
    _emailAvailable = widget.emailAvailable;
    _deliveryStatus = widget.initialDeliveryStatus;
    _deliveryMessage = widget.initialDeliveryMessage;
    _deliveryError = widget.initialDeliveryError;
    _deliveryLatencyMs = widget.initialDeliveryLatencyMs;
    _challengeToken = widget.initialChallengeToken;
    _expireRemaining = widget.expiresIn;

    if (widget.initialChannelCooldowns != null) {
      _smsCooldown = widget.initialChannelCooldowns!['sms'] ?? 0;
      _emailCooldown = widget.initialChannelCooldowns!['email'] ?? 0;
    } else if (_isEmail) {
      _emailCooldown = widget.resendCooldown;
      _smsCooldown = 0;
    } else {
      _smsCooldown = widget.resendCooldown;
      _emailCooldown = 0;
    }

    _startTimers();
    if (_deliveryStatus == 'sending') {
      _scheduleTelemetryPoll();
    }
  }

  void _startTimers() {
    _expireTimer?.cancel();
    _cooldownTimer?.cancel();

    _expireTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_expireRemaining > 0) {
        setState(() => _expireRemaining--);
      } else {
        timer.cancel();
      }
    });

    if (_smsCooldown > 0 || _emailCooldown > 0) {
      _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        if (_smsCooldown > 0 || _emailCooldown > 0) {
          setState(() {
            if (_smsCooldown > 0) _smsCooldown--;
            if (_emailCooldown > 0) _emailCooldown--;
          });
        } else {
          timer.cancel();
        }
      });
    }
  }

  void _scheduleTelemetryPoll() {
    _telemetryTimer?.cancel();
    if (_telemetryPollCount >= 5) return;
    _telemetryTimer = Timer(const Duration(milliseconds: 1400), () async {
      if (!mounted) return;
      _telemetryPollCount++;
      final pollFn = widget.onPollDeliveryStatus ??
          (_authService ??= AuthService()).getPasswordChangeOtpDeliveryStatus;
      final status = await pollFn(studentId: widget.studentId);
      if (!mounted || status == null) return;

      final liveStatus = (status['deliveryStatus'] as String?) ?? _deliveryStatus;
      final avail = status['availableChannels'];
      final cooldowns = status['channelCooldowns'];

      setState(() {
        _deliveryStatus = liveStatus;
        if (status['deliveryMessage'] is String) {
          _deliveryMessage = status['deliveryMessage'] as String;
        }
        _deliveryError = status['deliveryError'] as String?;
        if (status['deliveryLatencyMs'] is num) {
          _deliveryLatencyMs = (status['deliveryLatencyMs'] as num).toInt();
        }
        if (status['maskedPhone'] is String &&
            (status['maskedPhone'] as String).isNotEmpty) {
          _maskedPhone = status['maskedPhone'] as String;
        }
        if (status['maskedEmail'] is String &&
            (status['maskedEmail'] as String).isNotEmpty) {
          _maskedEmail = status['maskedEmail'] as String;
        }
        if (avail is Map) {
          if (avail['sms'] is bool) _smsAvailable = avail['sms'] as bool;
          if (avail['email'] is bool) _emailAvailable = avail['email'] as bool;
        }
        if (cooldowns is Map) {
          _smsCooldown = (cooldowns['sms'] as num?)?.toInt() ?? _smsCooldown;
          _emailCooldown =
              (cooldowns['email'] as num?)?.toInt() ?? _emailCooldown;
        }
      });

      if (liveStatus == 'sending') {
        _scheduleTelemetryPoll();
      }
    });
  }

  @override
  void dispose() {
    _expireTimer?.cancel();
    _cooldownTimer?.cancel();
    _telemetryTimer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    for (final k in _keyListenerNodes) {
      k.dispose();
    }
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _selectDeliveryChannel(String targetChannel) async {
    if (_isResending || _isVerifying) return;
    final normalized = targetChannel.toLowerCase() == 'email' ? 'email' : 'sms';

    if (normalized == 'email' && !_emailAvailable) {
      setState(() {
        _errorMessage =
            'No valid email address is registered on your account. Please verify via SMS.';
      });
      return;
    }
    if (normalized == 'sms' && !_smsAvailable) {
      setState(() {
        _errorMessage =
            'No valid Philippine mobile number is registered on your account. Please verify via Email.';
      });
      return;
    }

    if (normalized == _selectedChannel) {
      if (_deliveryStatus == 'failed' && _activeCooldown <= 0) {
        await _dispatchOtp(channel: normalized, isChannelSwitch: false);
      }
      return;
    }

    final targetCooldown = normalized == 'email' ? _emailCooldown : _smsCooldown;
    setState(() {
      _selectedChannel = normalized;
      _errorMessage = null;
    });

    if (targetCooldown <= 0) {
      await _dispatchOtp(channel: normalized, isChannelSwitch: true);
    } else {
      setState(() {
        _deliveryStatus = 'sent';
        _deliveryError = null;
        _deliveryMessage = normalized == 'email'
            ? 'Code already sent via Email • Check your inbox'
            : 'Code already sent via SMS • Check your messages';
      });
    }
  }

  Future<void> _handleResend() async {
    if (_activeCooldown > 0 || _isResending) return;
    await _dispatchOtp(channel: _selectedChannel, isChannelSwitch: false);
  }

  Future<void> _dispatchOtp({
    required String channel,
    required bool isChannelSwitch,
  }) async {
    setState(() {
      _isResending = true;
      _errorMessage = null;
      _deliveryStatus = 'sending';
      _deliveryError = null;
      _deliveryMessage = channel == 'email'
          ? 'Sending 6-digit code via Email...'
          : 'Sending 6-digit code via Semaphore SMS...';
    });

    try {
      final sendFn = widget.onSendOtp ??
          (_authService ??= AuthService()).sendPasswordChangeOtp;
      final res = await sendFn(
        studentId: widget.studentId,
        channel: channel,
      );
      if (!mounted) return;

      for (final c in _controllers) {
        c.clear();
      }
      _focusNodes[0].requestFocus();

      final newCooldown = (res['resendCooldown'] as num?)?.toInt() ?? 30;
      final newExpire = (res['expiresIn'] as num?)?.toInt() ?? 600;
      final respStatus = (res['deliveryStatus'] as String?) ?? 'sent';
      final avail = res['availableChannels'];
      final cooldowns = res['channelCooldowns'];

      setState(() {
        _selectedChannel = (res['channel'] as String?) ?? channel;
        _expireRemaining = newExpire;
        if (res['challengeToken'] is String &&
            (res['challengeToken'] as String).isNotEmpty) {
          _challengeToken = res['challengeToken'] as String;
        }
        if (cooldowns is Map) {
          _smsCooldown = (cooldowns['sms'] as num?)?.toInt() ?? _smsCooldown;
          _emailCooldown =
              (cooldowns['email'] as num?)?.toInt() ?? _emailCooldown;
        } else if (_selectedChannel == 'email') {
          _emailCooldown = newCooldown;
        } else {
          _smsCooldown = newCooldown;
        }

        if (res['maskedPhone'] is String &&
            (res['maskedPhone'] as String).isNotEmpty) {
          _maskedPhone = res['maskedPhone'] as String;
        }
        if (res['maskedEmail'] is String &&
            (res['maskedEmail'] as String).isNotEmpty) {
          _maskedEmail = res['maskedEmail'] as String;
        }
        if (avail is Map) {
          if (avail['sms'] is bool) _smsAvailable = avail['sms'] as bool;
          if (avail['email'] is bool) _emailAvailable = avail['email'] as bool;
        }

        _deliveryStatus = respStatus;
        _deliveryError = res['deliveryError'] as String?;
        _deliveryLatencyMs = (res['deliveryLatencyMs'] as num?)?.toInt();
        _deliveryMessage = (res['deliveryMessage'] as String?) ??
            (channel == 'email'
                ? 'OTP sent via Email • Check your inbox'
                : 'OTP sent via Semaphore SMS');
      });

      _startTimers();

      if (respStatus == 'sending') {
        _telemetryPollCount = 0;
        _scheduleTelemetryPoll();
      }

      final snackText = channel == 'email'
          ? (isChannelSwitch
              ? 'Switched to Email — OTP sent to $_activeTargetDisplay.'
              : 'A new verification code has been sent via Email.')
          : (isChannelSwitch
              ? 'Switched to SMS — OTP sent to $_activeTargetDisplay.'
              : 'A new verification code has been sent via SMS.');

      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                channel == 'email' ? LucideIcons.mail : LucideIcons.send,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  snackText,
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF0F3260),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      var raw = e.toString().replaceAll(RegExp(r'^Exception:\s*'), '').trim();
      if (raw.contains('SocketException') ||
          raw.contains('Connection refused') ||
          raw.contains('ClientException') ||
          raw.contains('TimeoutException')) {
        raw =
            'Unable to reach the verification server. Please check your connection and try again.';
      }
      final isCooldownNotice = raw.toLowerCase().contains('please wait') ||
          raw.toLowerCase().contains('rate limit');

      setState(() {
        _errorMessage = raw;
        if (!isCooldownNotice) {
          _deliveryStatus = 'failed';
          _deliveryError = raw;
        } else {
          _deliveryStatus = 'sent';
        }
      });
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Future<void> _handleVerify() async {
    if (_isVerifying) return;
    final otp = _currentOtp.trim();
    if (otp.length != 6) {
      setState(() {
        _errorMessage = _isEmail
            ? 'Please enter all 6 digits of the OTP sent to your email.'
            : 'Please enter all 6 digits of the OTP sent to your mobile number.';
      });
      return;
    }

    if (_expireRemaining <= 0) {
      setState(() {
        _errorMessage =
            'This OTP has expired. Please tap "Resend Code" to get a new verification code.';
      });
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final verifyFn = widget.onVerifyOtp ??
          (_authService ??= AuthService()).verifyPasswordChangeOtp;
      final res = await verifyFn(
        studentId: widget.studentId,
        otp: otp,
        challengeToken: _challengeToken,
      );

      if (!mounted) return;
      final token = (res['verificationToken'] ?? '').toString().trim();
      final verifiedChannel =
          (res['channel'] ?? _selectedChannel).toString().trim().toLowerCase();

      if (res['verified'] != true || token.isEmpty) {
        throw Exception('OTP verification could not be confirmed. Please try again.');
      }

      try {
        HapticFeedback.mediumImpact();
      } catch (_) {}

      Navigator.of(context).pop(
        PasswordChangeOtpResult(
          verificationToken: token,
          channel: verifiedChannel,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      var raw = e
          .toString()
          .replaceAll(RegExp(r'^Exception:\s*'), '')
          .trim();
      if (raw.contains('SocketException') ||
          raw.contains('Connection refused') ||
          raw.contains('ClientException') ||
          raw.contains('TimeoutException')) {
        raw =
            'Unable to reach the verification server. Please check your connection and try again.';
      }
      setState(() {
        _errorMessage = raw.isNotEmpty
            ? raw
            : 'OTP verification failed. Please check the code and try again.';
      });
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      if (digits.isEmpty) {
        _controllers[index].clear();
        return;
      }

      if (digits.length == 2) {
        final newDigit = digits.substring(digits.length - 1);
        _controllers[index].value = TextEditingValue(
          text: newDigit,
          selection: const TextSelection.collapsed(offset: 1),
        );
        if (index < 5) {
          _focusNodes[index + 1].requestFocus();
        } else {
          _focusNodes[index].unfocus();
          if (_currentOtp.length == 6) {
            _handleVerify();
          }
        }
        return;
      }

      for (int i = 0; i < 6 && i < digits.length; i++) {
        _controllers[i].text = digits[i];
      }
      if (digits.length >= 6) {
        _focusNodes[5].unfocus();
        _handleVerify();
      } else {
        _focusNodes[digits.length].requestFocus();
      }
      return;
    }

    if (value.isNotEmpty) {
      if (index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
        if (_currentOtp.length == 6) {
          _handleVerify();
        }
      }
    }
  }

  Widget _buildChannelOption({
    required BuildContext context,
    required String channel,
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isAvailable,
  }) {
    final bool isSelected = _selectedChannel == channel;
    final bool isDark = context.isDark;

    return Expanded(
      child: GestureDetector(
        key: Key('pwd_otp_channel_$channel'),
        onTap: () => _selectDeliveryChannel(channel),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark ? const Color(0xFF1E293B) : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? (isDark
                      ? const Color(0xFFFBC02D)
                      : const Color(0xFF0F3260))
                  : Colors.transparent,
              width: isSelected ? 1.4 : 1.0,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFF0F3260).withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: !isAvailable
                    ? context.textSec.withValues(alpha: 0.5)
                    : (isSelected
                        ? (isDark
                            ? const Color(0xFFFBC02D)
                            : const Color(0xFF0F3260))
                        : context.textSec),
              ),
              const SizedBox(width: 7),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight:
                            isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: !isAvailable
                            ? context.textSec.withValues(alpha: 0.5)
                            : (isSelected ? context.textPri : context.textSec),
                      ),
                    ),
                    Text(
                      isAvailable ? subtitle : 'Not linked',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: isSelected
                            ? (isDark
                                ? const Color(0xFFFDE047)
                                : const Color(0xFF1E4C87))
                            : context.textSec,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected) ...[
                const SizedBox(width: 4),
                const Icon(
                  LucideIcons.checkCircle2,
                  size: 13,
                  color: Color(0xFF16A34A),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDeliveryStatusBanner(BuildContext context) {
    final bool isDark = context.isDark;
    final bool isSending = _deliveryStatus == 'sending' || _isResending;
    final bool isFailed = !isSending && _deliveryStatus == 'failed';

    final Color bgColor = isSending
        ? (isDark
            ? const Color(0xFF1D4ED8).withValues(alpha: 0.18)
            : const Color(0xFFEFF6FF))
        : (isFailed
            ? (isDark
                ? const Color(0xFFB45309).withValues(alpha: 0.2)
                : const Color(0xFFFFFBEB))
            : (isDark
                ? const Color(0xFF15803D).withValues(alpha: 0.18)
                : const Color(0xFFF0FDF4)));
    final Color borderColor = isSending
        ? (isDark ? const Color(0xFF3B82F6) : const Color(0xFFBFDBFE))
        : (isFailed
            ? (isDark ? const Color(0xFFF59E0B) : const Color(0xFFFDE68A))
            : (isDark ? const Color(0xFF22C55E) : const Color(0xFFBBF7D0)));
    final Color accentColor = isSending
        ? (isDark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8))
        : (isFailed
            ? (isDark ? const Color(0xFFFCD34D) : const Color(0xFFB45309))
            : (isDark ? const Color(0xFF86EFAC) : const Color(0xFF15803D)));

    final String alternateChannel = _isEmail ? 'sms' : 'email';
    final bool canSwitchAlternate =
        _isEmail ? _smsAvailable : _emailAvailable;

    String statusLabel;
    if (isSending) {
      statusLabel = (_deliveryMessage != null && _deliveryMessage!.isNotEmpty)
          ? _deliveryMessage!
          : (_isEmail ? 'Sending OTP via Email...' : 'Sending OTP via SMS...');
    } else if (isFailed) {
      statusLabel = (_deliveryError != null && _deliveryError!.isNotEmpty)
          ? _deliveryError!
          : (_isEmail
              ? 'Email delivery delayed or failed'
              : 'SMS delivery delayed or failed');
    } else {
      final speedTag = (_deliveryLatencyMs != null && _deliveryLatencyMs! > 0)
          ? ' (${(_deliveryLatencyMs! / 1000).toStringAsFixed(1)}s)'
          : '';
      statusLabel = (_deliveryMessage != null && _deliveryMessage!.isNotEmpty)
          ? '$_deliveryMessage$speedTag'
          : (_isEmail
              ? 'Email OTP Sent$speedTag • Check your inbox'
              : 'SMS OTP Sent$speedTag • Ready to verify');
    }

    return Container(
      key: const Key('pwd_otp_delivery_status_banner'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          if (isSending)
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: accentColor,
              ),
            )
          else
            Icon(
              isFailed ? LucideIcons.alertCircle : LucideIcons.checkCircle2,
              size: 15,
              color: accentColor,
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              statusLabel,
              style: GoogleFonts.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: accentColor,
              ),
            ),
          ),
          if (isFailed && canSwitchAlternate)
            InkWell(
              key: const Key('pwd_otp_switch_alternate_action'),
              onTap: () => _selectDeliveryChannel(alternateChannel),
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                child: Text(
                  _isEmail ? 'Try SMS' : 'Try Email',
                  style: GoogleFonts.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: isDark
                        ? const Color(0xFFFBC02D)
                        : const Color(0xFF0F3260),
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isDark = context.isDark;
    final bool isExpired = _expireRemaining <= 0;
    final String alternateChannel = _isEmail ? 'sms' : 'email';
    final bool canSwitchAlternate =
        _isEmail ? _smsAvailable : _emailAvailable;

    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Verify Identity'),
        backgroundColor: context.surfaceC,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: Icon(LucideIcons.arrowLeft, color: context.textPri),
          onPressed: () => Navigator.of(context).pop(null),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 440),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              decoration: BoxDecoration(
                color: context.surfaceC,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: context.crispBorder, width: 1.5),
                boxShadow: AppTheme.softShadow,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Shield badge
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F3260),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F3260).withValues(alpha: 0.2),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      LucideIcons.shieldCheck,
                      color: Color(0xFFFBC02D),
                      size: 28,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Eyebrow pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBC02D).withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFFFBC02D).withValues(alpha: 0.45),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          LucideIcons.keyRound,
                          size: 13,
                          color: isDark
                              ? const Color(0xFFFDE047)
                              : const Color(0xFF92400E),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'PASSWORD CHANGE VERIFICATION',
                          style: GoogleFonts.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: isDark
                                ? const Color(0xFFFDE047)
                                : const Color(0xFF92400E),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  Text(
                    _isEmail
                        ? 'Email OTP Verification'
                        : 'SMS OTP Verification',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      color: context.textPri,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isEmail
                        ? 'Enter the 6-digit verification code sent to your email address to authorize your password update:'
                        : 'Enter the 6-digit verification code sent to your mobile number to authorize your password update:',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: context.textSec,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Channel switcher (Email <-> SMS)
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: context.bgC,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: context.crispBorder),
                    ),
                    child: Row(
                      children: [
                        _buildChannelOption(
                          context: context,
                          channel: 'email',
                          icon: LucideIcons.mail,
                          title: 'Email',
                          subtitle: 'Fast Inbox',
                          isAvailable: _emailAvailable,
                        ),
                        const SizedBox(width: 4),
                        _buildChannelOption(
                          context: context,
                          channel: 'sms',
                          icon: LucideIcons.phone,
                          title: 'SMS',
                          subtitle: 'Mobile Text',
                          isAvailable: _smsAvailable,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Masked target chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: context.bgC,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: context.crispBorder),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _isEmail ? LucideIcons.mail : LucideIcons.smartphone,
                          size: 14,
                          color: isDark
                              ? const Color(0xFFFBC02D)
                              : const Color(0xFF0F3260),
                        ),
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            _activeTargetDisplay,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: context.textPri,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Live Delivery Status Banner
                  _buildDeliveryStatusBanner(context),
                  const SizedBox(height: 20),

                  // 6-digit OTP Boxes
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final boxWidth =
                          ((constraints.maxWidth - 40) / 6).clamp(40.0, 50.0);
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (index) {
                          final hasValue = _controllers[index].text.isNotEmpty;
                          return SizedBox(
                            width: boxWidth,
                            height: 54,
                            child: KeyboardListener(
                              focusNode: _keyListenerNodes[index],
                              onKeyEvent: (event) {
                                if (event is KeyDownEvent &&
                                    event.logicalKey ==
                                        LogicalKeyboardKey.backspace &&
                                    _controllers[index].text.isEmpty &&
                                    index > 0) {
                                  _controllers[index - 1].clear();
                                  _focusNodes[index - 1].requestFocus();
                                  setState(() {});
                                }
                              },
                              child: TextField(
                                key: Key('pwd_otp_digit_$index'),
                                controller: _controllers[index],
                                focusNode: _focusNodes[index],
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                maxLength: 6,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                style: GoogleFonts.inter(
                                  fontSize: 21,
                                  fontWeight: FontWeight.w800,
                                  color: context.textPri,
                                ),
                                decoration: InputDecoration(
                                  counterText: '',
                                  filled: true,
                                  fillColor: hasValue
                                      ? (isDark
                                          ? const Color(0xFF1E293B)
                                          : const Color(0xFFFFFBEB))
                                      : context.bgC,
                                  contentPadding: EdgeInsets.zero,
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(
                                      color: hasValue
                                          ? const Color(0xFFFBC02D)
                                          : context.crispBorder,
                                      width: hasValue ? 1.8 : 1.3,
                                    ),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFFBC02D),
                                      width: 2.2,
                                    ),
                                  ),
                                ),
                                onChanged: (val) {
                                  setState(() => _errorMessage = null);
                                  _onDigitChanged(index, val);
                                },
                              ),
                            ),
                          );
                        }),
                      );
                    },
                  ),

                  // Error Banner
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      key: const Key('pwd_otp_error_banner'),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.error
                            .withValues(alpha: isDark ? 0.18 : 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppTheme.error.withValues(alpha: 0.4),
                        ),
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
                              _errorMessage!,
                              style: GoogleFonts.inter(
                                fontSize: 12.5,
                                height: 1.4,
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
                  ],

                  const SizedBox(height: 16),

                  // Countdown Timer
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        LucideIcons.clock,
                        size: 14,
                        color: isExpired ? AppTheme.error : context.textSec,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isExpired
                            ? 'Code expired'
                            : 'Code expires in ${_formatDuration(_expireRemaining)}',
                        style: GoogleFonts.inter(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: isExpired ? AppTheme.error : context.textSec,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Primary CTA: VERIFY & UPDATE PASSWORD
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      key: const Key('pwd_otp_verify_button'),
                      onPressed:
                          (_isVerifying || _isResending) ? null : _handleVerify,
                      icon: _isVerifying
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: Color(0xFF0F3260),
                              ),
                            )
                          : const Icon(LucideIcons.shieldCheck, size: 18),
                      label: Text(
                        _isVerifying
                            ? 'VERIFYING CODE...'
                            : 'VERIFY & UPDATE PASSWORD',
                        style: GoogleFonts.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFBC02D),
                        foregroundColor: const Color(0xFF0F3260),
                        disabledBackgroundColor:
                            const Color(0xFFFBC02D).withValues(alpha: 0.55),
                        disabledForegroundColor:
                            const Color(0xFF0F3260).withValues(alpha: 0.7),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Resend & Alternate Channel Row
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      Text(
                        _isEmail
                            ? "Didn't receive Email?"
                            : "Didn't receive SMS?",
                        style: GoogleFonts.inter(
                          fontSize: 12.5,
                          color: context.textSec,
                        ),
                      ),
                      InkWell(
                        key: const Key('pwd_otp_resend_button'),
                        onTap: (_activeCooldown > 0 || _isResending)
                            ? null
                            : _handleResend,
                        child: Text(
                          _activeCooldown > 0
                              ? 'Resend in ${_activeCooldown}s'
                              : 'Resend Code',
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: _activeCooldown > 0
                                ? context.textSec
                                : (isDark
                                    ? const Color(0xFFFBC02D)
                                    : const Color(0xFF0F3260)),
                            decoration: _activeCooldown > 0
                                ? TextDecoration.none
                                : TextDecoration.underline,
                          ),
                        ),
                      ),
                      if (canSwitchAlternate) ...[
                        Text(
                          'or',
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: context.textSec,
                          ),
                        ),
                        InkWell(
                          key: const Key('pwd_otp_quick_switch_button'),
                          onTap: _isResending
                              ? null
                              : () => _selectDeliveryChannel(alternateChannel),
                          child: Text(
                            _isEmail ? 'Send via SMS' : 'Send via Email',
                            style: GoogleFonts.inter(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: isDark
                                  ? const Color(0xFF93C5FD)
                                  : const Color(0xFF1D4ED8),
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),

                  TextButton(
                    key: const Key('pwd_otp_cancel_button'),
                    onPressed: _isVerifying
                        ? null
                        : () => Navigator.of(context).pop(null),
                    child: Text(
                      'Cancel & Return to Password Form',
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: context.textSec,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
