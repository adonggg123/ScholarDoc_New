import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../services/password_policy.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

typedef PasswordUpdateCallback = Future<void> Function({
  required String currentPassword,
  required String newPassword,
  required String confirmPassword,
});

class ChangePasswordScreen extends StatefulWidget {
  final String? studentId;
  final bool hasCustomPassword;
  final DateTime? passwordUpdatedAt;
  final PasswordUpdateCallback? onUpdatePassword;

  const ChangePasswordScreen({
    super.key,
    this.studentId,
    this.hasCustomPassword = false,
    this.passwordUpdatedAt,
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
      _errorMessage = null;
    });

    try {
      final currentPwd = _currentPasswordController.text;
      final newPwd = _newPasswordController.text;
      final confirmPwd = _confirmPasswordController.text;

      final updateFn = widget.onUpdatePassword ??
          (_authService ??= AuthService()).updateStudentPassword;

      await updateFn(
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
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
        setState(() => _isSubmitting = false);
      }
    }
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
                                'For your protection, updating your password will keep this device signed in and sign out other devices. Use your new password on your next login.',
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
                                ? 'Updating Password...'
                                : 'Update Password',
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
