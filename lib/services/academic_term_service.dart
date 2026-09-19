import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Represents an academic term (Academic Year and Semester).
class AcademicTerm {
  final String academicYear; // e.g. "2026-2027"
  final String semester;     // e.g. "1st Semester"

  const AcademicTerm({
    required this.academicYear,
    required this.semester,
  });

  /// User-facing display string, e.g. "AY 2026–2027 • 1st Semester"
  String get displayString => 'AY $academicYear • $semester';

  /// Standard tag string, e.g. "AY 2026-2027, 1st Sem"
  String get shortString {
    final semShort = semester.toLowerCase().contains('1st')
        ? '1st Sem'
        : semester.toLowerCase().contains('2nd')
            ? '2nd Sem'
            : semester;
    return 'AY $academicYear, $semShort';
  }

  @override
  String toString() => displayString;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AcademicTerm &&
          runtimeType == other.runtimeType &&
          AcademicTermService.normalizeYear(academicYear) ==
              AcademicTermService.normalizeYear(other.academicYear) &&
          AcademicTermService.normalizeSemester(semester) ==
              AcademicTermService.normalizeSemester(other.semester);

  @override
  int get hashCode =>
      AcademicTermService.normalizeYear(academicYear).hashCode ^
      AcademicTermService.normalizeSemester(semester).hashCode;
}

/// Result of validating a scanned ID sticker against the current active academic period.
class TermValidationResult {
  /// Whether both the academic year and semester match the current school term.
  final bool isValid;

  /// Whether the academic year matched.
  final bool yearMatches;

  /// Whether the semester matched.
  final bool semesterMatches;

  /// The active system term used for comparison.
  final AcademicTerm currentTerm;

  /// The detected academic term from the sticker (null if not detected).
  final AcademicTerm? detectedTerm;

  /// Friendly status title.
  final String statusTitle;

  /// Detailed human-readable feedback message.
  final String message;

  /// True if the document should be flagged/blocked due to mismatch or absence.
  final bool isFlagged;

  const TermValidationResult({
    required this.isValid,
    required this.yearMatches,
    required this.semesterMatches,
    required this.currentTerm,
    this.detectedTerm,
    required this.statusTitle,
    required this.message,
    required this.isFlagged,
  });
}

/// Central service for retrieving, updating, and verifying academic years & semesters.
class AcademicTermService {
  static const String _prefKeyAy = 'active_academic_year';
  static const String _prefKeySem = 'active_semester';

  /// Default active academic period (e.g., current period for upcoming/active cycle)
  static const String defaultAcademicYear = '2026-2027';
  static const String defaultSemester = '1st Semester';

  static AcademicTerm _currentTerm = const AcademicTerm(
    academicYear: defaultAcademicYear,
    semester: defaultSemester,
  );

  /// Returns the current in-memory active academic term.
  static AcademicTerm get currentTerm => _currentTerm;

  /// Initializes the service by loading from local storage and syncing with Supabase.
  static Future<AcademicTerm> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedAy = prefs.getString(_prefKeyAy);
      final savedSem = prefs.getString(_prefKeySem);

      if (savedAy != null && savedSem != null) {
        _currentTerm = AcademicTerm(
          academicYear: normalizeYear(savedAy),
          semester: normalizeSemester(savedSem),
        );
      }

      // Optionally sync from Supabase if online
      await syncFromSupabase();
    } catch (e) {
      debugPrint('AcademicTermService.initialize error: $e');
    }
    return _currentTerm;
  }

  /// Sets the active term and persists locally.
  static Future<void> setActiveTerm({
    required String academicYear,
    required String semester,
  }) async {
    _currentTerm = AcademicTerm(
      academicYear: normalizeYear(academicYear),
      semester: normalizeSemester(semester),
    );

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKeyAy, _currentTerm.academicYear);
      await prefs.setString(_prefKeySem, _currentTerm.semester);
    } catch (e) {
      debugPrint('AcademicTermService: Failed to cache active term: $e');
    }
  }

  /// Attempts to fetch the current active term from Supabase settings or annex records.
  static Future<AcademicTerm?> syncFromSupabase() async {
    try {
      final client = Supabase.instance.client;

      // 1. Try system_settings table if available
      try {
        final res = await client
            .from('system_settings')
            .select('key, value')
            .inFilter('key', ['current_academic_year', 'current_semester']);
        if (res.isNotEmpty) {
          String? ay;
          String? sem;
          for (final row in res) {
            if (row['key'] == 'current_academic_year') ay = row['value']?.toString();
            if (row['key'] == 'current_semester') sem = row['value']?.toString();
          }
          if (ay != null && sem != null) {
            await setActiveTerm(academicYear: ay, semester: sem);
            return _currentTerm;
          }
        }
      } catch (_) {
        // Table may not exist yet; fall through
      }

      // 2. Try fetching latest distinct term from annex_form_2
      try {
        final res = await client
            .from('annex_form_2')
            .select('academic_year, semester')
            .order('created_at', ascending: false)
            .limit(1);
        if (res.isNotEmpty) {
          final row = res.first;
          final ay = row['academic_year']?.toString();
          final sem = row['semester']?.toString();
          if (ay != null && sem != null) {
            // If current in-memory is still default, adopt DB value if desired
            debugPrint('AcademicTermService: Synced term from annex_form_2: AY $ay, $sem');
          }
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('AcademicTermService.syncFromSupabase error: $e');
    }
    return _currentTerm;
  }

  /// Normalizes any representation of an Academic Year into standard "YYYY-YYYY" format.
  /// Examples:
  /// - "A.Y. 2026 - 2027" -> "2026-2027"
  /// - "AY 2026–2027" -> "2026-2027"
  /// - "2026/2027" -> "2026-2027"
  /// - "2026 - 27" -> "2026-2027"
  /// - "2O26-2O27" (OCR letter O) -> "2026-2027"
  static String normalizeYear(String raw) {
    if (raw.isEmpty) return '';

    // Replace common OCR confusion: uppercase 'O' inside year numbers with '0'
    var clean = raw
        .replaceAll(RegExp(r'\b2[oO]2'), '202')
        .replaceAll(RegExp(r'[oO](?=\d)'), '0')
        .replaceAll(RegExp(r'(?<=\d)[oO]'), '0');

    // Replace em/en dashes, slashes, and spaces between numbers with hyphen
    clean = clean.replaceAll(RegExp(r'[\u2013\u2014\u2212/]'), '-');

    // Extract 4-digit start year and 2-to-4 digit end year
    final match = RegExp(r'(20\d{2})\s*-\s*(20\d{2}|\d{2})').firstMatch(clean);
    if (match != null) {
      final start = match.group(1)!;
      var end = match.group(2)!;
      if (end.length == 2) {
        // e.g. "2026-27" -> "2026-2027"
        end = '${start.substring(0, 2)}$end';
      }
      return '$start-$end';
    }

    // Single 4-digit year fallback: e.g. "2026" -> "2026-2027"
    final singleMatch = RegExp(r'\b(20\d{2})\b').firstMatch(clean);
    if (singleMatch != null) {
      final y = int.parse(singleMatch.group(1)!);
      return '$y-${y + 1}';
    }

    return clean.trim();
  }

  /// Normalizes semester string into "1st Semester", "2nd Semester", or "Summer / Midyear".
  static String normalizeSemester(String raw) {
    if (raw.isEmpty) return '';
    final lower = raw.toLowerCase().trim();

    if (lower.contains('1st') ||
        lower.contains('first') ||
        lower.contains('sem 1') ||
        lower.contains('sem1') ||
        lower == '1') {
      return '1st Semester';
    }

    if (lower.contains('2nd') ||
        lower.contains('second') ||
        lower.contains('sem 2') ||
        lower.contains('sem2') ||
        lower == '2') {
      return '2nd Semester';
    }

    if (lower.contains('summer') || lower.contains('midyear') || lower.contains('mid-year')) {
      return 'Summer / Midyear';
    }

    return raw.trim();
  }

  /// Checks if two academic year strings match.
  static bool isYearMatching(String a, String b) {
    final normA = normalizeYear(a);
    final normB = normalizeYear(b);
    if (normA.isEmpty || normB.isEmpty) return false;
    return normA == normB;
  }

  /// Checks if two semester strings match.
  static bool isSemesterMatching(String a, String b) {
    final normA = normalizeSemester(a);
    final normB = normalizeSemester(b);
    if (normA.isEmpty || normB.isEmpty) return false;
    return normA == normB;
  }

  /// Validates a detected term against the target active term.
  static TermValidationResult validateScannedTerm({
    String? detectedYear,
    String? detectedSemester,
    AcademicTerm? targetTerm,
    bool isApiError = false,
    String? apiErrorMessage,
  }) {
    final target = targetTerm ?? _currentTerm;

    if (detectedYear == null && detectedSemester == null) {
      final isOffline = isApiError || (apiErrorMessage != null && (apiErrorMessage.contains('403') || apiErrorMessage.contains('disabled')));
      return TermValidationResult(
        isValid: false,
        yearMatches: false,
        semesterMatches: false,
        currentTerm: target,
        statusTitle: isOffline ? 'Document AI Scanner Offline' : 'Validation Sticker Missing',
        message: isOffline
            ? 'The automated Document AI sticker scanner is temporarily offline. If your physical ID has a valid sticker for AY ${target.academicYear} • ${target.semester}, you may confirm and proceed for manual Admin validation.'
            : 'Could not detect an academic year or semester validation sticker on the upper back of the student ID card. Please ensure the sticker is clearly visible, well-lit, and unshaded.',
        isFlagged: true,
      );
    }

    final normDetectedYear = detectedYear != null ? normalizeYear(detectedYear) : null;
    final normDetectedSem = detectedSemester != null ? normalizeSemester(detectedSemester) : null;

    final detected = AcademicTerm(
      academicYear: normDetectedYear ?? 'Unknown AY',
      semester: normDetectedSem ?? 'Unknown Sem',
    );

    final yearMatches = normDetectedYear != null && isYearMatching(normDetectedYear, target.academicYear);
    final semMatches = normDetectedSem != null && isSemesterMatching(normDetectedSem, target.semester);

    if (yearMatches && semMatches) {
      return TermValidationResult(
        isValid: true,
        yearMatches: true,
        semesterMatches: true,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Valid Current Sticker',
        message: 'Validation sticker verified! Matched active school period: ${target.displayString}.',
        isFlagged: false,
      );
    }

    // Handle mismatches
    final List<String> issues = [];
    if (!yearMatches) {
      issues.add('Academic Year mismatch (Detected: ${normDetectedYear ?? "None"}, Required: ${target.academicYear})');
    }
    if (!semMatches) {
      issues.add('Semester mismatch (Detected: ${normDetectedSem ?? "None"}, Required: ${target.semester})');
    }

    final issueDesc = issues.join(' and ');
    final isExpired = normDetectedYear != null && normDetectedYear.compareTo(target.academicYear) < 0;

    return TermValidationResult(
      isValid: false,
      yearMatches: yearMatches,
      semesterMatches: semMatches,
      currentTerm: target,
      detectedTerm: detected,
      statusTitle: isExpired ? 'Expired Validation Sticker' : 'Sticker Term Mismatch',
      message: 'The validation sticker does not match the active school period. $issueDesc. You cannot proceed with an unvalidated or outdated ID card.',
      isFlagged: true,
    );
  }
}
