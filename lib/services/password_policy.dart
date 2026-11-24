/// Shared password strength & validation policy used by both the UI and
/// [AuthService] so client-side checks and service-level enforcement stay
/// strictly aligned.
enum PasswordStrengthLevel {
  empty,
  weak,
  fair,
  good,
  strong,
}

class PasswordStrengthResult {
  final PasswordStrengthLevel level;
  final int score; // 0..4
  final String label;

  const PasswordStrengthResult({
    required this.level,
    required this.score,
    required this.label,
  });
}

class PasswordPolicy {
  PasswordPolicy._();

  static const int minLength = 8;
  static const int maxLength = 72; // Safe bcrypt / Supabase Auth limit

  /// Strips spaces and hyphens and lowercases for ID comparison.
  static String normalizeToken(String value) {
    return value.trim().replaceAll(RegExp(r'[\s\-_]'), '').toLowerCase();
  }

  static bool hasMinLength(String password) =>
      password.length >= minLength && password.length <= maxLength;

  static bool hasUppercase(String password) =>
      RegExp(r'[A-Z]').hasMatch(password);

  static bool hasLowercase(String password) =>
      RegExp(r'[a-z]').hasMatch(password);

  static bool hasDigit(String password) => RegExp(r'[0-9]').hasMatch(password);

  static bool hasSpecialChar(String password) =>
      RegExp(r'[^A-Za-z0-9\s]').hasMatch(password);

  static bool hasNoEdgeWhitespace(String password) =>
      password.isNotEmpty && password == password.trim();

  static bool isDifferentFromCurrent(
    String newPassword,
    String? currentPassword,
  ) {
    if (currentPassword == null || currentPassword.isEmpty) return true;
    return newPassword != currentPassword &&
        newPassword.trim() != currentPassword.trim();
  }

  static bool isNotStudentId(
    String newPassword,
    Iterable<String> studentIds,
  ) {
    final trimmedNew = newPassword.trim();
    if (trimmedNew.isEmpty) return true;
    final normNew = normalizeToken(trimmedNew);
    if (normNew.isEmpty) return true;

    for (final rawId in studentIds) {
      final cleanId = rawId.trim();
      if (cleanId.isEmpty) continue;
      if (trimmedNew.toLowerCase() == cleanId.toLowerCase()) {
        return false;
      }
      final normId = normalizeToken(cleanId);
      if (normId.isNotEmpty && normNew == normId) {
        return false;
      }
    }
    return true;
  }

  static String? validateCurrentPassword(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your current password';
    }
    return null;
  }

  static String? validateNewPassword(
    String? value, {
    String? currentPassword,
    Iterable<String> studentIds = const [],
  }) {
    if (value == null || value.isEmpty) {
      return 'Please enter a new password';
    }
    if (value != value.trim()) {
      return 'Password cannot start or end with spaces';
    }
    if (value.length < minLength) {
      return 'Password must be at least $minLength characters long';
    }
    if (value.length > maxLength) {
      return 'Password must not exceed $maxLength characters';
    }
    if (!hasUppercase(value)) {
      return 'Include at least one uppercase letter (A–Z)';
    }
    if (!hasLowercase(value)) {
      return 'Include at least one lowercase letter (a–z)';
    }
    if (!hasDigit(value)) {
      return 'Include at least one number (0–9)';
    }
    if (!isDifferentFromCurrent(value, currentPassword)) {
      return 'New password must be different from your current password';
    }
    if (!isNotStudentId(value, studentIds)) {
      return 'New password cannot be the same as your Student ID';
    }
    return null;
  }

  static String? validateConfirmPassword(
    String? value,
    String newPassword,
  ) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your new password';
    }
    if (value != newPassword) {
      return 'Passwords do not match';
    }
    return null;
  }

  /// Evaluates password strength on a 0..4 scale for visual feedback.
  static PasswordStrengthResult evaluateStrength(String password) {
    if (password.isEmpty) {
      return const PasswordStrengthResult(
        level: PasswordStrengthLevel.empty,
        score: 0,
        label: '',
      );
    }

    int points = 0;
    if (password.length >= minLength) points++;
    if (password.length >= 12) points++;
    if (hasUppercase(password) && hasLowercase(password)) points++;
    if (hasDigit(password)) points++;
    if (hasSpecialChar(password)) points++;

    if (password.length < minLength || points <= 1) {
      return const PasswordStrengthResult(
        level: PasswordStrengthLevel.weak,
        score: 1,
        label: 'Weak',
      );
    }
    if (points == 2) {
      return const PasswordStrengthResult(
        level: PasswordStrengthLevel.fair,
        score: 2,
        label: 'Fair',
      );
    }
    if (points == 3 || points == 4) {
      final bool meetsRequired = hasMinLength(password) &&
          hasUppercase(password) &&
          hasLowercase(password) &&
          hasDigit(password);
      if (meetsRequired && (hasSpecialChar(password) || password.length >= 12)) {
        return const PasswordStrengthResult(
          level: PasswordStrengthLevel.strong,
          score: 4,
          label: 'Strong',
        );
      }
      return const PasswordStrengthResult(
        level: PasswordStrengthLevel.good,
        score: 3,
        label: 'Good',
      );
    }
    return const PasswordStrengthResult(
      level: PasswordStrengthLevel.strong,
      score: 4,
      label: 'Strong',
    );
  }
}
