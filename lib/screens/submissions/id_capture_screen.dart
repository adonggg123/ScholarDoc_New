import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'dart:typed_data';
import 'dart:io';
import 'dart:ui' as ui;
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/image_quality_service.dart';
import '../../services/academic_term_service.dart';
import '../../services/document_ai_service.dart';
import '../../services/auth_service.dart';
import 'document_crop_screen.dart';

class IDCaptureScreen extends StatefulWidget {
  final String? expectedName;
  final String? expectedBirthdate;
  const IDCaptureScreen({
    super.key,
    this.expectedName,
    this.expectedBirthdate,
  });

  @override
  State<IDCaptureScreen> createState() => _IDCaptureScreenState();
}

class _IDCaptureScreenState extends State<IDCaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  final AuthService _authService = AuthService();
  
  String _expectedName = '';
  String _expectedBirthdate = '';

  XFile? _frontImage;
  XFile? _backImage;
  Uint8List? _frontRawBytes;
  Uint8List? _backRawBytes;
  Uint8List? _frontProcessedBytes;
  Uint8List? _backProcessedBytes;

  ImageQualityResult? _frontQuality;
  ImageQualityResult? _backQuality;
  bool _isAnalyzingFront = false;
  bool _isAnalyzingBack = false;

  FrontIdScanResult? _frontNameResult;
  bool _isScanningFrontName = false;
  String _frontScanProgressStatus = 'Scanning Student Name...';
  String? _frontScanError;

  StickerScanResult? _stickerResult;
  bool _isScanningSticker = false;
  String _backScanProgressStatus = 'Scanning Term & Birthdate...';
  String? _backScanError;

  int _currentStep = 0;
  
  final SignatureController _signatureController = SignatureController(
    penStrokeWidth: 4,
    penColor: Colors.black,
    exportBackgroundColor: Colors.transparent,
  );

  bool _isGeneratingPdf = false;
  Uint8List? _generatedPdfBytes;
  bool _showPreview = false;

  @override
  void initState() {
    super.initState();
    AcademicTermService.initialize();
    _signatureController.onDrawStart = () {
      setState(() {});
    };
    _initExpectedStudentData();
  }

  Future<void> _initExpectedStudentData() async {
    _expectedName = (widget.expectedName ?? '').trim();
    _expectedBirthdate = (widget.expectedBirthdate ?? '').trim();
    if (_expectedName.isEmpty || _expectedBirthdate.isEmpty) {
      try {
        final uid = _authService.currentUser?.id;
        if (uid != null) {
          final profile = await _authService.getStudentProfile(uid);
          if (profile != null) {
            if (_expectedName.isEmpty) {
              _expectedName = (profile['fullName'] ?? profile['full_name'] ?? '').toString().trim();
            }
            if (_expectedBirthdate.isEmpty) {
              _expectedBirthdate = (profile['birthdate'] ?? profile['date_of_birth'] ?? '').toString().trim();
            }
            if (mounted) setState(() {});
          }
        }
      } catch (e) {
        debugPrint('Error loading expected student data: $e');
      }
    }
  }

  @override
  void dispose() {
    _signatureController.dispose();
    super.dispose();
  }

  /// Scales down image bytes if they exceed 350KB using native hardware decoding
  Future<Uint8List> _optimizeImageBytes(Uint8List originalBytes, {int targetWidth = 1024}) async {
    if (originalBytes.lengthInBytes <= 350 * 1024) {
      return originalBytes;
    }
    try {
      final codec = await ui.instantiateImageCodec(
        originalBytes,
        targetWidth: targetWidth,
      );
      final frame = await codec.getNextFrame();
      final byteData = await frame.image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData != null) {
        return byteData.buffer.asUint8List();
      }
    } catch (e) {
      debugPrint('Error optimizing image bytes: $e');
    }
    return originalBytes;
  }

  Future<void> _captureImage(bool isFront) async {
    _promptImageSource(isFront);
  }

  void _promptImageSource(bool isFront) {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.surfaceC,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Capture ${isFront ? "Front" : "Back"} of ID',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: context.textPri,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'Make sure the ID is well-lit and all text is sharply readable with zero blur.',
                style: TextStyle(fontSize: 12, color: context.textSec),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              InkWell(
                onTap: () {
                  Navigator.pop(ctx);
                  _pickImageWithSource(isFront, ImageSource.camera);
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F3260).withOpacity(0.06),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: context.crispBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: const BoxDecoration(
                          color: Color(0xFF0F3260),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.camera, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Take Photo with Camera',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: context.textPri,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Hold steady and tap screen to auto-focus',
                              style: TextStyle(fontSize: 11, color: context.textSec),
                            ),
                          ],
                        ),
                      ),
                      Icon(LucideIcons.chevronRight, color: context.textSec, size: 16),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: () {
                  Navigator.pop(ctx);
                  _pickImageWithSource(isFront, ImageSource.gallery);
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: context.surfaceC,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: context.crispBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.image, color: Color(0xFF10B981), size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Choose from Gallery',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: context.textPri,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Select an existing sharp, clear ID scan',
                              style: TextStyle(fontSize: 11, color: context.textSec),
                            ),
                          ],
                        ),
                      ),
                      Icon(LucideIcons.chevronRight, color: context.textSec, size: 16),
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

  Future<void> _pickImageWithSource(bool isFront, ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 90,
      );
      if (image == null) return;
      final rawBytes = await image.readAsBytes();

      if (!mounted) return;

      // CamScanner-style interactive crop & filter preview screen
      final processed = await Navigator.push<Uint8List>(
        context,
        MaterialPageRoute(
          builder: (ctx) => DocumentCropScreen(
            imageBytes: rawBytes,
            title: isFront ? 'Crop & Enhance Front ID' : 'Crop & Enhance Back ID',
            isIdCard: true,
          ),
        ),
      );
      if (processed == null) return;

      setState(() {
        if (isFront) {
          _frontImage = image;
          _frontRawBytes = rawBytes;
          _frontProcessedBytes = processed;
          _isAnalyzingFront = true;
          _frontQuality = null;
          _frontNameResult = null;
        } else {
          _backImage = image;
          _backRawBytes = rawBytes;
          _backProcessedBytes = processed;
          _isAnalyzingBack = true;
          _backQuality = null;
          _stickerResult = null;
        }
      });

      // Analyze image sharpness / blurriness
      final quality = await ImageQualityService.analyzeQuality(processed);

      if (!mounted) return;

      setState(() {
        if (isFront) {
          _frontQuality = quality;
          _isAnalyzingFront = false;
        } else {
          _backQuality = quality;
          _isAnalyzingBack = false;
        }
      });

      if (quality.isBlurry) {
        _showBlurWarningDialog(isFront: isFront, quality: quality);
      } else {
        if (isFront) {
          _scanFrontName(processed);
        } else {
          _scanBackSticker(processed);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (isFront) {
            _isAnalyzingFront = false;
          } else {
            _isAnalyzingBack = false;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to process image: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  Future<void> _adjustCrop(bool isFront) async {
    final rawBytes = isFront ? _frontRawBytes : _backRawBytes;
    if (rawBytes == null) return;

    final processed = await Navigator.push<Uint8List>(
      context,
      MaterialPageRoute(
        builder: (ctx) => DocumentCropScreen(
          imageBytes: rawBytes,
          title: isFront ? 'Crop & Enhance Front ID' : 'Crop & Enhance Back ID',
          isIdCard: true,
        ),
      ),
    );
    if (processed == null) return;

    setState(() {
      if (isFront) {
        _frontProcessedBytes = processed;
        _isAnalyzingFront = true;
        _frontQuality = null;
        _frontNameResult = null;
      } else {
        _backProcessedBytes = processed;
        _isAnalyzingBack = true;
        _backQuality = null;
        _stickerResult = null;
      }
    });

    final quality = await ImageQualityService.analyzeQuality(processed);
    if (!mounted) return;

    setState(() {
      if (isFront) {
        _frontQuality = quality;
        _isAnalyzingFront = false;
      } else {
        _backQuality = quality;
        _isAnalyzingBack = false;
      }
    });

    if (quality.isBlurry) {
      _showBlurWarningDialog(isFront: isFront, quality: quality);
    } else {
      if (isFront) {
        _scanFrontName(processed);
      } else {
        _scanBackSticker(processed);
      }
    }
  }

  Future<void> _scanFrontName(Uint8List bytes) async {
    setState(() {
      _isScanningFrontName = true;
      _frontScanProgressStatus = 'Optimizing image for fast OCR...';
      _frontScanError = null;
      _frontNameResult = null;
    });

    try {
      final result = await DocumentAIScannerService.scanIdFrontName(
        bytes,
        expectedName: _expectedName,
        onProgress: (status) {
          if (mounted) setState(() => _frontScanProgressStatus = status);
        },
      );

      if (!mounted) return;

      setState(() {
        _isScanningFrontName = false;
        _frontNameResult = result;
      });

      if (!result.isNameMatch) {
        _showNameMismatchDialog(result);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(LucideIcons.shieldCheck, color: Colors.white, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Identity Verified: Name matched (${result.extractedName ?? _expectedName})',
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isScanningFrontName = false;
          _frontScanError = 'OCR scan timed out or failed. Please check network connection.';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(LucideIcons.alertCircle, color: Colors.white, size: 18),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('OCR name scan failed. Tap retry to try again.'),
                ),
                TextButton(
                  onPressed: () => _scanFrontName(bytes),
                  child: const Text('RETRY', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 6),
          ),
        );
        debugPrint('Error scanning front ID name: $e');
      }
    }
  }

  void _showNameMismatchDialog(FrontIdScanResult result) {
    final bool isUnreadable = !result.isReadable;
    final String title = isUnreadable ? 'Unreadable Front ID' : 'Front ID Name Mismatch';
    final String message = isUnreadable
        ? "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible."
        : "The name on your school ID does not match your registered profile. Please scan your own valid school ID again.";

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: context.surfaceC,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.userX, color: AppTheme.error, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: context.textPri),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message,
              style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.crispBorder),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Registered Profile:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                      Flexible(
                        child: Text(
                          _expectedName.isNotEmpty ? _expectedName : 'Active User',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                          textAlign: TextAlign.end,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Extracted from ID:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                      Flexible(
                        child: Text(
                          result.extractedName ?? 'Could not extract name',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.error),
                          textAlign: TextAlign.end,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.shieldAlert, size: 16, color: AppTheme.error),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'You must scan your own valid school ID matching your registered name to proceed.',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.error),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Review Photo', style: TextStyle(color: context.textSec, fontWeight: FontWeight.w600)),
          ),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _adjustCrop(true);
            },
            icon: const Icon(LucideIcons.crop, size: 14, color: Color(0xFF0F3260)),
            label: const Text('Adjust / Crop'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF0F3260),
              side: const BorderSide(color: Color(0xFF0F3260)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _promptImageSource(true);
            },
            icon: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
            label: const Text('Retake Front ID'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  void _showBlurWarningDialog({required bool isFront, required ImageQualityResult quality}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: context.surfaceC,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '${isFront ? "Front" : "Back"} ID is Blurry',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: context.textPri),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'The scan of your ${isFront ? "front" : "back"} ID card does not meet clarity standards (${quality.sharpnessPercent}% sharpness score).',
              style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.crispBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tips for a sharp capture:',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: context.textPri),
                  ),
                  const SizedBox(height: 8),
                  Text('• Hold your phone steady with both hands.', style: TextStyle(fontSize: 11, color: context.textSec)),
                  const SizedBox(height: 3),
                  Text('• Tap your screen directly on the card to focus.', style: TextStyle(fontSize: 11, color: context.textSec)),
                  const SizedBox(height: 3),
                  Text('• Ensure adequate lighting and avoid glares.', style: TextStyle(fontSize: 11, color: context.textSec)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.shieldAlert, size: 16, color: AppTheme.error),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'You cannot proceed with submission until this scan is sharp and readable.',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.error),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Review Photo', style: TextStyle(color: context.textSec, fontWeight: FontWeight.w600)),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _promptImageSource(isFront);
            },
            icon: const Icon(LucideIcons.camera, size: 16, color: Colors.white),
            label: const Text('Retake Now'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _scanBackSticker(Uint8List bytes) async {
    setState(() {
      _isScanningSticker = true;
      _backScanProgressStatus = 'Optimizing back ID for scan...';
      _backScanError = null;
      _stickerResult = null;
    });

    try {
      // 1. Scan the captured image directly
      var result = await DocumentAIScannerService.scanIdBackSticker(
        bytes,
        expectedBirthdate: _expectedBirthdate,
        onProgress: (status) {
          if (mounted) setState(() => _backScanProgressStatus = status);
        },
      );

      // 2. High-Accuracy Fallback: If not validated or missing academic year / semester, scan cropped sticker ROI
      if (!result.isValid || result.academicYear == null || result.semester == null) {
        if (mounted) {
          setState(() => _backScanProgressStatus = 'Analyzing sticker region...');
        }
        final roiBytes = await DocumentAIScannerService.cropUpperStickerROI(bytes);
        final roiResult = await DocumentAIScannerService.scanIdBackSticker(
          roiBytes,
          expectedBirthdate: _expectedBirthdate,
        );

        if (roiResult.isValid) {
          result = roiResult.copyWith(
            birthdate: result.birthdate ?? roiResult.birthdate,
            birthdateMatches: (result.birthdate != null && !result.birthdateMatches) ? false : true,
          );
        } else if (roiResult.stickerFound) {
          final bestYear = roiResult.termValidation.yearMatches
              ? roiResult.academicYear
              : (result.termValidation.yearMatches ? result.academicYear : (roiResult.academicYear ?? result.academicYear));
          final bestSem = roiResult.termValidation.semesterMatches
              ? roiResult.semester
              : (result.termValidation.semesterMatches ? result.semester : (roiResult.semester ?? result.semester));
          final bestStamp = result.hasValidationStamp || roiResult.hasValidationStamp;
          final bestRegistrar = roiResult.registrarText ?? result.registrarText;
          final bestDob = result.birthdate ?? roiResult.birthdate;
          // Genuine mismatch only if a birthdate was found that contradicts profile
          final bestDobMatch = (result.birthdate != null && !result.birthdateMatches) ? false : true;

          result = DocumentAIScannerService.revalidateWithTerms(
            result,
            academicYear: bestYear,
            semester: bestSem,
            hasValidationStamp: bestStamp,
            registrarText: bestRegistrar,
          ).copyWith(
            birthdate: bestDob,
            birthdateMatches: bestDobMatch,
          );
        }
      }

      if (!mounted) return;

      setState(() {
        _isScanningSticker = false;
        _stickerResult = result;
      });

      final bool isBirthdateValid = result.birthdateMatches != false;
      if (!result.isValid || !isBirthdateValid) {
        _showStickerWarningDialog(result);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(LucideIcons.shieldCheck, color: Colors.white, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Back ID Verified: ${result.semester ?? ""} AY ${result.academicYear ?? ""}${result.birthdate != null ? " • DOB: ${result.birthdate}" : ""}',
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isScanningSticker = false;
          _backScanError = 'OCR sticker scan timed out or failed. Please check network connection.';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(LucideIcons.alertCircle, color: Colors.white, size: 18),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('OCR sticker scan failed. Tap retry to try again.'),
                ),
                TextButton(
                  onPressed: () => _scanBackSticker(bytes),
                  child: const Text('RETRY', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 6),
          ),
        );
        debugPrint('Error scanning sticker: $e');
      }
    }
  }

  void _showStickerWarningDialog(StickerScanResult result) {
    final bool isBirthdateMismatch = result.birthdate != null && result.birthdateMatches == false;
    final bool isUnreadable = !result.stickerFound && result.birthdate == null;
    
    String title;
    String message;
    if (isBirthdateMismatch) {
      title = 'Birthdate Mismatch';
      message = 'The birthdate on your school ID (${result.birthdate}) does not match your registered information ($_expectedBirthdate). Please check your ID and try again.';
    } else if (isUnreadable) {
      title = result.termValidation.statusTitle;
      message = result.termValidation.message;
    } else {
      title = result.termValidation.statusTitle;
      message = result.termValidation.message;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: context.surfaceC,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: context.textPri),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message,
              style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.crispBorder),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Required Period:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                      Text(
                        result.termValidation.currentTerm.displayString,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Detected on ID:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                      Text(
                        result.stickerFound
                            ? '${result.semester ?? "Unknown"} • AY ${result.academicYear ?? "Unknown"}'
                            : 'No sticker detected',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: result.isValid ? const Color(0xFF10B981) : AppTheme.error),
                      ),
                    ],
                  ),
                  if (result.birthdate != null || _expectedBirthdate.isNotEmpty) ...[
                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Profile Birthdate:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                        Text(
                          _expectedBirthdate.isNotEmpty ? _expectedBirthdate : 'Not recorded',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('ID Birthdate:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textSec)),
                        Text(
                          result.birthdate ?? 'Unreadable',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: result.birthdateMatches == true ? const Color(0xFF10B981) : AppTheme.error,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.shieldAlert, size: 16, color: AppTheme.error),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'All details must match valid current records before you can submit.',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.error),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Review Photo', style: TextStyle(color: context.textSec, fontWeight: FontWeight.w600)),
          ),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _adjustCrop(false);
            },
            icon: const Icon(LucideIcons.crop, size: 14, color: Color(0xFF0F3260)),
            label: const Text('Adjust / Crop'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF0F3260),
              side: const BorderSide(color: Color(0xFF0F3260)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _promptImageSource(false);
            },
            icon: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
            label: const Text('Retake Back ID'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _generatePdf() async {
    if ((_frontProcessedBytes == null && _frontImage == null) ||
        (_backProcessedBytes == null && _backImage == null) ||
        _signatureController.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please complete all captures before review.'),
          backgroundColor: AppTheme.warning,
        ),
      );
      return;
    }

    if (_frontQuality?.isBlurry == true) {
      _showWarning('Cannot proceed: Front ID scan is blurry. Please retake it.');
      _showBlurWarningDialog(isFront: true, quality: _frontQuality!);
      return;
    }

    if (_backQuality?.isBlurry == true) {
      _showWarning('Cannot proceed: Back ID scan is blurry. Please retake it.');
      _showBlurWarningDialog(isFront: false, quality: _backQuality!);
      return;
    }

    if (_frontNameResult != null && !_frontNameResult!.isNameMatch) {
      _showWarning('Cannot compile PDF: The name on your school ID does not match your registered profile.');
      _showNameMismatchDialog(_frontNameResult!);
      return;
    }

    if (_stickerResult != null && (!_stickerResult!.isValid || _stickerResult!.birthdateMatches == false)) {
      _showWarning('Cannot compile PDF: Back ID validation sticker or birthdate verification failed.');
      _showStickerWarningDialog(_stickerResult!);
      return;
    }

    setState(() {
      _isGeneratingPdf = true;
    });

    try {
      // Small delay to allow UI to paint loading spinner smoothly
      await Future.delayed(const Duration(milliseconds: 50));

      final rawFrontBytes = _frontProcessedBytes ?? await _frontImage!.readAsBytes();
      final rawBackBytes = _backProcessedBytes ?? await _backImage!.readAsBytes();
      
      final frontBytes = await _optimizeImageBytes(rawFrontBytes);
      final backBytes = await _optimizeImageBytes(rawBackBytes);

      final pw.MemoryImage frontPwImage = pw.MemoryImage(frontBytes);
      final pw.MemoryImage backPwImage = pw.MemoryImage(backBytes);

      final signatureBytes = await _signatureController.toPngBytes();
      pw.MemoryImage? signaturePwImage;
      if (signatureBytes != null) {
        signaturePwImage = pw.MemoryImage(signatureBytes);
      }

      final pdf = pw.Document();

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4.landscape,
          margin: const pw.EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Header(
                  level: 0,
                  child: pw.Text('Document Submission', style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold)),
                ),
                pw.SizedBox(height: 16),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text('ID Front', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                          pw.SizedBox(height: 8),
                          pw.Container(
                            alignment: pw.Alignment.center,
                            height: 250,
                            child: pw.Image(frontPwImage, fit: pw.BoxFit.contain),
                          ),
                        ],
                      ),
                    ),
                    pw.SizedBox(width: 12),
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text('ID Back', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                          pw.SizedBox(height: 8),
                          pw.Container(
                            alignment: pw.Alignment.center,
                            height: 250,
                            child: pw.Image(backPwImage, fit: pw.BoxFit.contain),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                pw.SizedBox(height: 20),
                pw.Text('Specimen Signatures', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 8),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
                  children: [
                    pw.Column(
                      children: [
                        if (signaturePwImage != null)
                          pw.Container(
                            alignment: pw.Alignment.center,
                            width: 140,
                            height: 60,
                            decoration: pw.BoxDecoration(
                              border: pw.Border.all(color: PdfColors.grey300, width: 1),
                            ),
                            child: pw.Image(signaturePwImage, fit: pw.BoxFit.contain),
                          ),
                        pw.SizedBox(height: 4),
                        pw.Text('Signature 1', style: pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                      ],
                    ),
                    pw.Column(
                      children: [
                        if (signaturePwImage != null)
                          pw.Container(
                            alignment: pw.Alignment.center,
                            width: 140,
                            height: 60,
                            decoration: pw.BoxDecoration(
                              border: pw.Border.all(color: PdfColors.grey300, width: 1),
                            ),
                            child: pw.Image(signaturePwImage, fit: pw.BoxFit.contain),
                          ),
                        pw.SizedBox(height: 4),
                        pw.Text('Signature 2', style: pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                      ],
                    ),
                    pw.Column(
                      children: [
                        if (signaturePwImage != null)
                          pw.Container(
                            alignment: pw.Alignment.center,
                            width: 140,
                            height: 60,
                            decoration: pw.BoxDecoration(
                              border: pw.Border.all(color: PdfColors.grey300, width: 1),
                            ),
                            child: pw.Image(signaturePwImage, fit: pw.BoxFit.contain),
                          ),
                        pw.SizedBox(height: 4),
                        pw.Text('Signature 3', style: pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                      ],
                    ),
                  ],
                ),
                pw.Spacer(),
                pw.Divider(),
                pw.SizedBox(height: 6),
                pw.Text('Generated by ScholarDoc App', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey)),
              ],
            );
          },
        ),
      );

      final Uint8List pdfBytes = await pdf.save();

      if (mounted) {
        setState(() {
          _generatedPdfBytes = pdfBytes;
          _showPreview = true;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to compile PDF: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isGeneratingPdf = false;
        });
      }
    }
  }

  void _nextStep() {
    if (_currentStep == 0) {
      if (_frontProcessedBytes == null && _frontImage == null) {
        _showWarning('Please capture the front side of your ID.');
        return;
      }
      if (_isAnalyzingFront || _isScanningFrontName) {
        _showWarning('Analyzing front ID and verifying name, please wait a moment...');
        return;
      }
      if (_frontQuality?.isBlurry == true) {
        _showWarning('Cannot proceed: Front ID photo is blurry. Please retake a sharper scan.');
        _showBlurWarningDialog(isFront: true, quality: _frontQuality!);
        return;
      }
      if (_frontNameResult != null && !_frontNameResult!.isNameMatch) {
        _showWarning('The name on your school ID does not match your registered profile. Please scan your own valid school ID again.');
        _showNameMismatchDialog(_frontNameResult!);
        return;
      }
    }
    if (_currentStep == 1) {
      if (_backProcessedBytes == null && _backImage == null) {
        _showWarning('Please capture the back side of your ID.');
        return;
      }
      if (_isAnalyzingBack || _isScanningSticker) {
        _showWarning('OCR is currently verifying your validation sticker and birthdate, please wait...');
        return;
      }
      if (_backQuality?.isBlurry == true) {
        _showWarning('Cannot proceed: Back ID photo is blurry. Please retake a sharper scan.');
        _showBlurWarningDialog(isFront: false, quality: _backQuality!);
        return;
      }
      if (_stickerResult != null) {
        final bool isBirthdateValid = _stickerResult!.birthdateMatches != false;
        if (!_stickerResult!.isValid || !isBirthdateValid) {
          _showWarning('Cannot proceed: The ID validation sticker or birthdate does not match current records.');
          _showStickerWarningDialog(_stickerResult!);
          return;
        }
      }
    }
    if (_currentStep == 2 && _signatureController.isEmpty) {
      _showWarning('Please draw your specimen signature.');
      return;
    }

    setState(() {
      _currentStep++;
    });
  }

  void _prevStep() {
    setState(() {
      _currentStep--;
    });
  }

  void _showWarning(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppTheme.warning,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // If the PDF is generated and we want to review the full compiled file
    if (_showPreview && _generatedPdfBytes != null) {
      return _buildPdfReviewScreen();
    }

    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Identity Validation', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: context.isDark ? const Color(0xFF1E293B) : const Color(0xFF0F3260),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isGeneratingPdf
          ? _buildLoadingOverlay('Compiling documents into PDF...')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Steps Progress Tracker Stepper
                _buildStepperHeader(),
                
                // Stepper Body Panel
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: _buildCurrentStepWidget(),
                  ),
                ),

                // Stepper Footer Navigation Bar
                _buildNavigationFooter(),
              ],
            ),
    );
  }

  Widget _buildStepperHeader() {
    final steps = ['ID Front', 'ID Back', 'Signature', 'Review'];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      color: context.isDark ? const Color(0xFF1E293B) : const Color(0xFF0F3260),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(steps.length, (index) {
          final isCompleted = index < _currentStep;
          final isActive = index == _currentStep;
          
          return Expanded(
            child: Row(
              children: [
                // Step Indicator Node
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: isCompleted
                        ? const Color(0xFF10B981)
                        : (isActive ? AppTheme.accentColor : Colors.white10),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: isCompleted
                        ? const Icon(LucideIcons.check, color: Colors.white, size: 12)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isActive ? const Color(0xFF0F3260) : Colors.white60,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 8),
                // Step Label Text
                Expanded(
                  child: Text(
                    steps[index],
                    style: TextStyle(
                      color: isActive
                          ? Colors.white
                          : (isCompleted ? Colors.white70 : Colors.white38),
                      fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (index < steps.length - 1)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Icon(
                      LucideIcons.chevronRight,
                      color: Colors.white12,
                      size: 12,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildCurrentStepWidget() {
    switch (_currentStep) {
      case 0:
        return _buildCaptureStepWidget(
          title: 'Step 1: Front of ID Card',
          instruction: 'Place the front side of your ID card inside the frame guide below. Ensure all text, photo, and markings are sharp, in-focus, and clearly visible with zero blur or glare.',
          image: _frontImage,
          quality: _frontQuality,
          isAnalyzing: _isAnalyzingFront,
          onTap: () => _captureImage(true),
          label: 'Capture Front Side',
          isFront: true,
        );
      case 1:
        return _buildCaptureStepWidget(
          title: 'Step 2: Back of ID Card',
          instruction: 'Turn your ID card over and align the back side inside the frame guide below. The text, barcode, and details must be sharp, in-focus, and readable.',
          image: _backImage,
          quality: _backQuality,
          isAnalyzing: _isAnalyzingBack,
          onTap: () => _captureImage(false),
          label: 'Capture Back Side',
          isFront: false,
        );
      case 2:
        return _buildSignatureStepWidget();
      case 3:
        return _buildReviewStepWidget();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildCaptureStepWidget({
    required String title,
    required String instruction,
    required XFile? image,
    required ImageQualityResult? quality,
    required bool isAnalyzing,
    required VoidCallback onTap,
    required String label,
    required bool isFront,
  }) {
    final bool isBlurry = quality?.isBlurry == true;
    final bool isClear = quality != null && !quality.isBlurry;

    Color borderColor;
    if (isAnalyzing) {
      borderColor = const Color(0xFF3B82F6);
    } else if (isBlurry) {
      borderColor = AppTheme.error;
    } else if (isClear) {
      borderColor = const Color(0xFF10B981);
    } else {
      borderColor = context.crispBorder;
    }

    return SingleChildScrollView(
      key: ValueKey(_currentStep),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: context.textPri),
                ),
              ),
              if (quality != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isBlurry
                        ? AppTheme.error.withOpacity(0.12)
                        : const Color(0xFF10B981).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isBlurry
                          ? AppTheme.error.withOpacity(0.3)
                          : const Color(0xFF10B981).withOpacity(0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isBlurry ? LucideIcons.alertTriangle : LucideIcons.checkCircle2,
                        size: 13,
                        color: isBlurry ? AppTheme.error : const Color(0xFF10B981),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isBlurry ? 'Blurry (${quality.sharpnessPercent}%)' : '${quality.sharpnessPercent}% Sharp',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isBlurry ? AppTheme.error : const Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            instruction,
            style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
          ),
          const SizedBox(height: 24),
          
          // KYC Alignment Frame Card
          GestureDetector(
            onTap: onTap,
            child: Container(
              height: 220,
              decoration: BoxDecoration(
                color: context.surfaceC,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: borderColor,
                  width: isBlurry ? 2.5 : (isClear ? 2.0 : 1.5),
                ),
                boxShadow: [
                  BoxShadow(
                    color: isBlurry
                        ? AppTheme.error.withOpacity(0.15)
                        : (isClear
                            ? const Color(0xFF10B981).withOpacity(0.12)
                            : Colors.black.withOpacity(context.isDark ? 0.2 : 0.03)),
                    blurRadius: isBlurry || isClear ? 16 : 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: (isFront ? _frontProcessedBytes : _backProcessedBytes) == null && image == null
                    ? Stack(
                        alignment: Alignment.center,
                        children: [
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                LucideIcons.camera,
                                size: 48,
                                color: const Color(0xFF0F3260).withOpacity(0.4),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                label,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                          Container(
                            margin: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: const Color(0xFF0F3260).withOpacity(0.2),
                                width: 2,
                                style: BorderStyle.solid,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ],
                      )
                    : Stack(
                        fit: StackFit.expand,
                        children: [
                          (isFront ? _frontProcessedBytes : _backProcessedBytes) != null
                              ? Image.memory(
                                  (isFront ? _frontProcessedBytes : _backProcessedBytes)!,
                                  fit: BoxFit.contain,
                                )
                              : Image.file(File(image!.path), fit: BoxFit.cover),
                          
                          // Analyzing overlay
                          if (isAnalyzing || (isFront && _isScanningFrontName) || (!isFront && _isScanningSticker))
                            Container(
                              color: Colors.black.withOpacity(0.68),
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const SizedBox(
                                    width: 32,
                                    height: 32,
                                    child: CircularProgressIndicator(
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                      strokeWidth: 2.5,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    isFront
                                        ? (_isScanningFrontName ? _frontScanProgressStatus : 'Analyzing Image...')
                                        : (_isScanningSticker ? _backScanProgressStatus : 'Analyzing Image...'),
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    isFront ? 'OCR Name Verification' : 'OCR Sticker Verification',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.7),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          // Scan failure overlay with in-card retry
                          if (!isAnalyzing &&
                              ((isFront && _frontScanError != null && _frontNameResult == null) ||
                               (!isFront && _backScanError != null && _stickerResult == null)))
                            Container(
                              color: Colors.black.withOpacity(0.75),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(LucideIcons.alertCircle, color: AppTheme.error, size: 28),
                                  const SizedBox(height: 8),
                                  Text(
                                    isFront ? 'Name Scan Failed' : 'OCR Sticker Scan Failed',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    (isFront ? _frontScanError : _backScanError) ?? 'Processing issue occurred.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11),
                                  ),
                                  const SizedBox(height: 10),
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      final b = isFront ? _frontProcessedBytes : _backProcessedBytes;
                                      if (b != null) {
                                        if (isFront) {
                                          _scanFrontName(b);
                                        } else {
                                          _scanBackSticker(b);
                                        }
                                      }
                                    },
                                    icon: const Icon(LucideIcons.refreshCw, size: 14),
                                    label: const Text('Retry Scan', style: TextStyle(fontSize: 12)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0F3260),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          // Blurry Warning Overlay
                          if (!isAnalyzing && isBlurry)
                            Container(
                              color: AppTheme.error.withOpacity(0.25),
                              alignment: Alignment.center,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                decoration: BoxDecoration(
                                  color: Colors.black87,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppTheme.error, width: 1.5),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'BLURRY - RETAKE REQUIRED',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                          // Clear checkmark indicator
                          if (!isAnalyzing && isClear &&
                              ((isFront && _frontNameResult?.isNameMatch == true) ||
                               (!isFront && _stickerResult?.isValid == true && _stickerResult?.birthdateMatches != false)))
                            Positioned(
                              top: 12,
                              left: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981),
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.2),
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(LucideIcons.checkCheck, color: Colors.white, size: 14),
                                    SizedBox(width: 4),
                                    Text(
                                      'VALIDATED',
                                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                          // Bottom action badges (Adjust / Crop and Retake)
                          Positioned(
                            bottom: 12,
                            right: 12,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if ((isFront ? _frontRawBytes : _backRawBytes) != null) ...[
                                  GestureDetector(
                                    onTap: () => _adjustCrop(isFront),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.black87,
                                        borderRadius: BorderRadius.circular(8),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.3),
                                            blurRadius: 4,
                                          ),
                                        ],
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(LucideIcons.crop, color: Colors.white, size: 13),
                                          SizedBox(width: 5),
                                          Text(
                                            'Crop / Adjust',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                GestureDetector(
                                  onTap: onTap,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: isBlurry ? AppTheme.error : Colors.black87,
                                      borderRadius: BorderRadius.circular(8),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.3),
                                          blurRadius: 4,
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          isBlurry ? LucideIcons.alertTriangle : LucideIcons.refreshCw,
                                          color: Colors.white,
                                          size: 13,
                                        ),
                                        const SizedBox(width: 5),
                                        Text(
                                          isBlurry ? 'Retake' : 'Retake',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
          
          // Warning / Status Banner Below Frame Card
          if (isBlurry) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.error.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(LucideIcons.alertOctagon, color: AppTheme.error, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Blurry ${isFront ? "Front" : "Back"} ID Detected',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          color: AppTheme.error,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    quality?.message ?? 'Image is blurry. Please hold camera steady and retake with good lighting.',
                    style: TextStyle(fontSize: 12, color: context.textSec, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: onTap,
                      icon: const Icon(LucideIcons.camera, size: 16, color: Colors.white),
                      label: Text('Retake ${isFront ? "Front" : "Back"} ID (Clear Photo)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.error,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (isClear) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF10B981).withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.checkCircle2, color: Color(0xFF10B981), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${isFront ? "Front" : "Back"} ID scan is clear and sharp (${quality.sharpnessPercent}% clarity).',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: context.textPri,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Document AI OCR Verification Widget for Front ID
          if (isFront) _buildFrontNameStatusWidget(),

          // Document AI Sticker Verification Widget for Back ID
          if (!isFront) _buildBackStickerStatusWidget(),

          const SizedBox(height: 24),
          _buildKYCRequirementsList(),
        ],
      ),
    );
  }

  Widget _buildFrontNameStatusWidget() {
    if (_isScanningFrontName) {
      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0F3260).withOpacity(0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF0F3260).withOpacity(0.2)),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0F3260)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'OCR Name Verification in Progress',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F3260)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _frontScanProgressStatus,
                    style: TextStyle(fontSize: 11, color: context.textSec, height: 1.3),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_frontScanError != null && _frontNameResult == null) {
      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.error.withOpacity(0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'OCR Name Scan Incomplete',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.error),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _frontScanError!,
              style: TextStyle(fontSize: 12, color: context.textSec),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () {
                if (_frontProcessedBytes != null) _scanFrontName(_frontProcessedBytes!);
              },
              icon: const Icon(LucideIcons.refreshCw, size: 14),
              label: const Text('Retry OCR Scan'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F3260),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      );
    }

    if (_frontNameResult != null) {
      final res = _frontNameResult!;
      final bool isMatch = res.isNameMatch;

      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isMatch ? const Color(0xFF10B981).withOpacity(0.08) : AppTheme.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isMatch ? const Color(0xFF10B981).withOpacity(0.4) : AppTheme.error.withOpacity(0.4),
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isMatch ? LucideIcons.shieldCheck : LucideIcons.userX,
                  color: isMatch ? const Color(0xFF10B981) : AppTheme.error,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isMatch ? 'Identity Verified: Name Matched' : 'Name Verification Failed',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: isMatch ? const Color(0xFF10B981) : AppTheme.error,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isMatch ? const Color(0xFF10B981) : AppTheme.error,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isMatch ? 'VERIFIED' : 'MISMATCH',
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _buildStickerInfoPill('Registered', _expectedName.isNotEmpty ? _expectedName : 'Active User', isMatch ? const Color(0xFF10B981) : AppTheme.error),
                _buildStickerInfoPill('Extracted from ID', res.extractedName ?? 'Unreadable', isMatch ? const Color(0xFF10B981) : AppTheme.error),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              res.message,
              style: TextStyle(fontSize: 12, color: context.textPri, height: 1.35),
            ),
            if (!isMatch) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _adjustCrop(true),
                      icon: const Icon(LucideIcons.crop, size: 14),
                      label: const Text('Adjust / Crop'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: context.textPri,
                        side: BorderSide(color: context.crispBorder),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _promptImageSource(true),
                      icon: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
                      label: const Text('Retake Front ID'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.error,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildBackStickerStatusWidget() {
    if (_isScanningSticker) {
      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0F3260).withOpacity(0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF0F3260).withOpacity(0.2)),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0F3260)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'OCR Sticker Verification in Progress',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F3260)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _backScanProgressStatus,
                    style: TextStyle(fontSize: 11, color: context.textSec, height: 1.3),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_backScanError != null && _stickerResult == null) {
      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.error.withOpacity(0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'OCR Sticker Scan Incomplete',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.error),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _backScanError!,
              style: TextStyle(fontSize: 12, color: context.textSec),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () {
                if (_backProcessedBytes != null) _scanBackSticker(_backProcessedBytes!);
              },
              icon: const Icon(LucideIcons.refreshCw, size: 14),
              label: const Text('Retry OCR Sticker Scan'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F3260),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      );
    }

    if (_stickerResult != null) {
      final res = _stickerResult!;
      final bool isBirthdateValid = res.birthdateMatches != false;
      final isValid = res.isValid && isBirthdateValid;

      return Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isValid ? const Color(0xFF10B981).withOpacity(0.08) : AppTheme.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isValid ? const Color(0xFF10B981).withOpacity(0.4) : AppTheme.error.withOpacity(0.4),
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isValid ? LucideIcons.shieldCheck : LucideIcons.alertOctagon,
                  color: isValid ? const Color(0xFF10B981) : AppTheme.error,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isValid ? 'Back ID Verified & Approved' : (isBirthdateValid ? res.termValidation.statusTitle : 'Birthdate Mismatch'),
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: isValid ? const Color(0xFF10B981) : AppTheme.error,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isValid ? const Color(0xFF10B981) : AppTheme.error,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isValid ? 'VALIDATED' : 'ACTION REQUIRED',
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                if (res.stickerFound) ...[
                  _buildStickerInfoPill('Detected AY', res.academicYear ?? 'Unknown', res.termValidation.yearMatches ? const Color(0xFF10B981) : AppTheme.error),
                  _buildStickerInfoPill('Semester', res.semester ?? 'Unknown', res.termValidation.semesterMatches ? const Color(0xFF10B981) : AppTheme.error),
                ],
                if (res.birthdate != null)
                  _buildStickerInfoPill('Birthdate', res.birthdate!, res.birthdateMatches == true ? const Color(0xFF10B981) : AppTheme.error),
                if (res.hasValidationStamp)
                  _buildStickerInfoPill('Auth', 'Registrar Validated', const Color(0xFF10B981)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              isBirthdateValid
                  ? res.termValidation.message
                  : 'The birthdate on your school ID (${res.birthdate}) does not match your registered information. Please check your ID and try again.',
              style: TextStyle(fontSize: 12, color: context.textPri, height: 1.35),
            ),
            if (!isValid) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _adjustCrop(false),
                      icon: const Icon(LucideIcons.crop, size: 14),
                      label: const Text('Adjust / Crop'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: context.textPri,
                        side: BorderSide(color: context.crispBorder),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _promptImageSource(false),
                      icon: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
                      label: const Text('Retake Back ID'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.error,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildStickerInfoPill(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: RichText(
        text: TextSpan(
          text: '$label: ',
          style: TextStyle(fontSize: 11, color: context.textSec, fontWeight: FontWeight.bold),
          children: [
            TextSpan(
              text: value,
              style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKYCRequirementsList() {
    final items = [
      'Ensure the ID card is centered and fully fits the frame grid.',
      'Maintain clear focus and verify that all text/details are legible.',
      'Find a well-lit location to capture with zero glare or shadows.',
      'Hold your phone steady when capturing to avoid motion blur.'
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.crispBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.info, color: context.isDark ? Colors.blue : const Color(0xFF0F3260), size: 16),
              const SizedBox(width: 8),
              const Text(
                'CAPTURE GUIDELINES',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(LucideIcons.checkCircle, color: Color(0xFF10B981), size: 14),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item,
                        style: TextStyle(fontSize: 12, color: context.textSec, height: 1.3),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildSignatureStepWidget() {
    return SingleChildScrollView(
      key: const ValueKey(2),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Step 3: Digital Signature',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: context.textPri),
              ),
              TextButton.icon(
                onPressed: () => setState(() => _signatureController.clear()),
                icon: const Icon(LucideIcons.eraser, size: 14, color: AppTheme.error),
                label: const Text('Clear', style: TextStyle(color: AppTheme.error, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Draw your official specimen signature in the box below. It must match your primary government-issued ID card.',
            style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
          ),
          const SizedBox(height: 24),
          
          // Drawing signature box
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _signatureController.isNotEmpty ? const Color(0xFF10B981) : context.crispBorder,
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Signature(
                controller: _signatureController,
                height: 200,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Use your finger or stylus inside the specimen border block.',
            style: TextStyle(fontSize: 11, color: context.textSec, fontStyle: FontStyle.italic),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildReviewStepWidget() {
    final bool hasBlurry = _frontQuality?.isBlurry == true || _backQuality?.isBlurry == true;
    final bool hasNameMismatch = _frontNameResult != null && !_frontNameResult!.isNameMatch;
    final bool hasInvalidSticker = _stickerResult != null && (!_stickerResult!.isValid || _stickerResult!.birthdateMatches == false);
    final bool isBlocked = hasBlurry || hasNameMismatch || hasInvalidSticker || _isScanningSticker || _isScanningFrontName;

    return SingleChildScrollView(
      key: const ValueKey(3),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Step 4: Review Captures',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: context.textPri),
          ),
          const SizedBox(height: 8),
          Text(
            'Please review your document photographs, quality assessments, and signature before generating the submission packet.',
            style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
          ),
          const SizedBox(height: 24),

          // Name Mismatch Warning Banner
          if (hasNameMismatch)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.error.withOpacity(0.4), width: 1.5),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.userX, color: AppTheme.error, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Submission Blocked: Front ID Name Mismatch',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.error),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'The name on your school ID does not match your registered profile. Please retake or adjust crop.',
                          style: TextStyle(fontSize: 11, color: context.textPri, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Blurry Warning Banner if any scan is blurry
          if (hasBlurry)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.error.withOpacity(0.4), width: 1.5),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.alertTriangle, color: AppTheme.error, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Submission Blocked: Blurry ID Scan',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.error),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'You cannot submit requirements because your ${_frontQuality?.isBlurry == true && _backQuality?.isBlurry == true ? "Front and Back" : (_frontQuality?.isBlurry == true ? "Front" : "Back")} ID photo is blurry. Please retake it to proceed.',
                          style: TextStyle(fontSize: 11, color: context.textPri, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Validation Sticker Alert Banner if invalid or mismatched
          if (hasInvalidSticker)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.error.withOpacity(0.4), width: 1.5),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.alertOctagon, color: AppTheme.error, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Submission Blocked: ${_stickerResult!.termValidation.statusTitle}',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.error),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _stickerResult!.termValidation.message,
                          style: TextStyle(fontSize: 11, color: context.textPri, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // ID Front & Back side by side cards
          Row(
            children: [
              Expanded(
                child: _buildCapturedThumbnailCard('Front ID', _frontImage, _frontQuality, 0),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildCapturedThumbnailCard('Back ID', _backImage, _backQuality, 1),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Signature specimen thumbnail
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: context.surfaceC,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: context.crispBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Signature Specimen',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Verified specimen drawn.',
                        style: TextStyle(color: context.textSec, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() => _currentStep = 2),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F3260).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Edit',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F3260)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          
          // Action button
          if (isBlocked)
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  if (_frontQuality?.isBlurry == true) {
                    _currentStep = 0;
                  } else {
                    _currentStep = 1;
                  }
                });
              },
              icon: const Icon(LucideIcons.refreshCw, color: Colors.white, size: 18),
              label: Text(
                hasBlurry
                    ? 'RETAKE BLURRY SCANS TO PROCEED'
                    : 'RETAKE BACK ID (STICKER ISSUE)',
                style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.error,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            )
          else
            ElevatedButton.icon(
              onPressed: _isGeneratingPdf ? null : _generatePdf,
              icon: _isGeneratingPdf
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(LucideIcons.fileText, color: Colors.white, size: 18),
              label: Text(
                _isGeneratingPdf ? 'GENERATING PDF...' : 'GENERATE & PREVIEW PDF',
                style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F3260),
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCapturedThumbnailCard(
    String label,
    XFile? image,
    ImageQualityResult? quality,
    int targetStep,
  ) {
    final bool isBlurry = quality?.isBlurry == true;
    final bool isClear = quality != null && !quality.isBlurry;
    final bool isBack = targetStep == 1;

    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: (isBlurry || (isBack && _stickerResult != null && !_stickerResult!.isValid))
              ? AppTheme.error
              : (isClear ? const Color(0xFF10B981) : context.crispBorder),
          width: (isBlurry || (isBack && _stickerResult != null && !_stickerResult!.isValid)) ? 2.0 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: SizedBox(
              height: 110,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (image != null)
                    Image.file(File(image.path), fit: BoxFit.cover)
                  else
                    const Center(child: Icon(LucideIcons.camera)),
                  if (isBlurry)
                    Container(
                      color: AppTheme.error.withOpacity(0.35),
                      alignment: Alignment.center,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.error,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'BLURRY',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  if (isBack && _stickerResult != null && !_stickerResult!.isValid)
                    Container(
                      color: AppTheme.error.withOpacity(0.35),
                      alignment: Alignment.center,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.error,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'STICKER MISMATCH',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        quality != null
                            ? (isBlurry ? '⚠️ Blurry' : '✓ ${quality.sharpnessPercent}% Sharp')
                            : 'Pending',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isBlurry
                              ? AppTheme.error
                              : (isClear ? const Color(0xFF10B981) : context.textSec),
                        ),
                      ),
                      if (isBack && _stickerResult != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _stickerResult!.isValid
                              ? '✓ AY ${_stickerResult!.academicYear ?? ""}'
                              : '⚠️ ${_stickerResult!.termValidation.statusTitle}',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: _stickerResult!.isValid ? const Color(0xFF10B981) : AppTheme.error,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() => _currentStep = targetStep),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: (isBlurry || (isBack && _stickerResult != null && !_stickerResult!.isValid))
                          ? AppTheme.error.withOpacity(0.12)
                          : const Color(0xFF0F3260).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Retake',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: (isBlurry || (isBack && _stickerResult != null && !_stickerResult!.isValid))
                            ? AppTheme.error
                            : const Color(0xFF0F3260),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationFooter() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.surfaceC,
        border: Border(top: BorderSide(color: context.crispBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Back Button
          if (_currentStep > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: _prevStep,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: BorderSide(color: context.crispBorder),
                  foregroundColor: context.textPri,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Back', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            )
          else
            const Spacer(),
          
          if (_currentStep > 0) const SizedBox(width: 16),
          
          // Next/Review Button
          if (_currentStep < 3)
            Expanded(
              child: Builder(
                builder: (context) {
                  final bool isCurrentBlurry = (_currentStep == 0 && _frontQuality?.isBlurry == true) ||
                      (_currentStep == 1 && _backQuality?.isBlurry == true);

                  if (isCurrentBlurry) {
                    return ElevatedButton.icon(
                      onPressed: () => _captureImage(_currentStep == 0),
                      icon: const Icon(LucideIcons.camera, size: 16, color: Colors.white),
                      label: Text(
                        'Retake ${_currentStep == 0 ? "Front" : "Back"} ID',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.error,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    );
                  }

                  return ElevatedButton(
                    onPressed: _nextStep,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F3260),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      _currentStep == 2 ? 'Review All' : 'Next Step',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  );
                },
              ),
            )
          else
            const SizedBox.shrink(),
        ],
      ),
    );
  }

  Widget _buildPdfReviewScreen() {
    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Confirm PDF Details', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: context.isDark ? const Color(0xFF1E293B) : const Color(0xFF0F3260),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () {
            setState(() {
              _showPreview = false;
            });
          },
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: PdfPreview(
              build: (format) => _generatedPdfBytes!,
              useActions: false,
              allowPrinting: false,
              allowSharing: false,
              canChangePageFormat: false,
              canChangeOrientation: false,
            ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: context.surfaceC,
              border: Border(
                top: BorderSide(color: context.crispBorder),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _showPreview = false;
                      });
                    },
                    icon: const Icon(LucideIcons.refreshCw, size: 14),
                    label: const Text('Edit / Retake'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: context.crispBorder),
                      foregroundColor: context.textPri,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      if (_frontQuality?.isBlurry == true || _backQuality?.isBlurry == true) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Cannot submit: One or more ID scans are blurry.'),
                            backgroundColor: AppTheme.error,
                          ),
                        );
                        return;
                      }
                      if (_frontNameResult != null && !_frontNameResult!.isNameMatch) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Cannot submit: The name on your school ID does not match your registered profile.'),
                            backgroundColor: AppTheme.error,
                          ),
                        );
                        return;
                      }
                      if (_stickerResult != null) {
                        final bool isBirthdateValid = _stickerResult!.birthdateMatches != false;
                        if (!_stickerResult!.isValid || !isBirthdateValid) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Cannot submit: Back ID validation sticker or birthdate mismatch.'),
                              backgroundColor: AppTheme.error,
                            ),
                          );
                          return;
                        }
                      }
                      final frontBytes = _frontProcessedBytes ?? (_frontImage != null ? await _frontImage!.readAsBytes() : null);
                      final backBytes = _backProcessedBytes ?? (_backImage != null ? await _backImage!.readAsBytes() : null);
                      Navigator.pop(context, {
                        'bytes': _generatedPdfBytes,
                        'fileName': 'ID_Submission_${DateTime.now().millisecondsSinceEpoch}.pdf',
                        'frontBytes': frontBytes,
                        'backBytes': backBytes,
                        'stickerResult': _stickerResult,
                        'academicYear': _stickerResult?.academicYear ?? AcademicTermService.currentTerm.academicYear,
                        'semester': _stickerResult?.semester ?? AcademicTermService.currentTerm.semester,
                        'stickerValidated': _stickerResult?.isValid == true,
                        'frontNameMatches': _frontNameResult?.isNameMatch == true,
                        'frontExtractedName': _frontNameResult?.extractedName,
                        'backBirthdate': _stickerResult?.birthdate,
                        'backBirthdateMatches': _stickerResult?.birthdateMatches == true,
                      });
                    },
                    icon: const Icon(LucideIcons.check, size: 14),
                    label: const Text('Submit Packet'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingOverlay(String msg) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFF0F3260)),
            const SizedBox(height: 20),
            Text(
              msg,
              style: TextStyle(color: context.textSec, fontWeight: FontWeight.w600, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
