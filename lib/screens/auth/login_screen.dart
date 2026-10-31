import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../main_layout.dart';
import '../admin/admin_main_layout.dart';
import 'otp_verification_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _studentIdController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _studentIdFocusNode = FocusNode();
  final AuthService _authService = AuthService();

  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _studentIdController.dispose();
    _passwordController.dispose();
    _studentIdFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(
        0xFFF8FAFC,
      ), // Modern premium soft-grey background
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Floating card container matching the web responsive layout
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10), // Corner curve 10px
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F3260).withOpacity(0.06),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                        ), // Border matching web
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 40,
                      ), // Exact padding match
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Centered logo and compressed text branding header
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Image.asset(
                                'assets/app_logo3.png',
                                width: 56, // Increased logo icon size
                                height: 56, // Increased logo icon size
                                fit: BoxFit.contain,
                              ),
                              Transform.translate(
                                offset: const Offset(
                                  -6,
                                  0,
                                ), // Compressed spacing matching -10px margin-left
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    ShaderMask(
                                      shaderCallback: (bounds) =>
                                          const LinearGradient(
                                            colors: [
                                              Color(0xFF0F3260),
                                              Color(0xFFFBC02D),
                                            ],
                                            begin: Alignment.centerLeft,
                                            end: Alignment.centerRight,
                                          ).createShader(bounds),
                                      blendMode: BlendMode.srcIn,
                                      child: Text(
                                        'ScholarDoc',
                                        style: GoogleFonts.inter(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: -0.5,
                                          height: 1.0,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'USTP Oroquieta City Campus',
                                      style: GoogleFonts.inter(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.black,
                                        letterSpacing: 1.5,
                                        height: 1.0,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 32), // margin-bottom: 32px
                          // Restored and centered description text
                          Text(
                            'Enter your Student ID as your password to access your scholarship portal.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              color: const Color(0xFF6B7280),
                              fontSize: 14.5,
                              height: 1.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 28),

                          // Student ID input field
                          _buildLabel('STUDENT ID'),
                          const SizedBox(height: 10), // margin-bottom: 10px
                          TextFormField(
                            controller: _studentIdController,
                            focusNode: _studentIdFocusNode,
                            keyboardType: TextInputType.text,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: const Color(0xFF1E293B),
                            ),
                            decoration: _buildInputDecoration(
                              hintText: 'e.g. 2024-00123',
                              icon: LucideIcons.badge,
                            ),
                            validator: (v) => (v == null || v.isEmpty)
                                ? 'Please enter your student ID'
                                : null,
                          ),
                          const SizedBox(height: 28), // gap: 28px
                          // Password input field
                          _buildLabel('PASSWORD'),
                          const SizedBox(height: 10), // margin-bottom: 10px
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: const Color(0xFF1E293B),
                            ),
                            decoration:
                                _buildInputDecoration(
                                  hintText: '••••••••',
                                  icon: LucideIcons.lock,
                                ).copyWith(
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscurePassword
                                          ? LucideIcons.eye
                                          : LucideIcons.eyeOff,
                                      color: Colors.grey.shade400,
                                      size: 20,
                                    ),
                                    onPressed: () => setState(
                                      () =>
                                          _obscurePassword = !_obscurePassword,
                                    ),
                                  ),
                                ),
                            validator: (v) => (v == null || v.isEmpty)
                                ? 'Please enter your password'
                                : null,
                          ),
                          const SizedBox(height: 24), // gap: 24px
                          // Gold/Yellow action button
                          Container(
                            height: 54, // height: 54px
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(
                                12,
                              ), // border-radius: 12px
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFBC02D), Color(0xFFFFD54F)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0xFFFBC02D,
                                  ).withOpacity(0.25),
                                  blurRadius: 20,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _handleLogin,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                foregroundColor: const Color(0xFF0F3260),
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: Color(0xFF0F3260),
                                      ),
                                    )
                                  : Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          'SIGN IN TO PORTAL',
                                          style: GoogleFonts.inter(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5,
                                            color: const Color(0xFF0F3260),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(
                                          LucideIcons.chevronRight,
                                          size: 16,
                                          color: Color(0xFF0F3260),
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Secured note
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                LucideIcons.shieldCheck,
                                size: 16,
                                color: Colors.grey.shade400,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Secured with end-to-end encryption',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required String hintText,
    required IconData icon,
  }) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: GoogleFonts.inter(
        color: const Color(0xFF94A3B8),
        fontWeight: FontWeight.w500,
        fontSize: 14,
      ),
      prefixIcon: Padding(
        padding: const EdgeInsets.only(left: 20, right: 14),
        child: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 52),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFF1F5F9)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFFBC02D), width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppTheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppTheme.error, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: const Color(0xFF6B7280),
        letterSpacing: 1.0,
      ),
    );
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);
      final rawStudentId = _studentIdController.text.trim();
      final rawPassword = _passwordController.text.trim();

      try {
        final cleanLower = rawStudentId.toLowerCase();
        final bool isAdmin = cleanLower == 'admin' ||
            cleanLower == 'superadmin' ||
            cleanLower.contains('admin@') ||
            rawStudentId.contains('@scholardoc.com');

        // Admin flow: Bypass student SMS OTP verification
        if (isAdmin) {
          await _authService.loginStudent(
            studentId: rawStudentId,
            password: rawPassword,
          );
          if (!mounted) return;
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const AdminMainLayout()),
            (route) => false,
          );
          return;
        }

        // Student flow: Validate grantee eligibility & determine if first-login SMS OTP is required
        final initRes = await _authService.initiateStudentLogin(
          studentId: rawStudentId,
          password: rawPassword,
        );
        if (!mounted) return;

        // If First Login: Require channel selection or navigate to OTP verification
        if (initRes['requiresOtp'] == true) {
          if (initRes['requiresChannelSelection'] == true) {
            _showOtpChannelSelectionModal(
              studentId: rawStudentId,
              password: rawPassword,
              initRes: initRes,
            );
            return;
          }
          _navigateToOtpScreen(
            studentId: rawStudentId,
            password: rawPassword,
            res: initRes,
          );
          return;
        }

        // Returning Student: Standard login flow
        await _authService.loginStudent(
          studentId: rawStudentId,
          password: rawPassword,
        );
        if (!mounted) return;

        final isUserAdmin = await _authService.isCurrentUserAdmin();
        if (!mounted) return;

        if (isUserAdmin) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const AdminMainLayout()),
            (route) => false,
          );
        } else {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const MainLayout()),
            (route) => false,
          );
        }
      } catch (e) {
        if (!mounted) return;
        final rawMsg = e
            .toString()
            .replaceAll(RegExp(r'\[.*\]'), '')
            .replaceAll('Exception: ', '')
            .trim();
        final lower = rawMsg.toLowerCase();
        final isGranteeError = lower.contains('eligible grantee') ||
            lower.contains('access denied') ||
            lower.contains('student_grantees') ||
            lower.contains('not registered as an eligible grantee');

        if (isGranteeError) {
          _showGranteeAccessDeniedModal(
            studentId: rawStudentId,
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(
                    LucideIcons.alertCircle,
                    color: Colors.white,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      rawMsg.isNotEmpty
                          ? 'Login failed: $rawMsg'
                          : 'Login failed. Please check your credentials.',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFFDC2626),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  void _navigateToOtpScreen({
    required String studentId,
    required String password,
    required Map<String, dynamic> res,
    String? channelOverride,
  }) {
    final maskedPhone = (res['maskedPhone'] as String?) ?? 'your registered phone';
    final maskedEmail = res['maskedEmail'] as String?;
    final initialChannel = channelOverride ?? (res['channel'] as String?) ?? 'sms';
    final availRaw = res['availableChannels'];
    final availMap = availRaw is Map ? availRaw : const {};
    final smsAvailable = availMap['sms'] is bool ? (availMap['sms'] as bool) : true;
    final emailAvailable = availMap['email'] is bool
        ? (availMap['email'] as bool)
        : (maskedEmail != null && maskedEmail.trim().isNotEmpty);
    final deliveryStatus = (res['deliveryStatus'] as String?) ?? 'sent';
    final deliveryMessage = (res['deliveryMessage'] as String?) ?? (res['message'] as String?);
    final deliveryError = res['deliveryError'] as String?;
    final cooldownsRaw = res['channelCooldowns'];
    Map<String, int>? channelCooldowns;
    if (cooldownsRaw is Map) {
      channelCooldowns = {
        'sms': (cooldownsRaw['sms'] as num?)?.toInt() ?? 0,
        'email': (cooldownsRaw['email'] as num?)?.toInt() ?? 0,
      };
    }
    final expiresIn = (res['expiresIn'] as num?)?.toInt() ?? 600;
    final resendCooldown = (res['resendCooldown'] as num?)?.toInt() ?? 30;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OtpVerificationScreen(
          studentId: studentId,
          password: password,
          maskedPhone: maskedPhone,
          maskedEmail: maskedEmail,
          initialChannel: initialChannel,
          smsAvailable: smsAvailable,
          emailAvailable: emailAvailable,
          initialDeliveryStatus: deliveryStatus,
          initialDeliveryMessage: deliveryMessage,
          initialDeliveryError: deliveryError,
          initialChannelCooldowns: channelCooldowns,
          expiresIn: expiresIn,
          resendCooldown: resendCooldown,
        ),
      ),
    );
  }

  void _showOtpChannelSelectionModal({
    required String studentId,
    required String password,
    required Map<String, dynamic> initRes,
  }) {
    final fullName = (initRes['fullName'] as String?) ?? 'Student Scholar';
    final maskedPhone = (initRes['maskedPhone'] as String?) ?? '09•• ••• ••••';
    final maskedEmail = (initRes['maskedEmail'] as String?) ?? '••••@ustp.edu.ph';
    final availRaw = initRes['availableChannels'];
    final availMap = availRaw is Map ? availRaw : const {};
    final bool canSms = availMap['sms'] is bool ? (availMap['sms'] as bool) : true;
    final bool canEmail = availMap['email'] is bool
        ? (availMap['email'] as bool)
        : (initRes['maskedEmail'] != null);

    String selectedChannel = canSms ? 'sms' : (canEmail ? 'email' : 'sms');
    bool isSending = false;
    String? modalError;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.90,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x330F172A),
                    blurRadius: 32,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsets.only(
                    left: 24,
                    right: 24,
                    top: 14,
                    bottom: MediaQuery.of(context).viewInsets.bottom + 20,
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
                            color: const Color(0xFFCBD5E1),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Hero Icon badge
                      Center(
                        child: Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFFFFBEB),
                            border: Border.all(color: const Color(0xFFFDE68A), width: 2),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x26F5B025),
                                blurRadius: 16,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          child: const Icon(
                            LucideIcons.shieldCheck,
                            color: Color(0xFF0F3260),
                            size: 28,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Eyebrow badge
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(LucideIcons.keyRound, size: 12, color: Color(0xFFF59E0B)),
                              const SizedBox(width: 5),
                              Text(
                                'FIRST-TIME LOGIN SECURITY SETUP',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                  color: const Color(0xFF0A1931),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Title
                      Text(
                        'Choose Verification Method',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0A1931),
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Subtitle
                      Text(
                        'Welcome, $fullName! Select where you would like to receive your 6-digit one-time password (OTP):',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: const Color(0xFF64748B),
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Error message if any
                      if (modalError != null) ...[
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.alertCircle, color: Color(0xFFDC2626), size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  modalError!,
                                  style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFFB91C1C)),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Option 1: SMS Card
                      _buildChannelOptionCard(
                        title: 'SMS / Mobile Number',
                        badge: 'Instant SMS',
                        badgeBg: const Color(0xFFFEF3C7),
                        badgeFg: const Color(0xFF92400E),
                        target: maskedPhone,
                        desc: 'Dispatched directly to your registered mobile number',
                        icon: LucideIcons.messageSquare,
                        isSelected: selectedChannel == 'sms',
                        isEnabled: canSms,
                        onTap: () {
                          if (canSms) setModalState(() => selectedChannel = 'sms');
                        },
                      ),
                      const SizedBox(height: 10),

                      // Option 2: Email Card
                      _buildChannelOptionCard(
                        title: 'Email Address',
                        badge: 'Official Email',
                        badgeBg: const Color(0xFFEFF6FF),
                        badgeFg: const Color(0xFF1E40AF),
                        target: maskedEmail,
                        desc: 'Dispatched to your registered scholar email address',
                        icon: LucideIcons.mail,
                        isSelected: selectedChannel == 'email',
                        isEnabled: canEmail,
                        onTap: () {
                          if (canEmail) setModalState(() => selectedChannel = 'email');
                        },
                      ),
                      const SizedBox(height: 14),

                      // Security note
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(LucideIcons.lock, size: 13, color: Color(0xFF0A1931)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Your OTP code is single-use and valid for 10 minutes.',
                                style: GoogleFonts.inter(fontSize: 11.5, color: const Color(0xFF64748B)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Primary Button: Send Verification Code
                      SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          onPressed: isSending
                              ? null
                              : () async {
                                  setModalState(() {
                                    isSending = true;
                                    modalError = null;
                                  });
                                  try {
                                    final sendRes = await _authService.initiateStudentLogin(
                                      studentId: studentId,
                                      password: password,
                                      preferredChannel: selectedChannel,
                                    );
                                    if (!context.mounted) return;
                                    Navigator.pop(ctx);
                                    _navigateToOtpScreen(
                                      studentId: studentId,
                                      password: password,
                                      res: sendRes,
                                      channelOverride: selectedChannel,
                                    );
                                  } catch (e) {
                                    setModalState(() {
                                      isSending = false;
                                      modalError = e.toString().replaceAll('Exception: ', '').trim();
                                    });
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF5B025),
                            foregroundColor: const Color(0xFF0A1931),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: isSending
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation(Color(0xFF0A1931)),
                                  ),
                                )
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(LucideIcons.send, size: 16),
                                    const SizedBox(width: 8),
                                    Text(
                                      'SEND VERIFICATION CODE',
                                      style: GoogleFonts.inter(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Cancel Button
                      TextButton(
                        onPressed: isSending ? null : () => Navigator.pop(ctx),
                        child: Text(
                          'Back to Login',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF64748B),
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

  Widget _buildChannelOptionCard({
    required String title,
    required String badge,
    required Color badgeBg,
    required Color badgeFg,
    required String target,
    required String desc,
    required IconData icon,
    required bool isSelected,
    required bool isEnabled,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: isEnabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: !isEnabled
              ? const Color(0xFFF8FAFC)
              : (isSelected ? const Color(0xFFFFFDF7) : Colors.white),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: !isEnabled
                ? const Color(0xFFE2E8F0)
                : (isSelected ? const Color(0xFFF5B025) : const Color(0xFFE2E8F0)),
            width: isSelected ? 2 : 1.5,
          ),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x1AF5B025),
                    blurRadius: 10,
                    offset: Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFF0A1931) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 18,
                color: isSelected ? const Color(0xFFF5B025) : const Color(0xFF0A1931),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF0A1931),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isEnabled ? badgeBg : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isEnabled ? badge : 'Unavailable',
                          style: GoogleFonts.inter(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: isEnabled ? badgeFg : const Color(0xFF94A3B8),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    target,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0A1931),
                    ),
                  ),
                  Text(
                    desc,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? const Color(0xFFF5B025) : Colors.transparent,
                border: Border.all(
                  color: isSelected ? const Color(0xFFF5B025) : const Color(0xFFCBD5E1),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(LucideIcons.check, size: 12, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  void _showGranteeAccessDeniedModal({required String studentId}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.90,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
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
                left: 24,
                right: 24,
                top: 14,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
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
                        color: const Color(0xFFCBD5E1),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),

                  // Hero Icon with pulsing/glowing ring
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFFECACA),
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFEF4444).withOpacity(0.15),
                            blurRadius: 20,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          LucideIcons.shieldAlert,
                          size: 34,
                          color: Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Eyebrow badge
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            LucideIcons.lock,
                            size: 12,
                            color: Color(0xFF64748B),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'OFFICIAL GRANTEE RESTRICTION',
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2,
                              color: const Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Title
                  Text(
                    'Grantee Record Not Found',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Subtitle
                  Text(
                    'ScholarDoc is strictly reserved for verified scholars listed in the official scholarship database.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 13.5,
                      color: const Color(0xFF64748B),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Entered Student ID Box
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.badge,
                          size: 16,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Entered ID: ',
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            studentId.isNotEmpty ? studentId : 'None provided',
                            style: GoogleFonts.inter(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: Text(
                            'Not in Masterlist',
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFFDC2626),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Why Access Denied Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              LucideIcons.info,
                              size: 15,
                              color: Color(0xFF0F3260),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Why was access denied?',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F3260),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _buildModalBullet(
                          icon: LucideIcons.graduationCap,
                          title: 'Eligible Grantees Only',
                          desc:
                              'Only officially enrolled scholars (TES, UniFAST, and university grant recipients) can sign in to submit documents and verify Landbank accounts.',
                        ),
                        const SizedBox(height: 8),
                        _buildModalBullet(
                          icon: LucideIcons.fileSpreadsheet,
                          title: 'Official Masterlist Sync',
                          desc:
                              'Your student credentials do not match any active record in the verified grantee billing registry for AY 2026-2027.',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // What to do Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              LucideIcons.helpCircle,
                              size: 15,
                              color: Color(0xFFB45309),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'What can you do?',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFB45309),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '1. Double-check your entered Student ID for any typographical error.\n'
                          '2. If you are a qualified grantee, visit the Scholarship & Student Affairs Unit at USTP Oroquieta Campus (Mobod).\n'
                          '3. Or contact the coordinator via email below:',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF92400E),
                            height: 1.55,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () {
                            Clipboard.setData(
                              const ClipboardData(
                                text: 'scholarships.oroquieta@ustp.edu.ph',
                              ),
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Email copied to clipboard: scholarships.oroquieta@ustp.edu.ph',
                                  style: GoogleFonts.inter(fontSize: 12),
                                ),
                                duration: const Duration(seconds: 2),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: const Color(0xFFFCD34D),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  LucideIcons.mail,
                                  size: 13,
                                  color: Color(0xFFB45309),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'scholarships.oroquieta@ustp.edu.ph',
                                  style: GoogleFonts.inter(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFFB45309),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Icon(
                                  LucideIcons.copy,
                                  size: 12,
                                  color: Color(0xFFB45309),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Action Buttons
                  // Primary: Re-check Student ID
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F3260), Color(0xFF1E4C87)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F3260).withOpacity(0.25),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _studentIdFocusNode.requestFocus();
                        _studentIdController.selection = TextSelection(
                          baseOffset: 0,
                          extentOffset: _studentIdController.text.length,
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        foregroundColor: Colors.white,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            LucideIcons.refreshCw,
                            size: 16,
                            color: Color(0xFFFBC02D),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Check & Re-enter Student ID',
                            style: GoogleFonts.inter(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Secondary: Dismiss
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF64748B),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(
                      'Dismiss',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
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
  }

  Widget _buildModalBullet({
    required IconData icon,
    required String title,
    required String desc,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 14, color: const Color(0xFF0F3260)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF334155),
                height: 1.45,
              ),
              children: [
                TextSpan(
                  text: '$title: ',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: desc),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
