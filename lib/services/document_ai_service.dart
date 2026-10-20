import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:crypto/crypto.dart' as crypto;
import 'package:image/image.dart' as img;
import 'academic_term_service.dart';
import '../config/api_config.dart';

/// Result of scanning and analyzing a student ID validation sticker and birthdate on the back of ID.
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

  /// Extracted birthdate string (e.g. "10/24/2003") if detected on back of ID.
  final String? birthdate;

  /// Whether detected birthdate matches registered profile birthdate.
  final bool birthdateMatches;

  /// Estimated confidence score (0.0 - 1.0).
  final double confidence;

  /// Full raw text returned by the OCR / Document AI engine.
  final String rawExtractedText;

  /// Which engine processed the document.
  final String engineUsed;

  /// Academic term validation comparison against the active school period.
  final TermValidationResult termValidation;

  /// Any feedback or error message encountered.
  final String? errorMessage;

  const StickerScanResult({
    required this.stickerFound,
    this.academicYear,
    this.semester,
    required this.hasValidationStamp,
    this.registrarText,
    this.birthdate,
    this.birthdateMatches = true,
    required this.confidence,
    required this.rawExtractedText,
    required this.engineUsed,
    required this.termValidation,
    this.errorMessage,
  });

  /// Quick check if the sticker is fully valid and approved for submission.
  bool get isValid =>
      stickerFound && termValidation.isValid && birthdateMatches;

  /// User-friendly one-line summary.
  String get summaryString {
    if (!stickerFound) return 'No validation sticker detected';
    final ay = academicYear ?? 'Unknown AY';
    final sem = semester ?? 'Unknown Sem';
    final bdateTag = birthdate != null ? ' • DOB: $birthdate' : '';
    final validTag = isValid ? 'Validated' : 'Flagged';
    return '$sem $ay$bdateTag ($validTag)';
  }

  StickerScanResult copyWith({
    bool? stickerFound,
    String? academicYear,
    String? semester,
    bool? hasValidationStamp,
    String? registrarText,
    String? birthdate,
    bool? birthdateMatches,
    double? confidence,
    String? rawExtractedText,
    String? engineUsed,
    TermValidationResult? termValidation,
    String? errorMessage,
  }) {
    return StickerScanResult(
      stickerFound: stickerFound ?? this.stickerFound,
      academicYear: academicYear ?? this.academicYear,
      semester: semester ?? this.semester,
      hasValidationStamp: hasValidationStamp ?? this.hasValidationStamp,
      registrarText: registrarText ?? this.registrarText,
      birthdate: birthdate ?? this.birthdate,
      birthdateMatches: birthdateMatches ?? this.birthdateMatches,
      confidence: confidence ?? this.confidence,
      rawExtractedText: rawExtractedText ?? this.rawExtractedText,
      engineUsed: engineUsed ?? this.engineUsed,
      termValidation: termValidation ?? this.termValidation,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

/// Result of scanning and analyzing the Front of Student ID for Full Name verification.
class FrontIdScanResult {
  final bool nameMatches;
  final String? detectedName;
  final double confidence;
  final String rawExtractedText;
  final String engineUsed;
  final String message;
  final String? errorMessage;

  const FrontIdScanResult({
    required this.nameMatches,
    this.detectedName,
    required this.confidence,
    required this.rawExtractedText,
    required this.engineUsed,
    required this.message,
    this.errorMessage,
  });

  bool get isValid => nameMatches && confidence >= 0.50;
  bool get isNameMatch => nameMatches;
  String? get extractedName => detectedName;
  bool get isReadable => rawExtractedText.trim().isNotEmpty;
}

/// Result of scanning and analyzing Landbank ATM Proof for Account Holder & SA Number verification.
class AtmProofScanResult {
  final bool isValid;
  final bool saMatches;
  final bool nameMatches;
  final String? detectedSaNumber;
  final String? detectedName;
  final String rawExtractedText;
  final String engineUsed;
  final String message;
  final String? errorMessage;

  const AtmProofScanResult({
    required this.isValid,
    required this.saMatches,
    required this.nameMatches,
    this.detectedSaNumber,
    this.detectedName,
    required this.rawExtractedText,
    required this.engineUsed,
    required this.message,
    this.errorMessage,
  });

  String? get accountName => detectedName;
  String? get saNumber => detectedSaNumber;
}

/// Service that interacts with Google Document AI / Cloud Vision REST APIs and backend proxy
/// to validate Front ID names, Back ID validation stickers & birthdates, and ATM proof account details.
class DocumentAIScannerService {
  // Google Cloud Project & API configuration
  static String googleApiKey = 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';

  // In-memory Client-Side Caches for instant (0ms) repeat access
  static final Map<String, FrontIdScanResult> _frontIdCache = {};
  static final Map<String, StickerScanResult> _backStickerCache = {};
  static final Map<String, AtmProofScanResult> _atmProofCache = {};
  static final Map<String, String> _extractedTextCache = {};

  /// Clears all in-memory scan caches (e.g. on logout or user switch)
  static void clearScanCaches() {
    _frontIdCache.clear();
    _backStickerCache.clear();
    _atmProofCache.clear();
    _extractedTextCache.clear();
  }

  /// Fast SHA-256 content fingerprinting of image bytes
  static String computeImageHash(Uint8List bytes) {
    return crypto.sha256.convert(bytes).toString();
  }

  /// Downscales high-resolution camera images in a background isolate to an optimal OCR size (max 1280px)
  /// and JPEG quality 85%. Reduces network payload by ~90-95% without compromising text legibility.
  static Future<Uint8List> optimizeImageForOcr(Uint8List originalBytes) async {
    try {
      return await compute(_optimizeImageWorker, originalBytes);
    } catch (e) {
      debugPrint('Error optimizing image for OCR, using original: $e');
      return originalBytes;
    }
  }

  static Uint8List _optimizeImageWorker(Uint8List bytes) {
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded == null) return bytes;

      final oriented = img.bakeOrientation(decoded);
      const int maxDimension = 1280;
      img.Image processed = oriented;

      if (oriented.width > maxDimension || oriented.height > maxDimension) {
        if (oriented.width >= oriented.height) {
          processed = img.copyResize(oriented, width: maxDimension);
        } else {
          processed = img.copyResize(oriented, height: maxDimension);
        }
      }

      // Slightly enhance contrast and brightness for better text readability on glossy ID stickers
      processed = img.adjustColor(processed, contrast: 1.15, brightness: 1.02);

      return Uint8List.fromList(img.encodeJpg(processed, quality: 85));
    } catch (_) {
      return bytes;
    }
  }

  /// Resolves the backend proxy base URL across Web, Android emulator, and desktop
  static String get backendBaseUrl => ApiConfig.baseUrl;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FRONT ID SCANNING — Name Verification
  // ──────────────────────────────────────────────────────────────────────────
  static Future<FrontIdScanResult> scanIdFrontName(
    Uint8List imageBytes, {
    required String expectedName,
    void Function(String status)? onProgress,
  }) async {
    final normName = expectedName.trim().toUpperCase();
    final imgHash = computeImageHash(imageBytes);
    final cacheKey = '$imgHash:$normName';

    // 1. Check in-memory client cache
    if (_frontIdCache.containsKey(cacheKey)) {
      debugPrint('[DocumentAI Cache Hit] Front ID: $normName');
      return _frontIdCache[cacheKey]!;
    }

    onProgress?.call('Optimizing image for fast OCR...');
    final optimizedBytes = await optimizeImageForOcr(imageBytes);
    final base64Img = base64Encode(optimizedBytes);

    // 2. Try Backend Proxy first (fast 8s timeout)
    onProgress?.call('Analyzing Document AI text...');
    try {
      final url = Uri.parse('$backendBaseUrl/api/document-ai/scan-front-id');
      final res = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'image': base64Img,
              'expectedName': expectedName,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          final result = FrontIdScanResult(
            nameMatches: data['nameMatches'] == true,
            detectedName: data['detectedName']?.toString(),
            confidence: (data['confidence'] as num?)?.toDouble() ?? 0.85,
            rawExtractedText: data['rawText']?.toString() ?? '',
            engineUsed:
                data['engine']?.toString() ?? 'ScholarDoc Server Document AI',
            message:
                data['message']?.toString() ?? 'Name verified successfully.',
          );
          _frontIdCache[cacheKey] = result;
          return result;
        }
      }
    } catch (e) {
      debugPrint('Backend front-id proxy note: $e');
    }

    // 3. Direct Google Cloud Vision / OCR fallback
    onProgress?.call('Verifying identity...');
    final rawText = await extractDocumentText(optimizedBytes);
    final localResult = verifyNameLocally(rawText, expectedName);

    final result = FrontIdScanResult(
      nameMatches: localResult.matches,
      detectedName: localResult.detectedName,
      confidence: localResult.confidence,
      rawExtractedText: rawText,
      engineUsed: 'Direct Document OCR Engine',
      message: localResult.message,
    );
    _frontIdCache[cacheKey] = result;
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. BACK ID SCANNING — High-Accuracy Document OCR (AY, Semester, Birthdate)
  // ──────────────────────────────────────────────────────────────────────────
  static Future<StickerScanResult> scanIdBackSticker(
    Uint8List imageBytes, {
    AcademicTerm? targetTerm,
    String? expectedBirthdate,
    void Function(String status)? onProgress,
  }) async {
    final activeTerm = targetTerm ?? AcademicTermService.currentTerm;
    final imgHash = computeImageHash(imageBytes);
    final cacheKey =
        '$imgHash:${activeTerm.academicYear}:${activeTerm.semester}:${expectedBirthdate ?? ""}';

    // 1. Check in-memory client cache
    if (_backStickerCache.containsKey(cacheKey)) {
      debugPrint('[DocumentOCR Cache Hit] Back ID sticker');
      return _backStickerCache[cacheKey]!;
    }

    onProgress?.call('Optimizing sticker image for OCR...');
    final optimizedBytes = await optimizeImageForOcr(imageBytes);
    final base64Img = base64Encode(optimizedBytes);

    // 2. Try Backend High-Accuracy OCR Proxy first (fast 8s timeout)
    onProgress?.call('Scanning sticker with Document OCR...');
    try {
      final url = Uri.parse('$backendBaseUrl/api/document-ai/scan-back-id');
      final res = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'image': base64Img,
              'expectedBirthdate': expectedBirthdate,
              'academicYear': activeTerm.academicYear,
              'semester': activeTerm.semester,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          final year = data['academicYear']?.toString();
          final sem = data['semester']?.toString();
          final bdate = data['birthdate']?.toString();
          final rawBdateMatches = data['birthdateMatches'] == true;
          // If no birthdate was detected on the ID back, it is NOT a birthdate mismatch!
          final bdateMatches = (bdate == null || bdate.trim().isEmpty)
              ? true
              : rawBdateMatches;

          final termValidation = AcademicTermService.validateScannedTerm(
            detectedYear: year,
            detectedSemester: sem,
            targetTerm: activeTerm,
          );

          final isValid =
              data['stickerFound'] == true &&
              termValidation.isValid &&
              bdateMatches;
          final errorMessage = isValid
              ? null
              : (!termValidation.isValid
                    ? termValidation.message
                    : (!bdateMatches
                          ? 'The birthdate on your school ID does not match your registered information. Please check your ID and try again.'
                          : data['message']?.toString()));

          debugPrint(
            '[Document OCR Scan] Back ID: AY=$year, Sem=$sem | Valid=$isValid (Term=${termValidation.isValid}, DOB=$bdateMatches)',
          );

          final result = StickerScanResult(
            stickerFound: data['stickerFound'] == true,
            academicYear: year != null
                ? AcademicTermService.normalizeYear(year)
                : null,
            semester: sem != null
                ? AcademicTermService.normalizeSemester(sem)
                : null,
            hasValidationStamp: data['hasValidationStamp'] == true,
            birthdate: bdate,
            birthdateMatches: bdateMatches,
            confidence: 0.92,
            rawExtractedText: data['rawText']?.toString() ?? '',
            engineUsed:
                data['engine']?.toString() ?? 'High-Accuracy Document OCR',
            termValidation: termValidation,
            errorMessage: errorMessage,
          );
          _backStickerCache[cacheKey] = result;
          return result;
        }
      }
    } catch (e) {
      debugPrint('Backend back-id OCR proxy note: $e');
    }

    // 3. Direct High-Accuracy OCR extraction fallback
    onProgress?.call('Verifying academic year & semester with OCR...');
    final rawText = await extractDocumentText(optimizedBytes);
    final result = parseStickerText(
      rawText: rawText,
      engineUsed: 'High-Accuracy Document OCR',
      targetTerm: activeTerm,
      expectedBirthdate: expectedBirthdate,
    );
    _backStickerCache[cacheKey] = result;
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ATM PROOF SCANNING — Account Holder & SA Number Verification
  // ──────────────────────────────────────────────────────────────────────────
  static Future<AtmProofScanResult> scanAtmProof(
    Uint8List imageBytes, {
    required String expectedName,
    required String expectedSaNumber,
    void Function(String status)? onProgress,
  }) async {
    final imgHash = computeImageHash(imageBytes);
    final cacheKey =
        '$imgHash:${expectedName.trim().toUpperCase()}:${expectedSaNumber.trim()}';

    // 1. Check in-memory client cache
    if (_atmProofCache.containsKey(cacheKey)) {
      debugPrint('[DocumentAI Cache Hit] ATM Proof');
      return _atmProofCache[cacheKey]!;
    }

    onProgress?.call('Optimizing image for fast OCR...');
    final optimizedBytes = await optimizeImageForOcr(imageBytes);
    final base64Img = base64Encode(optimizedBytes);

    // 2. Try Backend Proxy first (fast 8s timeout)
    onProgress?.call('Scanning Account Name and SA Number...');
    try {
      final url = Uri.parse('$backendBaseUrl/api/document-ai/scan-atm-proof');
      final res = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'image': base64Img,
              'expectedName': expectedName,
              'expectedSaNumber': expectedSaNumber,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          final result = AtmProofScanResult(
            isValid: data['isValid'] == true,
            saMatches: data['saMatches'] == true,
            nameMatches: data['nameMatches'] == true,
            detectedSaNumber: data['detectedSaNumber']?.toString(),
            detectedName: data['detectedName']?.toString(),
            rawExtractedText: data['rawText']?.toString() ?? '',
            engineUsed:
                data['engine']?.toString() ?? 'ScholarDoc Server Document AI',
            message:
                data['message']?.toString() ??
                'ATM Proof verified successfully.',
          );
          _atmProofCache[cacheKey] = result;
          return result;
        }
      }
    } catch (e) {
      debugPrint('Backend atm-proof proxy note: $e');
    }

    // 3. Direct extraction fallback
    onProgress?.call('Verifying Landbank account records...');
    final rawText = await extractDocumentText(optimizedBytes);
    final localResult = verifyAtmLocally(
      rawText,
      expectedName,
      expectedSaNumber,
    );

    final result = AtmProofScanResult(
      isValid: localResult.isValid,
      saMatches: localResult.saMatches,
      nameMatches: localResult.nameMatches,
      detectedSaNumber: localResult.detectedSaNumber,
      detectedName: localResult.detectedName,
      rawExtractedText: rawText,
      engineUsed: 'Direct Document OCR Engine',
      message: localResult.message,
    );
    _atmProofCache[cacheKey] = result;
    return result;
  }

  /// Centralized High-Accuracy OCR text extraction using backend proxy and OCR Space engines
  static Future<String> extractDocumentText(Uint8List imageBytes) async {
    final imgHash = computeImageHash(imageBytes);
    if (_extractedTextCache.containsKey(imgHash)) {
      return _extractedTextCache[imgHash]!;
    }

    final optimizedBytes = await optimizeImageForOcr(imageBytes);
    String rawText = '';

    // 1. Backend proxy OCR (fast 5s timeout)
    try {
      final proxyResult = await _callBackendProxy(optimizedBytes);
      if (proxyResult != null && proxyResult.trim().isNotEmpty) {
        rawText = proxyResult.trim();
      }
    } catch (_) {}

    // 2. Direct OCR Space High-Accuracy API fallback (7s timeout)
    if (rawText.isEmpty) {
      try {
        final ocrResult = await _callOcrSpace(optimizedBytes);
        if (ocrResult != null && ocrResult.trim().isNotEmpty) {
          rawText = ocrResult.trim();
        }
      } catch (e) {
        debugPrint('OCR Space direct call note: $e');
      }
    }

    if (rawText.isNotEmpty) {
      _extractedTextCache[imgHash] = rawText;
    }
    return rawText;
  }

  /// Crops the upper portion (top 58%) of the back ID where the validation sticker is located.
  static Future<Uint8List> cropUpperStickerROI(Uint8List originalBytes) async {
    // 1. Try package:image for cross-platform rotation handling and contrast boost
    try {
      final decoded = img.decodeImage(originalBytes);
      if (decoded != null) {
        final oriented = img.bakeOrientation(decoded);
        final width = oriented.width;
        final cropHeight = (oriented.height * 0.60).round().clamp(
          1,
          oriented.height,
        );
        var cropped = img.copyCrop(
          oriented,
          x: 0,
          y: 0,
          width: width,
          height: cropHeight,
        );
        cropped = img.adjustColor(cropped, contrast: 1.25, brightness: 1.05);
        return Uint8List.fromList(img.encodeJpg(cropped, quality: 90));
      }
    } catch (_) {}

    // 2. Fallback to dart:ui canvas
    try {
      final codec = await ui.instantiateImageCodec(originalBytes);
      final frame = await codec.getNextFrame();
      final image = frame.image;

      final width = image.width;
      final cropHeight = (image.height * 0.60).round().clamp(1, image.height);

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);

      final srcRect = ui.Rect.fromLTWH(
        0,
        0,
        width.toDouble(),
        cropHeight.toDouble(),
      );
      final dstRect = ui.Rect.fromLTWH(
        0,
        0,
        width.toDouble(),
        cropHeight.toDouble(),
      );

      canvas.drawImageRect(image, srcRect, dstRect, ui.Paint());

      final picture = recorder.endRecording();
      final croppedImage = await picture.toImage(width, cropHeight);
      final byteData = await croppedImage.toByteData(
        format: ui.ImageByteFormat.png,
      );

      if (byteData != null) {
        return byteData.buffer.asUint8List();
      }
    } catch (e) {
      debugPrint('Error cropping sticker ROI: $e');
    }
    return originalBytes;
  }

  /// Calls backend proxy endpoint in server.js
  static Future<String?> _callBackendProxy(Uint8List imageBytes) async {
    try {
      final url = Uri.parse('$backendBaseUrl/api/document-ai/scan-sticker');
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
        return data['text']?.toString() ??
            data['extractedText']?.toString() ??
            data['rawText']?.toString();
      }
    } catch (_) {}
    return null;
  }

  /// Calls high-accuracy document OCR engine using multipart streaming
  static Future<String?> _callOcrSpace(Uint8List imageBytes) async {
    final isPng =
        imageBytes.length > 8 && imageBytes[0] == 0x89 && imageBytes[1] == 0x50;
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
              filename: isPng ? 'document.png' : 'document.jpg',
            ),
          );

          final streamedResponse = await request.send().timeout(
            const Duration(seconds: 15),
          );
          final response = await http.Response.fromStream(streamedResponse);

          if (response.statusCode == 200) {
            final data = jsonDecode(response.body);
            final results = data['ParsedResults'] as List?;
            if (results != null && results.isNotEmpty) {
              final text = (results[0]['ParsedText']?.toString() ?? '').trim();
              if (text.isNotEmpty) {
                combinedText = combinedText.isEmpty
                    ? text
                    : '$combinedText\n$text';
              }
            }
          }
        } catch (e) {
          debugPrint('OCR Space error: $e');
        }
      }
    }
    return combinedText.isNotEmpty ? combinedText : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PARSING & LOCAL VERIFICATION HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /// Parses text extracted from an ID card or sticker, detects academic year & semester,
  /// validates authenticity cues, checks birthdate, and compares against the current active school term.
  static StickerScanResult parseStickerText({
    required String rawText,
    required String engineUsed,
    required AcademicTerm targetTerm,
    String? expectedBirthdate,
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
        errorMessage:
            errorMessage ??
            "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible.",
      );
    }

    // 1. Extract Academic Year
    final detectedYear = _extractAcademicYear(cleanText);

    // 2. Extract Semester
    final detectedSem = _extractSemester(cleanText);

    // 3. Extract Birthdate
    final bdateResult = verifyBirthdateLocally(cleanText, expectedBirthdate);

    // 4. Extract Validation & Authenticity Cues (resilient to spacing & OCR variations)
    final hasValidationStamp =
        RegExp(
          r'\b(?:VALIDATED|VALID|VALIDO|VALIDATION|ENROLLED)\b',
          caseSensitive: false,
        ).hasMatch(cleanText) ||
        RegExp(
          r'\b(?:Campus\s+)?Registrar\b',
          caseSensitive: false,
        ).hasMatch(cleanText) ||
        RegExp(
          r'\b(?:USTP|UST\s*P|U\.S\.T\.P\.)\b',
          caseSensitive: false,
        ).hasMatch(cleanText);

    String? registrarText;
    final registrarMatch = RegExp(
      r'(?:Campus\s+)?Registrar(?:\s*-\s*Designate)?',
      caseSensitive: false,
    ).firstMatch(cleanText);
    if (registrarMatch != null) {
      registrarText = registrarMatch.group(0);
    }

    final bool stickerFound =
        (detectedYear != null || detectedSem != null || hasValidationStamp);

    double confidence = 0.0;
    if (detectedYear != null) confidence += 0.40;
    if (detectedSem != null) confidence += 0.35;
    if (hasValidationStamp) confidence += 0.15;
    if (bdateResult.matches) confidence += 0.10;

    // Validate against target academic term
    final termValidation = AcademicTermService.validateScannedTerm(
      detectedYear: detectedYear,
      detectedSemester: detectedSem,
      targetTerm: targetTerm,
    );

    final isValid =
        stickerFound && termValidation.isValid && bdateResult.matches;
    final finalErrorMessage = isValid
        ? null
        : (!termValidation.isValid
              ? termValidation.message
              : (!bdateResult.matches && bdateResult.detectedDate != null
                    ? bdateResult.message
                    : errorMessage));

    debugPrint(
      '[Document AI Parse] AY=$detectedYear, Sem=$detectedSem | Valid=$isValid',
    );

    return StickerScanResult(
      stickerFound: stickerFound,
      academicYear: detectedYear != null
          ? AcademicTermService.normalizeYear(detectedYear)
          : null,
      semester: detectedSem != null
          ? AcademicTermService.normalizeSemester(detectedSem)
          : null,
      hasValidationStamp: hasValidationStamp,
      registrarText: registrarText,
      birthdate: bdateResult.detectedDate,
      birthdateMatches: bdateResult.matches,
      confidence: confidence.clamp(0.0, 1.0),
      rawExtractedText: rawText,
      engineUsed: engineUsed,
      termValidation: termValidation,
      errorMessage: finalErrorMessage,
    );
  }

  /// Re-validates and merges scanned term data with newly detected academic year, semester, or birthdate.
  static StickerScanResult revalidateWithTerms(
    StickerScanResult original, {
    String? academicYear,
    String? semester,
    bool? hasValidationStamp,
    String? registrarText,
    String? birthdate,
    bool? birthdateMatches,
    AcademicTerm? targetTerm,
  }) {
    final term = targetTerm ?? original.termValidation.currentTerm;
    final year = academicYear ?? original.academicYear;
    final sem = semester ?? original.semester;
    final stamp = hasValidationStamp ?? original.hasValidationStamp;
    final reg = registrarText ?? original.registrarText;
    final bdate = birthdate ?? original.birthdate;
    final bdateMatch = birthdateMatches ?? original.birthdateMatches;

    final normYear = year != null && year.isNotEmpty
        ? AcademicTermService.normalizeYear(year)
        : null;
    final normSem = sem != null && sem.isNotEmpty
        ? AcademicTermService.normalizeSemester(sem)
        : null;

    final termValidation = AcademicTermService.validateScannedTerm(
      detectedYear: normYear,
      detectedSemester: normSem,
      targetTerm: term,
    );

    final isValid =
        (normYear != null || normSem != null || stamp) &&
        termValidation.isValid &&
        bdateMatch;

    return StickerScanResult(
      stickerFound: normYear != null || normSem != null || stamp,
      academicYear: normYear,
      semester: normSem,
      hasValidationStamp: stamp,
      registrarText: reg,
      birthdate: bdate,
      birthdateMatches: bdateMatch,
      confidence: original.confidence,
      rawExtractedText: original.rawExtractedText,
      engineUsed: original.engineUsed,
      termValidation: termValidation,
      errorMessage: isValid
          ? null
          : (termValidation.isValid
                ? original.errorMessage
                : termValidation.message),
    );
  }

  /// Verifies expected name in OCR text locally
  static ({
    bool matches,
    String? detectedName,
    double confidence,
    String message,
  })
  verifyNameLocally(String rawText, String expectedName) {
    final raw = rawText.toUpperCase();
    final expClean = normalizeNameString(expectedName);
    if (expClean.isEmpty) {
      return (
        matches: true,
        detectedName: expectedName,
        confidence: 1.0,
        message: 'Name verified.',
      );
    }
    if (raw.trim().isEmpty) {
      return (
        matches: false,
        detectedName: null,
        confidence: 0.0,
        message:
            "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible.",
      );
    }

    if (raw.contains(expClean)) {
      return (
        matches: true,
        detectedName: expectedName,
        confidence: 0.98,
        message: 'The name on your school ID matches your registered profile.',
      );
    }

    final expTokens = expClean.split(' ').where((t) => t.length > 1).toList();
    if (expTokens.isEmpty) {
      return (
        matches: true,
        detectedName: expectedName,
        confidence: 1.0,
        message: 'Name verified.',
      );
    }

    final surname = expTokens.last;
    final firstName = expTokens.first;

    final matchedTokens = expTokens.where((token) {
      if (RegExp('\\b$token\\b', caseSensitive: false).hasMatch(raw))
        return true;
      if (token.length >= 4 && raw.contains(token)) return true;
      return false;
    }).toList();

    final tokenRatio = matchedTokens.length / expTokens.length;

    final hasFirstAndLast =
        (raw.contains(firstName) || matchedTokens.contains(firstName)) &&
        (raw.contains(surname) || matchedTokens.contains(surname));

    final isMatch =
        (tokenRatio >= 0.60 && (hasFirstAndLast || expTokens.length <= 2));

    return (
      matches: isMatch,
      detectedName: matchedTokens.join(' '),
      confidence: tokenRatio,
      message: isMatch
          ? 'The name on your school ID matches your registered profile.'
          : 'The name on your school ID does not match your registered profile. Please scan your own valid school ID again.',
    );
  }

  /// Verifies birthdate in OCR text locally
  static ({bool matches, String? detectedDate, String message})
  verifyBirthdateLocally(String rawText, String? expectedBirthdate) {
    if (expectedBirthdate == null || expectedBirthdate.trim().isEmpty) {
      return (
        matches: true,
        detectedDate: null,
        message: 'No birthdate on file to compare.',
      );
    }

    final cleanText = rawText.trim();
    if (cleanText.isEmpty) {
      return (
        matches: false,
        detectedDate: null,
        message:
            "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible.",
      );
    }

    final expParsed = parseDateComponents(expectedBirthdate);
    if (expParsed == null) {
      return (
        matches: true,
        detectedDate: null,
        message: 'Unrecognized registered birthdate format.',
      );
    }

    // Look for date patterns
    final dateRegexes = [
      RegExp(r'\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})\b'),
      RegExp(r'\b(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})\b'),
      RegExp(r'\b([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})\b'),
      RegExp(r'\b(\d{1,2}\s+[a-zA-Z]{3,9},?\s+\d{4})\b'),
    ];

    String? foundFormatted;
    bool matches = false;

    for (final reg in dateRegexes) {
      for (final match in reg.allMatches(cleanText)) {
        final cand = match.group(0)!;
        final candParsed = parseDateComponents(cand);
        if (candParsed != null) {
          foundFormatted ??=
              '${candParsed.month.toString().padLeft(2, '0')}/${candParsed.day.toString().padLeft(2, '0')}/${candParsed.year}';
          if (candParsed.year == expParsed.year) {
            if ((candParsed.month == expParsed.month &&
                    candParsed.day == expParsed.day) ||
                (candParsed.month == expParsed.day &&
                    candParsed.day == expParsed.month)) {
              matches = true;
              foundFormatted =
                  '${candParsed.month.toString().padLeft(2, '0')}/${candParsed.day.toString().padLeft(2, '0')}/${candParsed.year}';
              break;
            }
          }
        }
      }
      if (matches) break;
    }

    if (!matches) {
      final hasYear = cleanText.contains(expParsed.year.toString());
      final hasDay = RegExp('\\b${expParsed.day}\\b').hasMatch(cleanText);
      if (hasYear && hasDay) {
        matches = true;
        foundFormatted =
            '${expParsed.month.toString().padLeft(2, '0')}/${expParsed.day.toString().padLeft(2, '0')}/${expParsed.year}';
      }
    }

    final bool isMismatch = (foundFormatted != null && !matches);
    final bool effectiveMatch = !isMismatch;

    return (
      matches: effectiveMatch,
      detectedDate: foundFormatted,
      message: matches
          ? 'Birthdate verified! Matches registered information ($foundFormatted).'
          : (foundFormatted != null
                ? 'The birthdate on your school ID ($foundFormatted) does not match your registered information. Please check your ID and try again.'
                : 'No conflicting birthdate detected on ID card.'),
    );
  }

  /// Verifies ATM Proof locally
  static ({
    bool isValid,
    bool saMatches,
    bool nameMatches,
    String? detectedSaNumber,
    String? detectedName,
    String message,
  })
  verifyAtmLocally(
    String rawText,
    String expectedName,
    String expectedSaNumber,
  ) {
    final cleanText = rawText.trim();
    if (cleanText.isEmpty) {
      return (
        isValid: false,
        saMatches: false,
        nameMatches: false,
        detectedSaNumber: null,
        detectedName: null,
        message:
            "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible.",
      );
    }

    final cleanExpectedSa = expectedSaNumber.replaceAll(RegExp(r'\D'), '');

    // Extract digits
    final digitMatches = RegExp(
      r'\b\d{9,18}\b',
    ).allMatches(cleanText).map((m) => m.group(0)!).toList();
    final spacedMatches = RegExp(r'\b\d{3,6}[\s\-]\d{3,6}[\s\-]\d{2,6}\b')
        .allMatches(cleanText)
        .map((m) => m.group(0)!.replaceAll(RegExp(r'\D'), ''))
        .toList();

    final allCand = [...digitMatches, ...spacedMatches];
    String? foundSa;
    bool saMatches = false;

    final strippedAllText = cleanText.replaceAll(RegExp(r'\D'), '');
    if (cleanExpectedSa.isNotEmpty &&
        strippedAllText.contains(cleanExpectedSa)) {
      saMatches = true;
      foundSa = cleanExpectedSa;
    } else {
      for (final cand in allCand) {
        foundSa ??= cand;
        if (cleanExpectedSa.isNotEmpty &&
            (cand == cleanExpectedSa ||
                cand.contains(cleanExpectedSa) ||
                cleanExpectedSa.contains(cand))) {
          saMatches = true;
          foundSa = cand;
          break;
        }
      }
    }

    final nameRes = verifyNameLocally(cleanText, expectedName);
    final isValid = saMatches && nameRes.matches;

    String msg = '';
    if (isValid) {
      msg =
          'ATM Proof verified! Account holder name and SA number match registered records.';
    } else if (!saMatches && !nameRes.matches) {
      msg =
          "The account holder's name or SA number does not match your registered information. Please upload the correct ATM Proof.";
    } else if (!saMatches) {
      msg =
          "The SA number on your ATM proof does not match your entered SA number. Please upload the correct ATM Proof.";
    } else {
      msg =
          "The account holder's name does not match your registered information. Please upload the correct ATM Proof.";
    }

    return (
      isValid: isValid,
      saMatches: saMatches,
      nameMatches: nameRes.matches,
      detectedSaNumber: foundSa ?? cleanExpectedSa,
      detectedName: nameRes.detectedName,
      message: msg,
    );
  }

  static String normalizeNameString(String name) {
    return name
        .toUpperCase()
        .replaceAll(RegExp(r'[^A-Z0-9\s]'), ' ')
        .replaceAll(
          RegExp(r'\b(MR|MS|MRS|STUDENT|NAME|HON|DR|JR|SR|II|III|IV)\b'),
          '',
        )
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static ({int year, int month, int day})? parseDateComponents(String dateStr) {
    final clean = dateStr.trim();

    // 1. YYYY-MM-DD
    final iso = RegExp(
      r'^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$',
    ).firstMatch(clean);
    if (iso != null) {
      return (
        year: int.parse(iso.group(1)!),
        month: int.parse(iso.group(2)!),
        day: int.parse(iso.group(3)!),
      );
    }

    // 2. MM/DD/YYYY or DD/MM/YYYY
    final slash = RegExp(
      r'^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$',
    ).firstMatch(clean);
    if (slash != null) {
      final p1 = int.parse(slash.group(1)!);
      final p2 = int.parse(slash.group(2)!);
      final y = int.parse(slash.group(3)!);
      if (p1 > 12 && p2 <= 12) {
        return (year: y, month: p2, day: p1);
      }
      return (year: y, month: p1, day: p2);
    }

    // 3. Month DD, YYYY
    const months = {
      'JAN': 1,
      'JANUARY': 1,
      'FEB': 2,
      'FEBRUARY': 2,
      'MAR': 3,
      'MARCH': 3,
      'APR': 4,
      'APRIL': 4,
      'MAY': 5,
      'JUN': 6,
      'JUNE': 6,
      'JUL': 7,
      'JULY': 7,
      'AUG': 8,
      'AUGUST': 8,
      'SEP': 9,
      'SEPTEMBER': 9,
      'OCT': 10,
      'OCTOBER': 10,
      'NOV': 11,
      'NOVEMBER': 11,
      'DEC': 12,
      'DECEMBER': 12,
    };

    final textMonth = RegExp(
      r'([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})',
    ).firstMatch(clean);
    if (textMonth != null) {
      final mKey = textMonth.group(1)!.toUpperCase();
      final m = months[mKey];
      if (m != null) {
        return (
          year: int.parse(textMonth.group(3)!),
          month: m,
          day: int.parse(textMonth.group(2)!),
        );
      }
    }

    return null;
  }

  /// Robust regex extraction for ANY Academic Year (e.g. 2026-2027, 2024-2025, 2025-26, etc.)
  static String? _extractAcademicYear(String text) {
    if (text.isEmpty) return null;

    var cleaned = text
        .replaceAllMapped(
          RegExp(r'\b2[oO]([0-9]{2})', caseSensitive: false),
          (m) => '20${m[1]}',
        )
        .replaceAll(RegExp(r'[oO](?=\d)'), '0')
        .replaceAll(RegExp(r'(?<=\d)[oO]'), '0')
        .replaceAll(
          RegExp(
            r'[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D/\\~_\.]|(?<=\d)\s*(?:to|until)\s*(?=\d)',
          ),
          '-',
        );

    // Remove unintended spaces inside year digits, e.g. "20 26" -> "2026"
    cleaned = cleaned.replaceAllMapped(
      RegExp(r'\b(20)\s+(\d{2})\b'),
      (m) => '${m[1]}${m[2]}',
    );

    // Priority 1: Sticker header context lines (lines containing semester/registrar/validated keywords)
    final lines = cleaned.split(RegExp(r'[\r\n]+'));
    for (final line in lines) {
      final isStickerLine = RegExp(
        r'(?:sem|registrar|valid|ustp|campus)',
        caseSensitive: false,
      ).hasMatch(line);
      if (isStickerLine) {
        final lineAyMatch = RegExp(
          r'(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)?(202[0-9]|203[0-5])\s*[-–—/\\~_\.\s]+\s*(202[0-9]|203[0-5]|\d{2})\b',
          caseSensitive: false,
        ).firstMatch(line);
        if (lineAyMatch != null) {
          final start = int.parse(lineAyMatch.group(1)!);
          final endStr = lineAyMatch.group(2)!;
          final end = endStr.length == 2
              ? int.parse('${lineAyMatch.group(1)!.substring(0, 2)}$endStr')
              : int.parse(endStr);
          if (end == start + 1 || (end >= 2020 && end <= 2035 && end > start)) {
            return '$start-$end';
          }
        }
      }
    }

    // Priority 2: Explicit prefix A.Y. / S.Y. / Academic Year
    final explicitAyRegex = RegExp(
      r'(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)(20\d{2})\s*[-–—/\\~_\.\s]+\s*(20\d{2}|\d{2})\b',
      caseSensitive: false,
    );

    final explicitMatches = explicitAyRegex.allMatches(cleaned);
    for (final match in explicitMatches) {
      final start = int.parse(match.group(1)!);
      final endStr = match.group(2)!;
      final end = endStr.length == 2
          ? int.parse('${match.group(1)!.substring(0, 2)}$endStr')
          : int.parse(endStr);
      if (end == start + 1 || (end >= 2020 && end <= 2035 && end > start)) {
        return '$start-$end';
      }
    }

    // Priority 3: Consecutive year range (e.g. 2026-2027 or 2026-27), ensuring end == start + 1
    // (This ignores student IDs like 2023-45678 and dates like 2004-10-15)
    final rangeRegex = RegExp(
      r'\b(202[0-9]|203[0-5])\s*[-–—/\\~_\.]\s*(202[0-9]|203[0-5]|\d{2})\b',
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

    // Priority 4: Explicit single year with prefix (e.g. AY 2026)
    final singleAyRegex = RegExp(
      r'(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)(202[0-9]|203[0-5])\b',
      caseSensitive: false,
    );
    final singleMatch = singleAyRegex.firstMatch(cleaned);
    if (singleMatch != null) {
      final y = int.parse(singleMatch.group(1)!);
      return '$y-${y + 1}';
    }

    return null;
  }

  /// Robust regex extraction for Semester (1st, 2nd, Summer/Midyear).
  static String? _extractSemester(String text) {
    if (text.isEmpty) return null;
    final lines = text.split(RegExp(r'[\r\n]+'));

    String? checkSem(String s) {
      // Normalize superscript or punctuation symbols often produced by OCR for 1st/2nd
      final lower = s
          .toLowerCase()
          .replaceAll(RegExp(r'[\u00B0\u00BA˚]'), '*')
          .replaceAll(RegExp(r'\s+'), ' ');

      // Prevent non-semester words from falsely triggering (e.g. "2nd floor", "page 1 of 2")
      final hasSemesterWord = RegExp(
        r'\bsem(?:est(?:er|el|r|ev|or)?)?\b',
        caseSensitive: false,
      ).hasMatch(lower);

      final is2nd =
          RegExp(
            r'\b(?:2\s*nd|2\s*rd|second|2[\*+\#\~\^•]+|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(
            r'\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:2|ii)\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(
            r'\b(?:2|ii)\s*[\/\-]\s*sem\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(r'\b2nd\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(
            r'\bsecond\s+semester\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          (hasSemesterWord &&
              (lower.contains('2*') ||
                  lower.contains('2°') ||
                  lower.contains('2º')));
      if (is2nd) return '2nd Semester';

      final is1st =
          RegExp(
            r'\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+\#\~\^•]+|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(
            r'\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:1|i)\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(
            r'\b(?:1|i)\s*[\/\-]\s*sem\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(r'\b1st\s+semester\b', caseSensitive: false).hasMatch(lower) ||
          RegExp(
            r'\bfirst\s+semester\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          RegExp(
            r'\b[il]st\s+sem(?:ester)?\b',
            caseSensitive: false,
          ).hasMatch(lower) ||
          (hasSemesterWord &&
              (lower.contains('1*') ||
                  lower.contains('1°') ||
                  lower.contains('1º')));
      if (is1st) return '1st Semester';

      if (RegExp(
        r'\b(?:summer|mid\s*[\-]?year)\b',
        caseSensitive: false,
      ).hasMatch(lower)) {
        return 'Summer / Midyear';
      }

      return null;
    }

    for (final line in lines) {
      final res = checkSem(line);
      if (res != null) return res;
    }

    return checkSem(text);
  }
}
