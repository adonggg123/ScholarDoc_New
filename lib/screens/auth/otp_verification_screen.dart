import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../main_layout.dart';

class OtpVerificationScreen extends StatefulWidget {
  final String studentId;
  final String password;
  final String maskedPhone;
  final String? maskedEmail;
  final String initialChannel;
  final bool smsAvailable;
  final bool emailAvailable;
  final String initialDeliveryStatus;
  final String? initialDeliveryMessage;
  final String? initialDeliveryError;
  final Map<String, int>? initialChannelCooldowns;
  final int expiresIn;
  final int resendCooldown;

  const OtpVerificationScreen({
    super.key,
    required this.studentId,
    required this.password,
    required this.maskedPhone,
    this.maskedEmail,
    this.initialChannel = 'sms',
    this.smsAvailable = true,
    this.emailAvailable = true,
    this.initialDeliveryStatus = 'sent',
    this.initialDeliveryMessage,
    this.initialDeliveryError,
    this.initialChannelCooldowns,
    this.expiresIn = 300,
    this.resendCooldown = 60,
  });

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final AuthService _authService = AuthService();
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
      return (_maskedEmail != null && _maskedEmail!.trim().isNotEmpty)
          ? _maskedEmail!
          : 'your registered email';
    }
    return _maskedPhone.trim().isNotEmpty
        ? _maskedPhone
        : 'your registered phone';
  }

  @override
  void initState() {
    super.initState();
    _selectedChannel = widget.initialChannel.trim().toLowerCase() == 'email'
        ? 'email'
        : 'sms';
    _maskedPhone = widget.maskedPhone;
    _maskedEmail = widget.maskedEmail;
    _smsAvailable = widget.smsAvailable;
    _emailAvailable = widget.emailAvailable;
    _deliveryStatus = widget.initialDeliveryStatus;
    _deliveryMessage = widget.initialDeliveryMessage;
    _deliveryError = widget.initialDeliveryError;
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

  @override
  void didUpdateWidget(covariant OtpVerificationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialChannel != widget.initialChannel ||
        oldWidget.emailAvailable != widget.emailAvailable ||
        oldWidget.smsAvailable != widget.smsAvailable ||
        oldWidget.maskedEmail != widget.maskedEmail ||
        oldWidget.maskedPhone != widget.maskedPhone ||
        oldWidget.initialChannelCooldowns != widget.initialChannelCooldowns ||
        oldWidget.initialDeliveryStatus != widget.initialDeliveryStatus) {
      _selectedChannel = widget.initialChannel.trim().toLowerCase() == 'email'
          ? 'email'
          : 'sms';
      _maskedPhone = widget.maskedPhone;
      _maskedEmail = widget.maskedEmail;
      _smsAvailable = widget.smsAvailable;
      _emailAvailable = widget.emailAvailable;
      _deliveryStatus = widget.initialDeliveryStatus;
      _deliveryMessage = widget.initialDeliveryMessage;
      _deliveryError = widget.initialDeliveryError;
      _errorMessage = null;
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
      final status = await _authService.getOtpDeliveryStatus(
        studentId: widget.studentId,
      );
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

  String get _currentOtp => _controllers.map((c) => c.text).join();

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
      // Allow 1-tap retry if current channel failed or cooldown is ready
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

    // If the newly selected channel is not in cooldown, immediately send the OTP via that channel!
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
      final res = await _authService.resendLoginOtp(
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
              : 'A new OTP has been sent via Email.')
          : (isChannelSwitch
              ? 'Switched to SMS — OTP sent to $_activeTargetDisplay.'
              : 'A new OTP has been sent via Semaphore SMS.');

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
      var raw = e.toString().replaceAll('Exception: ', '').trim();
      if (raw.contains('SocketException') ||
          raw.contains('Connection refused') ||
          raw.contains('ClientException') ||
          raw.contains('TimeoutException')) {
        raw =
            'Unable to reach the verification server. Please check your connection and try again.';
      }
      final isCooldownNotice =
          raw.toLowerCase().contains('please wait') ||
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
    final otp = _currentOtp.trim();
    if (otp.length != 6) {
      setState(() {
        _errorMessage = _isEmail
            ? 'Please enter all 6 digits of the OTP sent to your email.'
            : 'Please enter all 6 digits of the OTP sent to your phone.';
      });
      return;
    }

    if (_expireRemaining <= 0) {
      setState(() {
        _errorMessage =
            'This OTP has expired. Please tap "Resend Code" to get a new OTP.';
      });
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      await _authService.verifyLoginOtp(
        studentId: widget.studentId,
        otp: otp,
        password: widget.password,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(
                LucideIcons.checkCircle2,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'First login verified! Welcome to ScholarDoc.',
                  style: GoogleFonts.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF16A34A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      );

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const MainLayout()),
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;
      var raw = e
          .toString()
          .replaceAll(RegExp(r'\[.*\]'), '')
          .replaceAll('Exception: ', '')
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
            : 'OTP verification failed. Please try again.';
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
    required String channel,
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isAvailable,
  }) {
    final bool isSelected = _selectedChannel == channel;

    return Expanded(
      child: GestureDetector(
        key: Key('otp_channel_$channel'),
        onTap: () => _selectDeliveryChannel(channel),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF0F3260)
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
                    ? const Color(0xFF94A3B8)
                    : (isSelected
                        ? const Color(0xFF0F3260)
                        : const Color(0xFF64748B)),
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
                            ? const Color(0xFF94A3B8)
                            : (isSelected
                                ? const Color(0xFF0F3260)
                                : const Color(0xFF475569)),
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
                            ? const Color(0xFF1E4C87)
                            : const Color(0xFF94A3B8),
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

  Widget _buildDeliveryStatusBanner() {
    final bool isSending = _deliveryStatus == 'sending' || _isResending;
    final bool isFailed = !isSending && _deliveryStatus == 'failed';

    final Color bgColor = isSending
        ? const Color(0xFFEFF6FF)
        : (isFailed ? const Color(0xFFFFFBEB) : const Color(0xFFF0FDF4));
    final Color borderColor = isSending
        ? const Color(0xFFBFDBFE)
        : (isFailed ? const Color(0xFFFDE68A) : const Color(0xFFBBF7D0));
    final Color accentColor = isSending
        ? const Color(0xFF1D4ED8)
        : (isFailed ? const Color(0xFFB45309) : const Color(0xFF15803D));

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
      key: const Key('otp_delivery_status_banner'),
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
              key: const Key('otp_switch_alternate_action'),
              onTap: () => _selectDeliveryChannel(alternateChannel),
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                child: Text(
                  _isEmail ? 'Try SMS' : 'Try Email',
                  style: GoogleFonts.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F3260),
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
    final bool isExpired = _expireRemaining <= 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Color(0xFF0F3260)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Security Verification',
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F3260),
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F3260).withValues(alpha: 0.08),
                    blurRadius: 28,
                    offset: const Offset(0, 10),
                  ),
                ],
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Hero Shield Icon with USTP Gold & Navy ring
                  Center(
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F3260), Color(0xFF1E4C87)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color:
                                const Color(0xFF0F3260).withValues(alpha: 0.22),
                            blurRadius: 14,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          LucideIcons.shieldCheck,
                          size: 25,
                          color: Color(0xFFFBC02D),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Eyebrow badge
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 3.5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF9C3),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFFDE047)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            LucideIcons.keyRound,
                            size: 11.5,
                            color: Color(0xFF854D0E),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'FIRST LOGIN 2FA VERIFICATION',
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.05,
                              color: const Color(0xFF854D0E),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Channel-Aware Title
                  Text(
                    _isEmail
                        ? 'Email OTP Verification'
                        : 'SMS OTP Verification',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),

                  // Channel-Aware Subtitle
                  Text(
                    _isEmail
                        ? 'Enter the 6-digit one-time password sent to your registered email address:'
                        : 'Enter the 6-digit one-time password sent to your registered mobile number:',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 12.5,
                      color: const Color(0xFF64748B),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Preferred Delivery Method Selector (SMS | Email)
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        _buildChannelOption(
                          channel: 'sms',
                          icon: LucideIcons.phone,
                          title: 'SMS',
                          subtitle: 'Mobile Text',
                          isAvailable: _smsAvailable,
                        ),
                        const SizedBox(width: 6),
                        _buildChannelOption(
                          channel: 'email',
                          icon: LucideIcons.mail,
                          title: 'Email',
                          subtitle: 'Fast Inbox',
                          isAvailable: _emailAvailable,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Masked Destination Pill
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _isEmail ? LucideIcons.mail : LucideIcons.phone,
                            size: 13.5,
                            color: const Color(0xFF0F3260),
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              _activeTargetDisplay,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F3260),
                                letterSpacing: _isEmail ? 0.2 : 0.8,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Live Delivery Status Feedback Banner
                  _buildDeliveryStatusBanner(),
                  const SizedBox(height: 12),

                  // 6 Digit OTP Input Boxes
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(6, (index) {
                      return SizedBox(
                        width: 44,
                        height: 48,
                        child: KeyboardListener(
                          focusNode: _keyListenerNodes[index],
                          onKeyEvent: (event) {
                            if (event is KeyDownEvent &&
                                event.logicalKey ==
                                    LogicalKeyboardKey.backspace &&
                                _controllers[index].text.isEmpty &&
                                index > 0) {
                              _focusNodes[index - 1].requestFocus();
                            }
                          },
                          child: TextFormField(
                            controller: _controllers[index],
                            focusNode: _focusNodes[index],
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            autofillHints: index == 0
                                ? const [AutofillHints.oneTimeCode]
                                : null,
                            style: GoogleFonts.inter(
                              fontSize: 21,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF0F3260),
                            ),
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            decoration: InputDecoration(
                              counterText: '',
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                              contentPadding: EdgeInsets.zero,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                  color: Color(0xFFCBD5E1),
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                  color: Color(0xFFE2E8F0),
                                  width: 1.5,
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
                            onChanged: (val) => _onDigitChanged(index, val),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),

                  // Error Banner
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            LucideIcons.alertCircle,
                            color: Color(0xFFDC2626),
                            size: 15,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFFDC2626),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Expiration Status Indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        LucideIcons.clock,
                        size: 13.5,
                        color: isExpired
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF64748B),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isExpired
                            ? 'OTP code has expired'
                            : 'Code expires in ${_formatDuration(_expireRemaining)}',
                        style: GoogleFonts.inter(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: isExpired
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Primary: Verify Button
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFBC02D), Color(0xFFFFD54F)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFBC02D).withValues(alpha: 0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: _isVerifying ? null : _handleVerify,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        foregroundColor: const Color(0xFF0F3260),
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isVerifying
                          ? const SizedBox(
                              height: 21,
                              width: 21,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Color(0xFF0F3260),
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  LucideIcons.shieldCheck,
                                  size: 18,
                                  color: Color(0xFF0F3260),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'VERIFY & SIGN IN',
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                    color: const Color(0xFF0F3260),
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Resend Option with Per-Channel Rate Limiting & Quick Switch Hint
                  Center(
                    child: _activeCooldown > 0
                        ? Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 4,
                            children: [
                              Text(
                                _isEmail
                                    ? "Didn't receive Email?"
                                    : "Didn't receive SMS?",
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                              Text(
                                'Resend in ${_activeCooldown}s',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F3260),
                                ),
                              ),
                              if ((_isEmail &&
                                      _smsAvailable &&
                                      _smsCooldown <= 0) ||
                                  (!_isEmail &&
                                      _emailAvailable &&
                                      _emailCooldown <= 0)) ...[
                                Text(
                                  'or',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                                GestureDetector(
                                  key: const Key('otp_instant_channel_switch'),
                                  onTap: () => _selectDeliveryChannel(
                                    _isEmail ? 'sms' : 'email',
                                  ),
                                  child: Text(
                                    _isEmail
                                        ? 'Send via SMS now'
                                        : 'Send via Email now',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF1D4ED8),
                                      decoration: TextDecoration.underline,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          )
                        : TextButton.icon(
                            onPressed: _isResending ? null : _handleResend,
                            icon: _isResending
                                ? const SizedBox(
                                    height: 14,
                                    width: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(
                                    LucideIcons.refreshCw,
                                    size: 14,
                                    color: Color(0xFF0F3260),
                                  ),
                            label: Text(
                              _isEmail
                                  ? 'Resend Code via Email'
                                  : 'Resend Code via SMS',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F3260),
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(height: 6),

                  // Back to Login Button
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 6,
                        ),
                      ),
                      child: Text(
                        'Use different Student ID',
                        style: GoogleFonts.inter(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Footnote
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        LucideIcons.lock,
                        size: 12,
                        color: Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          _isEmail
                              ? 'Secured by ScholarDoc SMTP Security Gateway'
                              : 'Secured by Semaphore SMS Gateway',
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
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
