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
        .replaceAllMapped(RegExp(r'\b2[oO]([0-9]{2})', caseSensitive: false), (m) => '20${m[1]}')
        .replaceAll(RegExp(r'[oO](?=\d)'), '0')
        .replaceAll(RegExp(r'(?<=\d)[oO]'), '0');

    // Replace all Unicode dashes, slashes, "to", dots, and underscores between numbers with hyphen
    clean = clean.replaceAll(
      RegExp(r'[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D/\\~_\.]|(?<=\d)\s*(?:to|until)\s*(?=\d)'),
      '-',
    );

    // Remove unintended spaces inside digit pairs (e.g. "20 26" -> "2026")
    clean = clean.replaceAllMapped(RegExp(r'\b(20)\s+(\d{2})\b'), (m) => '${m[1]}${m[2]}');

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
    final lower = raw.toLowerCase().trim()
        .replaceAll(RegExp(r'[\u00B0\u00BA˚]'), '*')
        .replaceAll(RegExp(r'\s+'), ' ');

    // 2nd Semester check first (handles 2nd, second, 2*, 2°*, 2 nd, 2-nd, 2rd, sem 2, sem2)
    final is2nd = RegExp(
          r'\b(?:2\s*nd|2\s*rd|second|2[\*+\#\~\^•]+|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b',
          caseSensitive: false,
        ).hasMatch(lower) ||
        RegExp(r'\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:2|ii)\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\b(?:2|ii)\s*[\/\-]\s*sem\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\b2nd\s+semester\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\bsecond\s+semester\b', caseSensitive: false).hasMatch(lower) ||
        lower.contains('2* semester') ||
        lower.contains('2* sem');
    if (is2nd) return '2nd Semester';

    // 1st Semester (handles 1st, first, 1*, 1°*, 1 st, 1-st, ist, 1sl, 1si, sem 1, sem1)
    final is1st = RegExp(
          r'\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+\#\~\^•]+|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b',
          caseSensitive: false,
        ).hasMatch(lower) ||
        RegExp(r'\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:1|i)\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\b(?:1|i)\s*[\/\-]\s*sem\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\b1st\s+semester\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\bfirst\s+semester\b', caseSensitive: false).hasMatch(lower) ||
        RegExp(r'\b[il]st\s+sem(?:ester)?\b', caseSensitive: false).hasMatch(lower) ||
        lower.contains('1* semester') ||
        lower.contains('1* sem');
    if (is1st) return '1st Semester';

    if (lower.contains('summer') || lower.contains('midyear') || lower.contains('mid-year') || lower.contains('mid year')) {
      return 'Summer / Midyear';
    }

    // Direct standalone short forms without other text
    if (lower == '1st sem' || lower == '1st semester' || lower == 'first sem' || lower == 'first semester' || lower == '1st') {
      return '1st Semester';
    }
    if (lower == '2nd sem' || lower == '2nd semester' || lower == 'second sem' || lower == 'second semester' || lower == '2nd') {
      return '2nd Semester';
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

    final normDetectedYear = detectedYear != null && detectedYear.trim().isNotEmpty ? normalizeYear(detectedYear) : null;
    final normDetectedSem = detectedSemester != null && detectedSemester.trim().isNotEmpty ? normalizeSemester(detectedSemester) : null;

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

    // Specific granular status titles and messages
    if (normDetectedYear == null && normDetectedSem != null) {
      return TermValidationResult(
        isValid: false,
        yearMatches: false,
        semesterMatches: semMatches,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Academic Year Unreadable',
        message: 'Detected $normDetectedSem, but could not clearly read the academic year from the validation sticker. Required period: ${target.displayString}. Please retake the scan with better lighting.',
        isFlagged: true,
      );
    }

    if (normDetectedYear != null && normDetectedSem == null) {
      return TermValidationResult(
        isValid: false,
        yearMatches: yearMatches,
        semesterMatches: false,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Semester Unreadable',
        message: 'Detected AY $normDetectedYear, but could not clearly read the semester from the validation sticker. Required period: ${target.displayString}. Please retake the scan with better lighting.',
        isFlagged: true,
      );
    }

    final isExpired = normDetectedYear != null && normDetectedYear.compareTo(target.academicYear) < 0;
    if (isExpired) {
      return TermValidationResult(
        isValid: false,
        yearMatches: false,
        semesterMatches: semMatches,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Expired Validation Sticker',
        message: 'The validation sticker on your ID is expired ($normDetectedYear). The active school period requires ${target.displayString}. You cannot proceed with an outdated ID sticker.',
        isFlagged: true,
      );
    }

    if (!yearMatches && !semMatches) {
      return TermValidationResult(
        isValid: false,
        yearMatches: false,
        semesterMatches: false,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Sticker Term Mismatch',
        message: 'The validation sticker does not match the active school period. Both the academic year ($normDetectedYear) and semester ($normDetectedSem) do not match the required period (${target.displayString}).',
        isFlagged: true,
      );
    }

    if (!yearMatches) {
      return TermValidationResult(
        isValid: false,
        yearMatches: false,
        semesterMatches: semMatches,
        currentTerm: target,
        detectedTerm: detected,
        statusTitle: 'Academic Year Mismatch',
        message: 'The academic year on your ID sticker ($normDetectedYear) does not match the active school period (${target.academicYear}).',
        isFlagged: true,
      );
    }

    return TermValidationResult(
      isValid: false,
      yearMatches: yearMatches,
      semesterMatches: false,
      currentTerm: target,
      detectedTerm: detected,
      statusTitle: 'Semester Mismatch',
      message: 'The semester on your ID sticker ($normDetectedSem) does not match the active school period (${target.semester}).',
      isFlagged: true,
    );
  }

  /// Checks if a record's year and semester match a target academic term.
  static bool isTermMatching({
    String? rawYear,
    String? rawSemester,
    required AcademicTerm target,
  }) {
    if (rawYear == null || rawYear.trim().isEmpty) return false;
    final yearMatch = isYearMatching(rawYear, target.academicYear);
    if (!yearMatch) return false;
    if (rawSemester == null || rawSemester.trim().isEmpty) return true;
    return isSemesterMatching(rawSemester, target.semester);
  }

  /// Returns a curated list of academic terms for filtering and tracking,
  /// guaranteeing that the active term and any student historical term are included.
  static List<AcademicTerm> getAvailableTerms({
    String? studentYear,
    String? studentSemester,
  }) {
    final List<AcademicTerm> terms = [];

    void addUnique(AcademicTerm term) {
      if (!terms.any((t) =>
          isYearMatching(t.academicYear, term.academicYear) &&
          isSemesterMatching(t.semester, term.semester))) {
        terms.add(term);
      }
    }

    // 1. Current active term always first
    addUnique(_currentTerm);

    // 2. Student record's specific historical term (if valid)
    if (studentYear != null && studentYear.trim().isNotEmpty) {
      addUnique(AcademicTerm(
        academicYear: normalizeYear(studentYear),
        semester: normalizeSemester(studentSemester ?? '1st Semester'),
      ));
    }

    // 3. Standard school terms in reverse chronological order
    addUnique(const AcademicTerm(academicYear: '2026-2027', semester: '1st Semester'));
    addUnique(const AcademicTerm(academicYear: '2025-2026', semester: '2nd Semester'));
    addUnique(const AcademicTerm(academicYear: '2025-2026', semester: '1st Semester'));
    addUnique(const AcademicTerm(academicYear: '2024-2025', semester: '2nd Semester'));
    addUnique(const AcademicTerm(academicYear: '2024-2025', semester: '1st Semester'));

    return terms;
  }
}

