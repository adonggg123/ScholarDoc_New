import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'academic_term_service.dart';
import 'document_ai_service.dart';

/// Result of validating a Certificate of Registration (COR) PDF against the
/// student's registered name and the currently active academic term.
class CorScanResult {
  /// True only when the file is a readable PDF AND name, academic year and semester all match.
  final bool isValid;

  /// Whether the uploaded file is a genuine PDF (magic-byte verified).
  final bool isPdf;

  /// Whether any text could be read from the PDF (digital text or OCR).
  final bool isReadable;

  final bool nameMatches;
  final bool yearMatches;
  final bool semesterMatches;

  /// Whether the text contains typical COR keywords (informational only).
  final bool looksLikeCor;

  final String? detectedName;
  final String? detectedAcademicYear;
  final String? detectedSemester;

  /// The active term the COR was compared against.
  final AcademicTerm targetTerm;

  final int pageCount;
  final String rawExtractedText;
  final String engineUsed;

  /// Human-readable status/feedback.
  final String message;

  const CorScanResult({
    required this.isValid,
    required this.isPdf,
    required this.isReadable,
    required this.nameMatches,
    required this.yearMatches,
    required this.semesterMatches,
    required this.looksLikeCor,
    this.detectedName,
    this.detectedAcademicYear,
    this.detectedSemester,
    required this.targetTerm,
    required this.pageCount,
    required this.rawExtractedText,
    required this.engineUsed,
    required this.message,
  });
}

/// Validates Certificate of Registration (COR) PDFs.
///
/// Text extraction pipeline:
///  1. On-device digital text extraction (Syncfusion PDF) — fast, offline.
///  2. Backend OCR proxy (`/api/document-ai/scan-cor`) — for scanned/image-only PDFs.
///  3. Direct OCR.space PDF OCR — last-resort fallback.
///
/// Name and term matching reuse [DocumentAIScannerService] and [AcademicTermService]
/// so a COR is judged by exactly the same rules as the School ID.
class CorValidationService {
  /// Maximum accepted COR file size.
  static const int maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

  /// Minimum count of alphanumeric characters for extracted text to be considered usable.
  static const int _minMeaningfulChars = 40;

  static final Map<String, CorScanResult> _cache = {};

  static void clearCache() => _cache.clear();

  /// Returns true if [bytes] start with the PDF signature `%PDF-`
  /// (allowing for a small amount of leading junk, as permitted by the spec).
  static bool isPdfBytes(Uint8List bytes) {
    if (bytes.length < 5) return false;
    final searchLen = bytes.length < 1024 ? bytes.length - 4 : 1020;
    for (int i = 0; i < searchLen; i++) {
      if (bytes[i] == 0x25 && // %
          bytes[i + 1] == 0x50 && // P
          bytes[i + 2] == 0x44 && // D
          bytes[i + 3] == 0x46 && // F
          bytes[i + 4] == 0x2D) {
        // -
        return true;
      }
    }
    return false;
  }

  /// Validates a COR PDF against [expectedName] and the active academic term
  /// (or [targetTerm] if provided).
  static Future<CorScanResult> validateCorPdf(
    Uint8List pdfBytes, {
    required String expectedName,
    AcademicTerm? targetTerm,
    void Function(String status)? onProgress,
  }) async {
    final term = targetTerm ?? AcademicTermService.currentTerm;

    if (!isPdfBytes(pdfBytes)) {
      return _buildFailure(
        term: term,
        isPdf: false,
        message:
            'The selected file is not a valid PDF document. Please upload your COR as a PDF file.',
      );
    }

    if (expectedName.trim().isEmpty) {
      return _buildFailure(
        term: term,
        isPdf: true,
        message:
            'Your registered student name could not be loaded. Please check your profile or internet connection and try again.',
      );
    }

    final cacheKey =
        '${DocumentAIScannerService.computeImageHash(pdfBytes)}:${expectedName.trim().toUpperCase()}:${term.academicYear}:${term.semester}';
    final cached = _cache[cacheKey];
    if (cached != null) return cached;

    // 1. On-device digital text extraction
    onProgress?.call('Reading PDF text...');
    String text = '';
    int pageCount = 0;
    String engine = 'On-Device PDF Text Extraction';
    bool isEncrypted = false;

    try {
      final local = await compute(_extractPdfTextWorker, pdfBytes);
      text = local.text;
      pageCount = local.pageCount;
      isEncrypted = local.isEncrypted;
    } catch (e) {
      debugPrint('[COR] Local PDF text extraction failed: $e');
    }

    if (isEncrypted) {
      return _buildFailure(
        term: term,
        isPdf: true,
        message:
            'This PDF is password-protected. Please upload an unlocked copy of your COR.',
      );
    }

    // 2/3. OCR fallback for scanned (image-only) PDFs
    if (_meaningfulCharCount(text) < _minMeaningfulChars) {
      onProgress?.call('Scanned PDF detected. Running OCR...');
      final ocr = await _ocrPdf(pdfBytes);
      if (_meaningfulCharCount(ocr.text) > _meaningfulCharCount(text)) {
        text = ocr.text;
        engine = ocr.engine;
      }
    }

    onProgress?.call('Verifying name, academic year & semester...');
    final result = evaluateCorText(
      rawText: text,
      expectedName: expectedName,
      targetTerm: term,
      engineUsed: engine,
      pageCount: pageCount,
    );

    // Only cache conclusive reads so a transient OCR outage can be retried.
    if (result.isReadable) _cache[cacheKey] = result;
    return result;
  }

  /// Pure validation of already-extracted COR text. Exposed for testing.
  static CorScanResult evaluateCorText({
    required String rawText,
    required String expectedName,
    required AcademicTerm targetTerm,
    String engineUsed = 'Unknown',
    int pageCount = 0,
  }) {
    if (expectedName.trim().isEmpty) {
      return _buildFailure(
        term: targetTerm,
        isPdf: true,
        pageCount: pageCount,
        rawText: rawText,
        engine: engineUsed,
        message:
            'Your registered student name could not be loaded. Please check your profile or internet connection and try again.',
      );
    }

    final text = rawText.trim();
    if (_meaningfulCharCount(text) < _minMeaningfulChars) {
      return _buildFailure(
        term: targetTerm,
        isPdf: true,
        pageCount: pageCount,
        rawText: rawText,
        engine: engineUsed,
        message:
            "We couldn't read your COR. Please upload the original PDF downloaded from the student portal, or a clear, high-resolution scan.",
      );
    }

    // Name (comma-aware + diacritic-tolerant)
    final nameRes = _verifyCorName(text, expectedName);

    // Academic year & semester (handles COR headers, label:value fields, and table cells)
    final rawYear = _extractCorAcademicYear(text);
    final rawSem = _extractCorSemester(text);
    final detectedYear = rawYear != null
        ? AcademicTermService.normalizeYear(rawYear)
        : null;
    final detectedSem = rawSem != null
        ? AcademicTermService.normalizeSemester(rawSem)
        : null;

    final yearMatches =
        detectedYear != null &&
        AcademicTermService.isYearMatching(
          detectedYear,
          targetTerm.academicYear,
        );
    final semMatches =
        detectedSem != null &&
        AcademicTermService.isSemesterMatching(
          detectedSem,
          targetTerm.semester,
        );

    final looksLikeCor = RegExp(
      r'CERTIFICATE\s+OF\s+REGISTRATION|\bC\.?O\.?R\.?\b|REGISTRATION|ENROLL|ASSESSMENT|SUBJECTS?|UNITS|COURSE\s*CODE|SCHEDULE',
      caseSensitive: false,
    ).hasMatch(text);

    final isValid = nameRes.matches && yearMatches && semMatches;

    final String message;
    if (isValid) {
      message =
          'COR verified! Name, academic year and semester match ${targetTerm.displayString}.';
    } else {
      final issues = <String>[];
      if (!nameRes.matches) {
        issues.add(
          'the name on the COR does not match your registered name ($expectedName)',
        );
      }
      if (!yearMatches) {
        issues.add(
          detectedYear == null
              ? 'the academic year could not be found'
              : 'the academic year ($detectedYear) is not the current academic year (${targetTerm.academicYear})',
        );
      }
      if (!semMatches) {
        issues.add(
          detectedSem == null
              ? 'the semester could not be found'
              : 'the semester ($detectedSem) is not the current semester (${targetTerm.semester})',
        );
      }
      final joined = issues.join('; ');
      message =
          'COR validation failed: ${joined[0].toUpperCase()}${joined.substring(1)}. '
          'Please upload your COR for ${targetTerm.displayString}.'
          '${looksLikeCor ? '' : ' This file may not be a Certificate of Registration.'}';
    }

    return CorScanResult(
      isValid: isValid,
      isPdf: true,
      isReadable: true,
      nameMatches: nameRes.matches,
      yearMatches: yearMatches,
      semesterMatches: semMatches,
      looksLikeCor: looksLikeCor,
      detectedName: (nameRes.detectedName?.trim().isNotEmpty ?? false)
          ? nameRes.detectedName
          : null,
      detectedAcademicYear: detectedYear,
      detectedSemester: detectedSem,
      targetTerm: targetTerm,
      pageCount: pageCount,
      rawExtractedText: rawText,
      engineUsed: engineUsed,
      message: message,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COR Name, Academic Year & Semester Parsers
  // ──────────────────────────────────────────────────────────────────────────

  static String _foldDiacritics(String input) {
    return input
        .replaceAll(RegExp(r'[Ññ]'), 'N')
        .replaceAll(RegExp(r'[ÁÀÂÄÃáàâäã]'), 'A')
        .replaceAll(RegExp(r'[ÉÈÊËéèêë]'), 'E')
        .replaceAll(RegExp(r'[ÍÌÎÏíìîï]'), 'I')
        .replaceAll(RegExp(r'[ÓÒÔÖÕóòôöõ]'), 'O')
        .replaceAll(RegExp(r'[ÚÙÛÜúùûü]'), 'U');
  }

  static List<String> _tokenizeNamePart(String part) {
    final cleaned = _foldDiacritics(part)
        .toUpperCase()
        .replaceAll(RegExp(r'[^A-Z0-9\s]'), ' ')
        .replaceAll(
          RegExp(r'\b(MR|MS|MRS|STUDENT|NAME|HON|DR|JR|SR|II|III|IV)\b'),
          ' ',
        )
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (cleaned.isEmpty) return const [];
    return cleaned.split(' ').where((t) => t.length > 1).toList();
  }

  /// Verifies that [expectedName] appears in [rawText], supporting both
  /// `"LASTNAME, FIRSTNAME MIDDLENAME"` and `"FIRSTNAME MIDDLENAME LASTNAME"`
  /// formats, abbreviated middle initials, compound surnames, and `"Ñ"`/accents.
  static ({bool matches, String? detectedName}) _verifyCorName(
    String rawText,
    String expectedName,
  ) {
    final foldedDoc = _foldDiacritics(rawText).toUpperCase();

    final bool hasComma = expectedName.contains(',');
    List<String> surnameTokens;
    List<String> givenTokens;
    List<String> allTokens;

    if (hasComma) {
      final commaIdx = expectedName.indexOf(',');
      surnameTokens = _tokenizeNamePart(expectedName.substring(0, commaIdx));
      givenTokens = _tokenizeNamePart(expectedName.substring(commaIdx + 1));
      allTokens = [...surnameTokens, ...givenTokens];
    } else {
      allTokens = _tokenizeNamePart(expectedName);
      if (allTokens.length >= 2) {
        givenTokens = [allTokens.first];
        surnameTokens = [allTokens.last];
      } else {
        givenTokens = allTokens;
        surnameTokens = allTokens;
      }
    }

    if (allTokens.isEmpty) {
      return (matches: false, detectedName: null);
    }

    bool tokenInDoc(String token) {
      if (RegExp(
        '\\b${RegExp.escape(token)}\\b',
        caseSensitive: false,
      ).hasMatch(foldedDoc)) {
        return true;
      }
      if (token.length >= 5 && foldedDoc.contains(token)) {
        return true;
      }
      return false;
    }

    final matchedTokens = allTokens.where(tokenInDoc).toList();
    final ratio = matchedTokens.length / allTokens.length;

    // Require BOTH the primary surname word AND the primary first-name word to match,
    // so a sibling's COR (sharing surname + middle name) cannot falsely pass.
    final String? primarySurname = surnameTokens.isNotEmpty
        ? surnameTokens.last
        : null;
    final String? primaryFirstName = givenTokens.isNotEmpty
        ? givenTokens.first
        : null;

    final bool surnameOk = primarySurname == null || tokenInDoc(primarySurname);
    final bool firstNameOk =
        primaryFirstName == null || tokenInDoc(primaryFirstName);

    final bool isMatch =
        surnameOk && firstNameOk && (ratio >= 0.60 || allTokens.length == 1);
    return (
      matches: isMatch,
      detectedName: matchedTokens.isEmpty ? null : matchedTokens.join(' '),
    );
  }

  /// Extracts the COR registration academic year while avoiding curriculum/batch years
  /// (e.g. `"Curriculum: BSIT 2023-2024"`).
  static String? _extractCorAcademicYear(String text) {
    final lines = text.split(RegExp(r'[\r\n]+'));
    final nonCurriculumLines = lines
        .where(
          (l) => !RegExp(
            r'\b(?:curriculum|curr\.?|batch)\b',
            caseSensitive: false,
          ).hasMatch(l),
        )
        .join('\n');

    if (nonCurriculumLines.trim().isNotEmpty) {
      final fromNonCurr = DocumentAIScannerService.extractAcademicYear(
        nonCurriculumLines,
      );
      if (fromNonCurr != null) return fromNonCurr;
    }
    return DocumentAIScannerService.extractAcademicYear(text);
  }

  /// Extracts the COR semester, covering standard phrases (`"1st Semester"`, `"First Sem"`)
  /// as well as COR label-value fields (`"Semester: 1st"`, `"Semester: First"`, `"Term: 2nd"`)
  /// and multi-line PDF table cells without confusing `"1st Year"`/`"2nd Year"` year levels.
  static String? _extractCorSemester(String text) {
    final direct = DocumentAIScannerService.extractSemester(text);
    if (direct != null) return direct;

    // Inline label:value patterns on COR headers/tables (e.g. "Semester: 1st", "Term : Second")
    if (RegExp(
      r'\b(?:sem(?:ester)?|term|period)\s*[:\-]\s*(?:2\s*nd|second|2|ii)\b(?!\s*year)',
      caseSensitive: false,
    ).hasMatch(text)) {
      return '2nd Semester';
    }
    if (RegExp(
      r'\b(?:sem(?:ester)?|term|period)\s*[:\-]\s*(?:1\s*st|first|1|i)\b(?!\s*year)',
      caseSensitive: false,
    ).hasMatch(text)) {
      return '1st Semester';
    }
    if (RegExp(
      r'\b(?:sem(?:ester)?|term|period)\s*[:\-]\s*(?:summer|mid\s*[\-]?\s*year)\b',
      caseSensitive: false,
    ).hasMatch(text)) {
      return 'Summer / Midyear';
    }

    // Multi-line table cell layout where "Semester" header is on one line and "1st"/"First" is on a nearby value line
    final lines = text
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    for (int i = 0; i < lines.length; i++) {
      if (RegExp(
        r'^(?:sem(?:ester)?|term)\s*:?$',
        caseSensitive: false,
      ).hasMatch(lines[i])) {
        for (int j = i + 1; j < lines.length && j <= i + 3; j++) {
          final cand = lines[j];
          if (RegExp(
            r'^(?:2\s*nd|second|2|ii)$',
            caseSensitive: false,
          ).hasMatch(cand)) {
            return '2nd Semester';
          }
          if (RegExp(
            r'^(?:1\s*st|first|1|i)$',
            caseSensitive: false,
          ).hasMatch(cand)) {
            return '1st Semester';
          }
          if (RegExp(
            r'^(?:summer|mid\s*[\-]?\s*year)$',
            caseSensitive: false,
          ).hasMatch(cand)) {
            return 'Summer / Midyear';
          }
        }
      }
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  static int _meaningfulCharCount(String text) =>
      RegExp(r'[A-Za-z0-9]').allMatches(text).length;

  static CorScanResult _buildFailure({
    required AcademicTerm term,
    required bool isPdf,
    required String message,
    int pageCount = 0,
    String rawText = '',
    String engine = 'none',
  }) {
    return CorScanResult(
      isValid: false,
      isPdf: isPdf,
      isReadable: false,
      nameMatches: false,
      yearMatches: false,
      semesterMatches: false,
      looksLikeCor: false,
      targetTerm: term,
      pageCount: pageCount,
      rawExtractedText: rawText,
      engineUsed: engine,
      message: message,
    );
  }

  /// OCR for image-only PDFs: backend proxy first, then direct OCR.space.
  static Future<({String text, String engine})> _ocrPdf(
    Uint8List pdfBytes,
  ) async {
    final base64Pdf = base64Encode(pdfBytes);

    try {
      final url = Uri.parse(
        '${DocumentAIScannerService.backendBaseUrl}/api/document-ai/scan-cor',
      );
      final res = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'pdf': base64Pdf}),
          )
          .timeout(const Duration(seconds: 30));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final text = (data['rawText'] ?? data['text'] ?? '').toString();
        if (data['success'] == true && text.trim().isNotEmpty) {
          return (
            text: text,
            engine: data['engine']?.toString() ?? 'ScholarDoc Server PDF OCR',
          );
        }
      }
    } catch (e) {
      debugPrint('[COR] Backend scan-cor proxy note: $e');
    }

    try {
      final uri = Uri.parse('https://api.ocr.space/parse/image');
      final request = http.MultipartRequest('POST', uri)
        ..headers['apikey'] = 'helloworld'
        ..headers['User-Agent'] = 'ScholarDoc/1.0'
        ..fields['language'] = 'eng'
        ..fields['OCREngine'] = '2'
        ..fields['scale'] = 'true'
        ..fields['detectOrientation'] = 'true'
        ..fields['filetype'] = 'PDF'
        ..files.add(
          http.MultipartFile.fromBytes('file', pdfBytes, filename: 'cor.pdf'),
        );

      final streamed = await request.send().timeout(
        const Duration(seconds: 30),
      );
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final results = data['ParsedResults'] as List?;
        if (results != null && results.isNotEmpty) {
          final text = results
              .map((r) => (r['ParsedText'] ?? '').toString().trim())
              .where((t) => t.isNotEmpty)
              .join('\n');
          if (text.isNotEmpty)
            return (text: text, engine: 'Direct PDF OCR Engine');
        }
      }
    } catch (e) {
      debugPrint('[COR] Direct OCR.space PDF note: $e');
    }

    return (text: '', engine: 'none');
  }
}

/// Top-level worker for [compute]: extracts digital text from a PDF.
({String text, int pageCount, bool isEncrypted}) _extractPdfTextWorker(
  Uint8List bytes,
) {
  PdfDocument? document;
  try {
    document = PdfDocument(inputBytes: bytes);
    final pageCount = document.pages.count;
    final text = PdfTextExtractor(document).extractText();
    return (text: text, pageCount: pageCount, isEncrypted: false);
  } catch (e) {
    final msg = e.toString().toLowerCase();
    final encrypted = msg.contains('password') || msg.contains('encrypt');
    return (text: '', pageCount: 0, isEncrypted: encrypted);
  } finally {
    document?.dispose();
  }
}
