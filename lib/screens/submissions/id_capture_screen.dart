import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'dart:typed_data';
import 'dart:io';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

class IDCaptureScreen extends StatefulWidget {
  const IDCaptureScreen({super.key});

  @override
  State<IDCaptureScreen> createState() => _IDCaptureScreenState();
}

class _IDCaptureScreenState extends State<IDCaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  
  XFile? _frontImage;
  XFile? _backImage;
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

  Future<void> _captureImage(bool isFront) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (image != null) {
        setState(() {
          if (isFront) {
            _frontImage = image;
          } else {
            _backImage = image;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to capture image: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  Future<void> _generatePdf() async {
    if (_frontImage == null || _backImage == null || _signatureController.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please complete all 3 captures before review.'),
          backgroundColor: AppTheme.warning,
        ),
      );
      return;
    }

    setState(() {
      _isGeneratingPdf = true;
    });

    try {
      final pdf = pw.Document();
      final frontBytes = await _frontImage!.readAsBytes();
      final backBytes = await _backImage!.readAsBytes();
      
      final pw.MemoryImage frontPwImage = pw.MemoryImage(frontBytes);
      final pw.MemoryImage backPwImage = pw.MemoryImage(backBytes);

      final signatureBytes = await _signatureController.toPngBytes();
      pw.MemoryImage? signaturePwImage;
      if (signatureBytes != null) {
        signaturePwImage = pw.MemoryImage(signatureBytes);
      }

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
    if (_currentStep == 0 && _frontImage == null) {
      _showWarning('Please capture the front side of your ID.');
      return;
    }
    if (_currentStep == 1 && _backImage == null) {
      _showWarning('Please capture the back side of your ID.');
      return;
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
          instruction: 'Place the front side of your ID card inside the frame guide below. Ensure all text, photo, and markings are clearly visible with zero glare.',
          image: _frontImage,
          onTap: () => _captureImage(true),
          label: 'Capture Front Side',
        );
      case 1:
        return _buildCaptureStepWidget(
          title: 'Step 2: Back of ID Card',
          instruction: 'Turn your ID card over and align the back side inside the frame guide below. The text, barcodes, and details must be readable.',
          image: _backImage,
          onTap: () => _captureImage(false),
          label: 'Capture Back Side',
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
    required VoidCallback onTap,
    required String label,
  }) {
    return SingleChildScrollView(
      key: ValueKey(_currentStep),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: context.textPri),
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
                  color: image != null ? const Color(0xFF10B981) : context.crispBorder,
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(context.isDark ? 0.2 : 0.03),
                    blurRadius: 10,
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
                          // Graphic Camera Placeholder Guide
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
                          // Aspect Dotted Card Alignment Mask
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
                          // Completed checkmark overlay
                          Container(
                            color: Colors.black26,
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
                          Positioned(
                            bottom: 12,
                            right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                children: [
                                  Icon(LucideIcons.refreshCw, color: Colors.white, size: 12),
                                  SizedBox(width: 6),
                                  Text(
                                    'Retake',
                                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
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
          
          const SizedBox(height: 24),
          // Checklist guides
          _buildKYCRequirementsList(),
        ],
      ),
    );
  }

  Widget _buildKYCRequirementsList() {
    final items = [
      'Ensure the ID card is centered and fully fits the frame grid.',
      'Maintain clear focus and verify that all text/details are legible.',
      'Find a well-lit location to capture with zero glare or shadows.'
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
            'Please review your document photographs and signature layout before generating the submission packet.',
            style: TextStyle(fontSize: 13, color: context.textSec, height: 1.4),
          ),
          const SizedBox(height: 24),

          // ID Front & Back side by side cards
          Row(
            children: [
              Expanded(
                child: _buildCapturedThumbnailCard('Front ID', _frontImage, 0),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildCapturedThumbnailCard('Back ID', _backImage, 1),
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
          ElevatedButton.icon(
            onPressed: _generatePdf,
            icon: const Icon(LucideIcons.fileText, color: Colors.white, size: 18),
            label: const Text(
              'GENERATE & PREVIEW PDF',
              style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
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

  Widget _buildCapturedThumbnailCard(String label, XFile? image, int targetStep) {
    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.crispBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: SizedBox(
              height: 110,
              child: image != null
                  ? Image.file(File(image.path), fit: BoxFit.cover)
                  : const Center(child: Icon(LucideIcons.camera)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
                GestureDetector(
                  onTap: () => setState(() => _currentStep = targetStep),
                  child: Icon(LucideIcons.edit2, size: 14, color: context.textSec),
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
              child: ElevatedButton(
                onPressed: _nextStep,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F3260),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Next Step', style: TextStyle(fontWeight: FontWeight.bold)),
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
                    onPressed: () {
                      Navigator.pop(context, {
                        'bytes': _generatedPdfBytes,
                        'fileName': 'ID_Submission_${DateTime.now().millisecondsSinceEpoch}.pdf',
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
