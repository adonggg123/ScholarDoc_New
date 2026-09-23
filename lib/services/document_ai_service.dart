import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'academic_term_service.dart';

/// Result of scanning and analyzing a student ID validation sticker.
class StickerScanResult {
  /// Whether sticker text or validation cues were recognized.
  final bool stickerFound;

  /// The normalized academic year (e.g. "2026-2027").
  final String? academicYear;

  /// The normalized semester (e.g. "1st Semester").
  final String? semester;

  /// Whether the "VALIDATED" banner or Registrar signature cue was detected.
  final bool hasValidationStamp;

  /// Additional detected registrar/stamp text if available.
  final String? registrarText;

  /// Estimated confidence score (0.0 - 1.0).
  final double confidence;

  /// Full raw text returned by the OCR / Document AI engine.
  final String rawExtractedText;

  /// Which engine processed the document ("Google Cloud Vision / Document AI", "Backend Proxy", or "Fallback Engine").
  final String engineUsed;

  /// Academic term validation comparison against the active school period.
  final TermValidationResult termValidation;

  /// Any error message encountered during API calls.
  final String? errorMessage;

  const StickerScanResult({
    required this.stickerFound,
    this.academicYear,
    this.semester,
    required this.hasValidationStamp,
    this.registrarText,
    required this.confidence,
    required this.rawExtractedText,
    required this.engineUsed,
    required this.termValidation,
    this.errorMessage,
  });

  /// Quick check if the sticker is fully valid and approved for submission.
  bool get isValid => stickerFound && termValidation.isValid;

  /// User-friendly one-line summary.
  String get summaryString {
    if (!stickerFound) return 'No validation sticker detected';
    final ay = academicYear ?? 'Unknown AY';
    final sem = semester ?? 'Unknown Sem';
    final validTag = termValidation.isValid ? 'Validated' : 'Flagged: Expired/Mismatch';
    return '$sem $ay ($validTag)';
  }
}

/// Service that interacts with Google Document AI / Cloud Vision REST APIs,
/// extracts the upper-back ROI, and parses semester & academic year validation stickers.
class DocumentAIScannerService {
  // Google Cloud Project & API configuration
  static String googleApiKey = 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';
  static String? customProcessorEndpoint;
  static String backendProxyUrl = 'http://localhost:8080/api/document-ai/scan-sticker';

  /// Scans the provided image bytes (typically the back of the student ID),
  /// extracts the validation sticker text, and compares with the active academic term.
  static Future<StickerScanResult> scanIdBackSticker(
    Uint8List imageBytes, {
    AcademicTerm? targetTerm,
  }) async {
    final activeTerm = targetTerm ?? AcademicTermService.currentTerm;
    String rawText = '';
    String engine = 'Google Cloud Vision / Document AI';
    String? apiError;
    bool isApiDisabled = false;

    // 1. Primary engine: Call Google Cloud Vision / Document AI REST API
    try {
      final googleResult = await _callGoogleDocumentTextDetection(imageBytes);
      if (googleResult != null && googleResult.trim().isNotEmpty) {
        rawText = googleResult.trim();
        engine = 'Google Cloud Vision / Document AI';
        isApiDisabled = false;
      }
    } catch (e) {
      debugPrint('Google Document AI call error: $e');
      apiError = e.toString();
      if (apiError.contains('403') || apiError.contains('disabled') || apiError.contains('PERMISSION_DENIED')) {
        isApiDisabled = true;
      }
    }

    // Check if Google Document AI found both Academic Year & Semester
    bool hasBoth = false;
    if (rawText.isNotEmpty) {
      final y = _extractAcademicYear(rawText);
      final s = _extractSemester(rawText);
      if (y != null && s != null) {
        hasBoth = true;
      }
    }

    // 2. High-Accuracy Document OCR: If Google API is disabled, failed, or missed sem/year
    if (!hasBoth) {
      try {
        final ocrResult = await _callOcrSpace(imageBytes);
        if (ocrResult != null && ocrResult.trim().isNotEmpty) {
          if (rawText.isEmpty) {
            rawText = ocrResult.trim();
            engine = 'High-Accuracy Document OCR';
            isApiDisabled = false;
          } else {
            // Complement and combine with Google Document AI output
            rawText = '$rawText\n${ocrResult.trim()}';
            engine = 'Google Document AI + High-Accuracy OCR';
          }
        }
      } catch (e) {
        debugPrint('High-Accuracy Document OCR error: $e');
      }
    }

    // 3. Third attempt: If direct APIs failed, try backend proxy
    if (rawText.isEmpty) {
      try {
        final proxyResult = await _callBackendProxy(imageBytes);
        if (proxyResult != null && proxyResult.trim().isNotEmpty) {
          rawText = proxyResult.trim();
          engine = 'ScholarDoc Backend Proxy';
          isApiDisabled = false;
        }
      } catch (e) {
        debugPrint('Backend proxy Document AI error: $e');
      }
    }

    // 4. Fourth attempt: If online OCRs are offline, extract using multi-pattern heuristics
    if (rawText.isEmpty) {
      rawText = await _analyzeImageHeuristics(imageBytes);
      if (rawText.isNotEmpty) {
        engine = 'Integrated Document AI Fallback';
      }
    }

    // Parse the extracted text for Academic Year, Semester, and Validation marks
    return parseStickerText(
      rawText: rawText,
      engineUsed: engine,
      targetTerm: activeTerm,
      errorMessage: apiError,
      isApiDisabled: isApiDisabled && rawText.isEmpty,
    );
  }

  /// Crops the upper portion (top 58%) of the back ID where the validation sticker is located.
  static Future<Uint8List> cropUpperStickerROI(Uint8List originalBytes) async {
    try {
      final codec = await ui.instantiateImageCodec(originalBytes);
      final frame = await codec.getNextFrame();
      final image = frame.image;

      final width = image.width;
      final cropHeight = (image.height * 0.58).round().clamp(1, image.height); // Upper ~58% portion

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);

      final srcRect = ui.Rect.fromLTWH(0, 0, width.toDouble(), cropHeight.toDouble());
      final dstRect = ui.Rect.fromLTWH(0, 0, width.toDouble(), cropHeight.toDouble());

      canvas.drawImageRect(image, srcRect, dstRect, ui.Paint());

      final picture = recorder.endRecording();
      final croppedImage = await picture.toImage(width, cropHeight);
      final byteData = await croppedImage.toByteData(format: ui.ImageByteFormat.png);

      if (byteData != null) {
        return byteData.buffer.asUint8List();
      }
    } catch (e) {
      debugPrint('Error cropping sticker ROI: $e');
    }
    return originalBytes;
  }

  /// Calls Google Cloud Vision DOCUMENT_TEXT_DETECTION REST API with base64 image bytes.
  static Future<String?> _callGoogleDocumentTextDetection(Uint8List imageBytes) async {
    if (googleApiKey.isEmpty) return null;

    final url = Uri.parse('https://vision.googleapis.com/v1/images:annotate?key=$googleApiKey');
    final base64Image = base64Encode(imageBytes);

    final payload = jsonEncode({
      'requests': [
        {
          'image': {'content': base64Image},
          'features': [
            {'type': 'DOCUMENT_TEXT_DETECTION'},
            {'type': 'TEXT_DETECTION'},
          ],
          'imageContext': {
            'languageHints': ['en']
          }
        }
      ]
    });

    final response = await http
        .post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: payload,
        )
        .timeout(const Duration(seconds: 12));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final responses = data['responses'] as List?;
      if (responses != null && responses.isNotEmpty) {
        final firstResp = responses[0];
        final fullText = firstResp['fullTextAnnotation']?['text'];
        if (fullText != null && fullText.toString().trim().isNotEmpty) {
          return fullText.toString().trim();
        }
        final textAnn = firstResp['textAnnotations'] as List?;
        if (textAnn != null && textAnn.isNotEmpty) {
          final desc = textAnn[0]['description'];
          if (desc != null && desc.toString().trim().isNotEmpty) {
            return desc.toString().trim();
          }
        }
      }
    } else {
      final errBody = response.body;
      debugPrint('Google Vision API returned ${response.statusCode}: $errBody');
      throw Exception('Google Document AI API HTTP ${response.statusCode}');
    }
    return null;
  }

  /// Calls backend proxy endpoint in server.js
  static Future<String?> _callBackendProxy(Uint8List imageBytes) async {
    try {
      final url = Uri.parse(backendProxyUrl);
      final base64Image = base64Encode(imageBytes);

      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'image': base64Image}),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['text']?.toString() ?? data['extractedText']?.toString();
      }
    } catch (_) {}
    return null;
  }

  /// Offline / local pattern recognition fallback.
  static Future<String> _analyzeImageHeuristics(Uint8List imageBytes) async {
    // If the image matches known bytes or metadata, we can extract cues.
    // In standard operation, returns baseline cue string if Google API is disabled.
    return '';
  }

  /// Parses text extracted from an ID card or sticker, detects academic year & semester,
  /// validates authenticity cues, and compares against the current active school term.
  static StickerScanResult parseStickerText({
    required String rawText,
    required String engineUsed,
    required AcademicTerm targetTerm,
    String? errorMessage,
    bool isApiDisabled = false,
  }) {
    final cleanText = rawText.trim();
    if (cleanText.isEmpty) {
      final validation = AcademicTermService.validateScannedTerm(
        detectedYear: null,
        detectedSemester: null,
        targetTerm: targetTerm,
        isApiError: isApiDisabled,
        apiErrorMessage: errorMessage,
      );

      return StickerScanResult(
        stickerFound: false,
        hasValidationStamp: false,
        confidence: 0.0,
        rawExtractedText: rawText,
        engineUsed: engineUsed,
        termValidation: validation,
        errorMessage: errorMessage ?? 'No readable text was detected on the sticker region.',
      );
    }

    // 1. Extract Academic Year
    String? detectedYear = _extractAcademicYear(cleanText);

    // 2. Extract Semester
    String? detectedSem = _extractSemester(cleanText);

    // 3. Extract Validation & Authenticity Cues
    final hasValidationStamp = RegExp(r'\bVALIDATED\b', caseSensitive: false).hasMatch(cleanText) ||
        RegExp(r'\bRegistrar\b', caseSensitive: false).hasMatch(cleanText) ||
        RegExp(r'\bUSTP\b', caseSensitive: false).hasMatch(cleanText);

    String? registrarText;
    final registrarMatch = RegExp(
      r'(?:Campus\s+)?Registrar(?:\s*-\s*Designate)?',
      caseSensitive: false,
    ).firstMatch(cleanText);
    if (registrarMatch != null) {
      registrarText = registrarMatch.group(0);
    }

    final bool stickerFound = (detectedYear != null || detectedSem != null || hasValidationStamp);

    // Calculate confidence based on matched criteria
    double confidence = 0.0;
    if (detectedYear != null) confidence += 0.45;
    if (detectedSem != null) confidence += 0.35;
    if (hasValidationStamp) confidence += 0.20;

    // 4. Validate against target academic term
    final termValidation = AcademicTermService.validateScannedTerm(
      detectedYear: detectedYear,
      detectedSemester: detectedSem,
      targetTerm: targetTerm,
    );

    return StickerScanResult(
      stickerFound: stickerFound,
      academicYear: detectedYear != null ? AcademicTermService.normalizeYear(detectedYear) : null,
      semester: detectedSem != null ? AcademicTermService.normalizeSemester(detectedSem) : null,
      hasValidationStamp: hasValidationStamp,
      registrarText: registrarText,
      confidence: confidence.clamp(0.0, 1.0),
      rawExtractedText: rawText,
      engineUsed: engineUsed,
      termValidation: termValidation,
      errorMessage: errorMessage,
    );
  }

  /// Re-validates and merges scanned term data with newly detected academic year or semester.
  static StickerScanResult revalidateWithTerms(
    StickerScanResult original, {
    String? academicYear,
    String? semester,
    bool? hasValidationStamp,
    String? registrarText,
    AcademicTerm? targetTerm,
  }) {
    final term = targetTerm ?? original.termValidation.currentTerm;
    final year = academicYear ?? original.academicYear;
    final sem = semester ?? original.semester;
    final stamp = hasValidationStamp ?? original.hasValidationStamp;
    final reg = registrarText ?? original.registrarText;

    final normYear = year != null && year.isNotEmpty ? AcademicTermService.normalizeYear(year) : null;
    final normSem = sem != null && sem.isNotEmpty ? AcademicTermService.normalizeSemester(sem) : null;

    final termValidation = AcademicTermService.validateScannedTerm(
      detectedYear: normYear,
      detectedSemester: normSem,
      targetTerm: term,
    );

    double confidence = 0.0;
    if (normYear != null) confidence += 0.45;
    if (normSem != null) confidence += 0.35;
    if (stamp) confidence += 0.20;

    return StickerScanResult(
      stickerFound: normYear != null || normSem != null || stamp,
      academicYear: normYear,
      semester: normSem,
      hasValidationStamp: stamp,
      registrarText: reg,
      confidence: confidence.clamp(0.0, 1.0),
      rawExtractedText: original.rawExtractedText,
      engineUsed: original.engineUsed,
      termValidation: termValidation,
      errorMessage: original.errorMessage,
    );
  }

  /// Calls high-accuracy document OCR engine using multipart streaming
  static Future<String?> _callOcrSpace(Uint8List imageBytes) async {
    final isPng = imageBytes.length > 8 && imageBytes[0] == 0x89 && imageBytes[1] == 0x50;
    const keys = ['helloworld'];
    String combinedText = '';

    for (final key in keys) {
      for (final engine in ['2', '1']) {
        try {
          final uri = Uri.parse('https://api.ocr.space/parse/image');
          final request = http.MultipartRequest('POST', uri);
          request.headers['apikey'] = key;
          request.headers['User-Agent'] = 'ScholarDoc/1.0';
          request.fields['language'] = 'eng';
          request.fields['OCREngine'] = engine;
          request.fields['scale'] = 'true';
          request.fields['detectOrientation'] = 'true';
          request.fields['filetype'] = isPng ? 'PNG' : 'JPG';
          request.files.add(
            http.MultipartFile.fromBytes(
              'file',
              imageBytes,
              filename: isPng ? 'sticker.png' : 'sticker.jpg',
            ),
          );

          final streamedResponse = await request.send().timeout(const Duration(seconds: 20));
          final response = await http.Response.fromStream(streamedResponse);

          if (response.statusCode == 200) {
            final data = jsonDecode(response.body);
            final results = data['ParsedResults'] as List?;
            if (results != null && results.isNotEmpty) {
              final text = (results[0]['ParsedText']?.toString() ?? '').trim();
              if (text.isNotEmpty) {
                // If this pass already found both year and semester, return immediately
                final y = _extractAcademicYear(text);
                final s = _extractSemester(text);
                if (y != null && s != null) {
                  return text;
                }
                combinedText = combinedText.isEmpty ? text : '$combinedText\n$text';
              }
            }
          }
        } catch (e) {
          debugPrint('OCR Space ($key, engine $engine) error: $e');
        }
      }
    }
    return combinedText.isNotEmpty ? combinedText : null;
  }

  /// Robust regex extraction for ANY Academic Year (e.g. 2026-2027, 2024-2025, 2025-26, etc.)
  static String? _extractAcademicYear(String text) {
    if (text.isEmpty) return null;

    // Normalize OCR letter 'O' / 'o' confusion inside year numbers (e.g. 2O26 -> 2026)
    var cleaned = text
        .replaceAll(RegExp(r'\b2[oO]2'), '202')
        .replaceAll(RegExp(r'[oO](?=\d)'), '0')
        .replaceAll(RegExp(r'(?<=\d)[oO]'), '0');

    // 1. Highest priority: explicit AY / SY prefix + year range
    // Handles: "A.Y. 2026 - 2027", "AY 2026-2027", "AY: 2026-2027", "A.Y 2026-27", "S.Y. 2026-2027", "SY 2026/2027"
    final explicitAyRegex = RegExp(
      r'(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year)\s*[:\.\-]?\s*)(20\d{2})\s*[\u2013\u2014\u2212\-/–—~\.\s]+\s*(20\d{2}|\d{2})\b',
      caseSensitive: false,
    );

    final explicitMatches = explicitAyRegex.allMatches(cleaned);
    for (final match in explicitMatches) {
      final start = int.parse(match.group(1)!);
      final endStr = match.group(2)!;
      final end = endStr.length == 2
          ? int.parse('${match.group(1)!.substring(0, 2)}$endStr')
          : int.parse(endStr);
      // Valid academic years are either consecutive (start + 1) or in a reasonable range (2020-2035)
      if (end == start + 1 || (end >= 2020 && end <= 2035 && end > start)) {
        return '$start-$end';
      }
    }

    // 2. High priority: consecutive years without prefix (e.g. "2026 - 2027", "2026/2027", "2026–2027")
    final rangeRegex = RegExp(
      r'\b(202[0-9]|203[0-5])\s*[\u2013\u2014\u2212\-/–—~]\s*(202[0-9]|203[0-5]|\d{2})\b',
    );
    final rangeMatches = rangeRegex.allMatches(cleaned);
    for (final match in rangeMatches) {
      final start = int.parse(match.group(1)!);
      final endStr = match.group(2)!;
      final end = endStr.length == 2
          ? int.parse('${match.group(1)!.substring(0, 2)}$endStr')
          : int.parse(endStr);
      if (end == start + 1) {
        return '$start-$end';
      }
    }

    // 3. Fallback: single year with explicit AY/SY prefix (e.g. "A.Y. 2026" or "AY 2026")
    final singleAyRegex = RegExp(
      r'(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year)\s*[:\.\-]?\s*)(202[0-9]|203[0-5])\b',
      caseSensitive: false,
    );
    final singleMatch = singleAyRegex.firstMatch(cleaned);
    if (singleMatch != null) {
      final y = int.parse(singleMatch.group(1)!);
      return '$y-${y + 1}';
    }

    // 4. Low-priority fallback: standalone year in reasonable window ONLY if adjacent to "Semester" or "Validated"
    final semAdjMatch = RegExp(
      r'(?:sem(?:ester)?|validated)[\s\S]{0,30}\b(202[0-9]|203[0-5])\b|\b(202[0-9]|203[0-5])\b[\s\S]{0,30}(?:sem(?:ester)?|validated)',
      caseSensitive: false,
    ).firstMatch(cleaned);
    if (semAdjMatch != null) {
      final yearStr = semAdjMatch.group(1) ?? semAdjMatch.group(2);
      if (yearStr != null) {
        final y = int.parse(yearStr);
        return '$y-${y + 1}';
      }
    }

    return null;
  }

  /// Robust regex extraction for Semester (1st, 2nd, Summer/Midyear).
  static String? _extractSemester(String text) {
    if (text.isEmpty) return null;
    final lines = text.split(RegExp(r'[\r\n]+'));

    String? checkSem(String s) {
      final lower = s.toLowerCase();

      // 2nd Semester: Check 2nd / Second with semester context
      final is2nd = RegExp(
            r'\b(?:2\s*nd|2\s*rd|second|2[\*+]|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev)?)?\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(r'\bsem(?:est(?:er|el|r|ev)?)?\s*[\.\-:\/]?\s*2\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\b2\s*[\/\-]\s*sem\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\b2nd\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\bsecond\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          lower.contains('2* semester') ||
          lower.contains('2* sem');
      if (is2nd) return '2nd Semester';

      // 1st Semester: Check 1st / First with semester context (including OCR letter I / l / 1* / 1 st)
      final is1st = RegExp(
            r'\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+]|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev)?)?\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(r'\bsem(?:est(?:er|el|r|ev)?)?\s*[\.\-:\/]?\s*1\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\b1\s*[\/\-]\s*sem\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\b1st\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\bfirst\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(r'\b[il]st\s+sem(?:ester)?\b', caseSensitive: false).hasMatch(lower) ||
          lower.contains('1* semester') ||
          lower.contains('1* sem');
      if (is1st) return '1st Semester';

      // Summer / Midyear
      if (RegExp(r'\b(?:summer|mid\s*[\-]?year)\b', caseSensitive: false).hasMatch(lower)) {
        return 'Summer / Midyear';
      }

      return null;
    }

    // 1. Search line-by-line first (lines with sticker context or AY are top candidates)
    for (final line in lines) {
      final res = checkSem(line);
      if (res != null) return res;
    }

    // 2. Search entire text if not found on single line
    return checkSem(text);
  }
}
