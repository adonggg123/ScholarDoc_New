import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'dart:typed_data';
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
  
  final SignatureController _signatureController1 = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.transparent,
  );
  final SignatureController _signatureController2 = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.transparent,
  );
  final SignatureController _signatureController3 = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.transparent,
  );

  bool _isGeneratingPdf = false;
  Uint8List? _generatedPdfBytes;
  bool _showPreview = false;

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
          SnackBar(content: Text('Failed to capture image: $e')),
        );
      }
    }
  }

  Future<void> _generateAndReturnPdf() async {
    if (_frontImage == null || 
        _backImage == null || 
        _signatureController1.isEmpty || 
        _signatureController2.isEmpty || 
        _signatureController3.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete all capture and signature steps before generating the PDF.')),
      );
      return;
    }

    setState(() {
      _isGeneratingPdf = true;
    });

    try {
      final pdf = pw.Document();

      // Load image bytes
      final frontBytes = await _frontImage!.readAsBytes();
      final backBytes = await _backImage!.readAsBytes();
      
      final pw.MemoryImage frontPwImage = pw.MemoryImage(frontBytes);
      final pw.MemoryImage backPwImage = pw.MemoryImage(backBytes);

      // Export signature to bytes
      final sigBytes1 = await _signatureController1.toPngBytes();
      final sigBytes2 = await _signatureController2.toPngBytes();
      final sigBytes3 = await _signatureController3.toPngBytes();

      pw.MemoryImage? sigPwImage1 = sigBytes1 != null ? pw.MemoryImage(sigBytes1) : null;
      pw.MemoryImage? sigPwImage2 = sigBytes2 != null ? pw.MemoryImage(sigBytes2) : null;
      pw.MemoryImage? sigPwImage3 = sigBytes3 != null ? pw.MemoryImage(sigBytes3) : null;

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          build: (pw.Context context) {
            return [
              pw.Header(
                level: 0,
                child: pw.Text('Document Submission', style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
              ),
              pw.SizedBox(height: 20),
              
              // Front ID
              pw.Text('ID Front', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              pw.Container(
                alignment: pw.Alignment.center,
                height: 200,
                child: pw.Image(frontPwImage, fit: pw.BoxFit.contain),
              ),
              pw.SizedBox(height: 24),
              
              // Back ID
              pw.Text('ID Back', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              pw.Container(
                alignment: pw.Alignment.center,
                height: 200,
                child: pw.Image(backPwImage, fit: pw.BoxFit.contain),
              ),
              pw.SizedBox(height: 24),
              
              // Signature
              pw.Text('Specimen Signatures', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
                children: [
                  pw.Column(
                    children: [
                      if (sigPwImage1 != null)
                        pw.Container(
                          alignment: pw.Alignment.center,
                          width: 150,
                          height: 70,
                          decoration: pw.BoxDecoration(
                            border: pw.Border.all(color: PdfColors.grey300, width: 1),
                          ),
                          child: pw.Image(sigPwImage1, fit: pw.BoxFit.contain),
                        ),
                      pw.SizedBox(height: 4),
                      pw.Text('Signature 1', style: pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
                    ],
                  ),
                  pw.Column(
                    children: [
                      if (sigPwImage2 != null)
                        pw.Container(
                          alignment: pw.Alignment.center,
                          width: 150,
                          height: 70,
                          decoration: pw.BoxDecoration(
                            border: pw.Border.all(color: PdfColors.grey300, width: 1),
                          ),
                          child: pw.Image(sigPwImage2, fit: pw.BoxFit.contain),
                        ),
                      pw.SizedBox(height: 4),
                      pw.Text('Signature 2', style: pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
                    ],
                  ),
                  pw.Column(
                    children: [
                      if (sigPwImage3 != null)
                        pw.Container(
                          alignment: pw.Alignment.center,
                          width: 150,
                          height: 70,
                          decoration: pw.BoxDecoration(
                            border: pw.Border.all(color: PdfColors.grey300, width: 1),
                          ),
                          child: pw.Image(sigPwImage3, fit: pw.BoxFit.contain),
                        ),
                      pw.SizedBox(height: 4),
                      pw.Text('Signature 3', style: pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 16),
              pw.Divider(),
              pw.SizedBox(height: 10),
              pw.Text('Generated by ScholarDoc App', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey)),
            ];
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
          SnackBar(content: Text('Failed to generate PDF: $e')),
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

  @override
  void dispose() {
    _signatureController1.dispose();
    _signatureController2.dispose();
    _signatureController3.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_showPreview && _generatedPdfBytes != null) {
      return Scaffold(
        backgroundColor: context.bgC,
        appBar: AppBar(
          title: const Text('Review PDF Submission', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: AppTheme.primaryColor,
          foregroundColor: Colors.white,
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
                      icon: const Icon(LucideIcons.refreshCw, size: 16),
                      label: const Text('Retry / Edit'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: AppTheme.primaryColor),
                        foregroundColor: AppTheme.primaryColor,
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
                      icon: const Icon(LucideIcons.check, size: 16),
                      label: const Text('Confirm & Use'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
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

    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Capture ID & Signature', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: _isGeneratingPdf
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Generating PDF document...'),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Step 1: ID Front',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  _buildImagePreview(
                    image: _frontImage,
                    onTap: () => _captureImage(true),
                    label: 'Capture Front of ID',
                  ),
                  const SizedBox(height: 24),
                  
                  const Text(
                    'Step 2: ID Back',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  _buildImagePreview(
                    image: _backImage,
                    onTap: () => _captureImage(false),
                    label: 'Capture Back of ID',
                  ),
                  const SizedBox(height: 24),

                  _buildSignaturePad(
                    stepLabel: 'Step 3: Specimen Signature 1',
                    controller: _signatureController1,
                    onClear: () => _signatureController1.clear(),
                  ),
                  const SizedBox(height: 24),
                  _buildSignaturePad(
                    stepLabel: 'Step 4: Specimen Signature 2',
                    controller: _signatureController2,
                    onClear: () => _signatureController2.clear(),
                  ),
                  const SizedBox(height: 24),
                  _buildSignaturePad(
                    stepLabel: 'Step 5: Specimen Signature 3',
                    controller: _signatureController3,
                    onClear: () => _signatureController3.clear(),
                  ),
                  
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _generateAndReturnPdf,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Generate & Use Document',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSignaturePad({
    required String stepLabel,
    required SignatureController controller,
    required VoidCallback onClear,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              stepLabel,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            TextButton.icon(
              onPressed: onClear,
              icon: const Icon(LucideIcons.eraser, size: 16),
              label: const Text('Clear'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Signature(
            controller: controller,
            height: 120,
            backgroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Please sign in the box above.',
          style: TextStyle(fontSize: 12, color: context.textSec),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildImagePreview({XFile? image, required VoidCallback onTap, required String label}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 160,
        decoration: BoxDecoration(
          color: context.surfaceC,
          border: Border.all(color: context.crispBorder),
          borderRadius: BorderRadius.circular(12),
        ),
        child: image == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.camera, size: 40, color: AppTheme.primaryColor.withValues(alpha: 0.5)),
                  const SizedBox(height: 8),
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
                ],
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    // Ignoring FutureBuilder for bytes since XFile path might not work on web,
                    // but since this is camera on mobile, path works. However, for cross-platform
                    // FutureBuilder reading bytes is better.
                    child: FutureBuilder<Uint8List>(
                      future: image.readAsBytes(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        if (snapshot.hasData) {
                          return Image.memory(snapshot.data!, fit: BoxFit.cover);
                        }
                        return const Center(child: Icon(Icons.error));
                      },
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(LucideIcons.refreshCw, color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
