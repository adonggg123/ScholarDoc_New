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

class IDCaptureScreen extends StatefulWidget {
  const IDCaptureScreen({super.key});

  @override
  State<IDCaptureScreen> createState() => _IDCaptureScreenState();
}

class _IDCaptureScreenState extends State<IDCaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  
  XFile? _frontImage;
  XFile? _backImage;
  ImageQualityResult? _frontQuality;
  ImageQualityResult? _backQuality;
  bool _isAnalyzingFront = false;
  bool _isAnalyzingBack = false;

  StickerScanResult? _stickerResult;
  bool _isScanningSticker = false;
  bool _stickerOverriddenForAdmin = false;

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
    // Re-initialize controller listener to refresh state on draw events
    _signatureController.onDrawStart = () {
      setState(() {});
    };
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
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (image == null) return;

      setState(() {
        if (isFront) {
          _frontImage = image;
          _isAnalyzingFront = true;
          _frontQuality = null;
        } else {
          _backImage = image;
          _isAnalyzingBack = true;
          _backQuality = null;
        }
      });

      // Analyze image sharpness / blurriness
      final bytes = await image.readAsBytes();
      final quality = await ImageQualityService.analyzeQuality(bytes);

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
        if (!isFront) {
          // Trigger Google Document AI sticker scan on the upper back of ID
          _scanBackSticker(bytes);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(LucideIcons.checkCircle, color: Colors.white, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Front ID scan is sharp & clear (${quality.sharpnessPercent}% clarity).',
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
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
            content: Text('Failed to capture image: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
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
      _stickerResult = null;
    });

    try {
      // 1. Scan the captured image directly (fast, preserves full context without cropping off sticker)
      var result = await DocumentAIScannerService.scanIdBackSticker(bytes);

      // 2. Fallback: if sticker cues weren't found on the full image, try the cropped upper 52% ROI
      if (!result.stickerFound) {
        final roiBytes = await DocumentAIScannerService.cropUpperStickerROI(bytes);
        final roiResult = await DocumentAIScannerService.scanIdBackSticker(roiBytes);
        if (roiResult.stickerFound) {
          result = roiResult;
        }
      }

      if (!mounted) return;

      setState(() {
        _isScanningSticker = false;
        _stickerResult = result;
      });

      if (!result.isValid) {
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
                    'Validation Sticker Verified: ${result.semester ?? ""} AY ${result.academicYear ?? ""}',
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
        });
        debugPrint('Error scanning sticker: $e');
      }
    }
  }

  void _showStickerWarningDialog(StickerScanResult result) {
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
                result.termValidation.statusTitle,
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
              result.termValidation.message,
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
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.error),
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
                color: (result.termValidation.statusTitle.contains('Offline'))
                    ? const Color(0xFFF59E0B).withOpacity(0.08)
                    : AppTheme.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    result.termValidation.statusTitle.contains('Offline')
                        ? LucideIcons.info
                        : LucideIcons.shieldAlert,
                    size: 16,
                    color: result.termValidation.statusTitle.contains('Offline')
                        ? const Color(0xFFF59E0B)
                        : AppTheme.error,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      result.termValidation.statusTitle.contains('Offline')
                          ? 'Document AI service is offline. You may proceed with manual Admin verification.'
                          : 'If your physical sticker is valid and affixed, you may confirm and proceed for Admin inspection.',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: result.termValidation.statusTitle.contains('Offline')
                            ? const Color(0xFFB45309)
                            : AppTheme.error,
                      ),
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
              _promptImageSource(false);
            },
            icon: const Icon(LucideIcons.camera, size: 14, color: AppTheme.error),
            label: const Text('Retake'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.error,
              side: BorderSide(color: AppTheme.error.withOpacity(0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _stickerOverriddenForAdmin = true;
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Row(
                    children: [
                      Icon(LucideIcons.shieldCheck, color: Colors.white, size: 18),
                      SizedBox(width: 8),
                      Expanded(child: Text('Sticker flagged for manual Admin validation.')),
                    ],
                  ),
                  backgroundColor: Color(0xFF10B981),
                  behavior: SnackBarBehavior.floating,
                ),
              );
              _nextStep();
            },
            icon: const Icon(LucideIcons.checkCheck, size: 14, color: Colors.white),
            label: const Text('Confirm & Proceed'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _generatePdf() async {
    if (_frontImage == null || _backImage == null || _signatureController.isEmpty) {
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

    if (_stickerResult != null && !_stickerResult!.isValid && !_stickerOverriddenForAdmin) {
      _showWarning('Cannot compile PDF: Validation sticker does not match current school period.');
      _showStickerWarningDialog(_stickerResult!);
      return;
    }

    setState(() {
      _isGeneratingPdf = true;
    });

    try {
      // Small delay to allow UI to paint loading spinner smoothly
      await Future.delayed(const Duration(milliseconds: 50));

      final rawFrontBytes = await _frontImage!.readAsBytes();
      final rawBackBytes = await _backImage!.readAsBytes();
      
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
      if (_frontImage == null) {
        _showWarning('Please capture the front side of your ID.');
        return;
      }
      if (_isAnalyzingFront) {
        _showWarning('Analyzing front ID clarity, please wait a moment...');
        return;
      }
      if (_frontQuality?.isBlurry == true) {
        _showWarning('Cannot proceed: Front ID photo is blurry. Please retake a sharper scan.');
        _showBlurWarningDialog(isFront: true, quality: _frontQuality!);
        return;
      }
    }
    if (_currentStep == 1) {
      if (_backImage == null) {
        _showWarning('Please capture the back side of your ID.');
        return;
      }
      if (_isAnalyzingBack) {
        _showWarning('Analyzing back ID clarity, please wait a moment...');
        return;
      }
      if (_backQuality?.isBlurry == true) {
        _showWarning('Cannot proceed: Back ID photo is blurry. Please retake a sharper scan.');
        _showBlurWarningDialog(isFront: false, quality: _backQuality!);
        return;
      }
      if (_isScanningSticker) {
        _showWarning('Google Document AI is currently verifying your validation sticker, please wait...');
        return;
      }
      if (_stickerResult != null && !_stickerResult!.isValid && !_stickerOverriddenForAdmin) {
        _showWarning('Cannot proceed: The ID validation sticker does not match the active academic period.');
        _showStickerWarningDialog(_stickerResult!);
        return;
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
                child: image == null
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
                          Image.file(File(image.path), fit: BoxFit.cover),
                          
                          // Analyzing overlay
                          if (isAnalyzing)
                            Container(
                              color: Colors.black54,
                              child: const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircularProgressIndicator(
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    strokeWidth: 2.5,
                                  ),
                                  SizedBox(height: 12),
                                  Text(
                                    'Analyzing image sharpness...',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
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
                          if (!isAnalyzing && isClear)
                            Container(
                              color: Colors.black12,
                              alignment: Alignment.center,
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(LucideIcons.check, color: Colors.white, size: 28),
                              ),
                            ),

                          // Bottom action badge (Retake / Change)
                          Positioned(
                            bottom: 12,
                            right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                                children: [
                                  Icon(
                                    isBlurry ? LucideIcons.alertTriangle : LucideIcons.refreshCw,
                                    color: Colors.white,
                                    size: 13,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    isBlurry ? 'Retake Blurry Photo' : 'Retake',
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

          // Document AI Sticker Verification Widget for Back ID
          if (!isFront) _buildBackStickerStatusWidget(),

          const SizedBox(height: 24),
          _buildKYCRequirementsList(),
        ],
      ),
    );
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
                    'Document AI Verification in Progress',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F3260)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Scanning upper back portion of ID for semester and academic year sticker...',
                    style: TextStyle(fontSize: 11, color: context.textSec, height: 1.3),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_stickerResult != null) {
      final res = _stickerResult!;
      final isValid = res.isValid;

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
                    isValid ? 'Validation Sticker Approved' : res.termValidation.statusTitle,
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
            if (res.stickerFound) ...[
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  _buildStickerInfoPill('Detected AY', res.academicYear ?? 'Unknown', isValid ? const Color(0xFF10B981) : AppTheme.error),
                  _buildStickerInfoPill('Semester', res.semester ?? 'Unknown', isValid ? const Color(0xFF10B981) : AppTheme.error),
                  if (res.hasValidationStamp)
                    _buildStickerInfoPill('Auth', 'Registrar Validated', const Color(0xFF10B981)),
                ],
              ),
              const SizedBox(height: 8),
            ],
            Text(
              res.termValidation.message,
              style: TextStyle(fontSize: 12, color: context.textPri, height: 1.35),
            ),
            if (!isValid) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _promptImageSource(false),
                  icon: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
                  label: const Text('Retake Back ID with Current Sticker'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.error,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
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
    final bool hasInvalidSticker = _stickerResult != null && !_stickerResult!.isValid;
    final bool isBlocked = hasBlurry || hasInvalidSticker || _isScanningSticker;

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
                      if (_stickerResult != null && !_stickerResult!.isValid && !_stickerOverriddenForAdmin) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Cannot submit: ${_stickerResult!.termValidation.statusTitle}.'),
                            backgroundColor: AppTheme.error,
                          ),
                        );
                        return;
                      }
                      final frontBytes = _frontImage != null ? await _frontImage!.readAsBytes() : null;
                      final backBytes = _backImage != null ? await _backImage!.readAsBytes() : null;
                      Navigator.pop(context, {
                        'bytes': _generatedPdfBytes,
                        'fileName': 'ID_Submission_${DateTime.now().millisecondsSinceEpoch}.pdf',
                        'frontBytes': frontBytes,
                        'backBytes': backBytes,
                        'stickerResult': _stickerResult,
                        'academicYear': _stickerResult?.academicYear ?? 'AY 2026-2027',
                        'semester': _stickerResult?.semester ?? '1st Semester',
                        'stickerValidated': _stickerResult?.isValid == true || _stickerOverriddenForAdmin,
                        'stickerOverriddenForAdmin': _stickerOverriddenForAdmin,
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
