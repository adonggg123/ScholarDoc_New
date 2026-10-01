import 'dart:io' show File;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/storage_service.dart';
import '../../services/notification_service.dart';
import '../../services/image_quality_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'id_capture_screen.dart';
import '../../services/academic_term_service.dart';

class UploadWorkflowScreen extends StatefulWidget {
  const UploadWorkflowScreen({super.key});

  @override
  State<UploadWorkflowScreen> createState() => _UploadWorkflowScreenState();
}

class _UploadWorkflowScreenState extends State<UploadWorkflowScreen> {
  int _currentStep = 0;

  bool _isUploading = false;
  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final StorageService _storageService = StorageService();
  final TextEditingController _saController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String? _submissionPdfUrl;
  String? _pdfFeedback;
  String? _pdfFileName;

  // ATM Card / Proof State
  String? _atmCardUrl;
  String? _atmCardFeedback;
  String? _atmCardFileName;
  Uint8List? _atmProofBytes;
  bool _atmProofIsPdf = false;

  // Deposit Slip State
  String? _depositSlipUrl;
  String? _depositSlipFeedback;
  String? _depositSlipFileName;
  Uint8List? _depositSlipBytes;
  bool _depositSlipIsPdf = false;

  final ImagePicker _imagePicker = ImagePicker();

  String? _idFrontUrl;
  String? _idBackUrl;

  String? _stickerAcademicYear;
  String? _stickerSemester;
  bool? _stickerValidated;
  bool? _stickerOverriddenForAdmin;

  @override
  void initState() {
    super.initState();
    _loadSA();
  }

  Future<void> _loadSA() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc != null) {
        final data = doc;
        final docs = (data['documents'] is Map) ? data['documents'] : {};
        setState(() {
          _saController.text = (data['saNumber'] ?? data['sa_number'] ?? docs['saNumber'] ?? docs['sa_number'] ?? '').toString();

          final existingAtm = data['atmCardUrl'] ?? data['atm_card_url'] ?? docs['atmCardUrl'] ?? docs['atm_card_url'];
          if (existingAtm != null && existingAtm.toString().isNotEmpty) {
            _atmCardUrl = existingAtm.toString();
            _atmCardFileName = (data['atmCardFileName'] ?? data['atm_card_file_name'] ?? docs['atmCardFileName'] ?? docs['atm_card_file_name'] ?? 'ATM_Proof.jpg').toString();
            _atmCardFeedback = "✅ ATM Proof Ready";
            _atmProofIsPdf = _atmCardFileName!.toLowerCase().endsWith('.pdf');
          }

          final existingDeposit = data['depositSlipUrl'] ?? data['deposit_slip_url'] ?? docs['depositSlipUrl'] ?? docs['deposit_slip_url'];
          if (existingDeposit != null && existingDeposit.toString().isNotEmpty) {
            _depositSlipUrl = existingDeposit.toString();
            _depositSlipFileName = (data['depositSlipFileName'] ?? data['deposit_slip_file_name'] ?? docs['depositSlipFileName'] ?? docs['deposit_slip_file_name'] ?? 'Deposit_Slip.jpg').toString();
            _depositSlipFeedback = "✅ Deposit Slip Ready";
            _depositSlipIsPdf = _depositSlipFileName!.toLowerCase().endsWith('.pdf');
          }
        });
      }
    }
  }

  @override
  void dispose() {
    _saController.dispose();
    super.dispose();
  }

  Future<void> _handleUpload() async {
    try {
      final result = await Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const IDCaptureScreen()),
      );

      if (result == null || result is! Map) return;
      
      final bytes = result['bytes'] as Uint8List?;
      final originalName = result['fileName'] as String?;

      if (bytes == null || originalName == null) return;

      setState(() {
        _isUploading = true;
        _pdfFeedback = null;
      });

      final uid = _authService.currentUser?.id;
      if (uid == null) throw Exception("User not authenticated");

      final String storagePath =
          'submissions/$uid/DOC_${DateTime.now().millisecondsSinceEpoch}_$originalName';
      final String downloadUrl = await _storageService.uploadFile(
        path: storagePath,
        bytes: bytes,
      );

      String? frontDownloadUrl;
      String? backDownloadUrl;
      final frontBytes = result['frontBytes'] as Uint8List?;
      if (frontBytes != null) {
        try {
          frontDownloadUrl = await _storageService.uploadFile(
            path: 'submissions/$uid/ID_FRONT_${DateTime.now().millisecondsSinceEpoch}.jpg',
            bytes: frontBytes,
          );
        } catch (e) {
          debugPrint('Error uploading front ID: $e');
        }
      }

      final backBytes = result['backBytes'] as Uint8List?;
      if (backBytes != null) {
        try {
          backDownloadUrl = await _storageService.uploadFile(
            path: 'submissions/$uid/ID_BACK_${DateTime.now().millisecondsSinceEpoch}.jpg',
            bytes: backBytes,
          );
        } catch (e) {
          debugPrint('Error uploading back ID: $e');
        }
      }

      if (!mounted) return;

      setState(() {
        _isUploading = false;
        _pdfFeedback = "✅ Document Ready";
        _pdfFileName = originalName;
        _submissionPdfUrl = downloadUrl;
        _idFrontUrl = frontDownloadUrl;
        _idBackUrl = backDownloadUrl;
        _stickerAcademicYear = result['academicYear'] as String?;
        _stickerSemester = result['semester'] as String?;
        _stickerValidated = result['stickerValidated'] as bool?;
        _stickerOverriddenForAdmin = result['stickerOverriddenForAdmin'] as bool?;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        _pdfFeedback = "Error: ${e.toString()}";
      });
    }
  }


  void _showDocumentSelectionSheet(String docType) {
    final bool isDeposit = docType == 'Deposit Slip';
    final IconData headerIcon = isDeposit ? LucideIcons.fileText : LucideIcons.creditCard;
    final String subtitleText = isDeposit
        ? 'Choose submission method for bank deposit slip or receipt'
        : 'Choose submission method for Landbank ATM card proof';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: BoxDecoration(
          color: context.bgC,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.18),
              blurRadius: 24,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F3260), Color(0xFF1E4E8C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F3260).withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(headerIcon, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        docType,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                          color: context.textPri,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitleText,
                        style: TextStyle(fontSize: 12, color: context.textSec),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),

            Text(
              'SUBMISSION METHOD',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: context.textSec,
              ),
            ),
            const SizedBox(height: 12),

            // Option 1: File Picker (Documents / PDF / Images)
            _buildMethodCard(
              title: 'Browse Files / Documents',
              subtitle: 'Select a PDF document or image file from your device',
              badgeText: 'Option 1: Files',
              badgeColor: const Color(0xFF2563EB),
              icon: LucideIcons.fileUp,
              iconBg: const Color(0xFF2563EB),
              onTap: () {
                Navigator.pop(ctx);
                _pickProofFromFile(docType);
              },
            ),
            const SizedBox(height: 12),

            // Option 2: Gallery Photo
            _buildMethodCard(
              title: 'Upload Photo from Gallery',
              subtitle: 'Choose an existing photo from your gallery',
              badgeText: 'Option 2: Gallery',
              badgeColor: const Color(0xFF10B981),
              icon: LucideIcons.image,
              iconBg: const Color(0xFF10B981),
              onTap: () {
                Navigator.pop(ctx);
                _pickProofFromGallery(docType);
              },
            ),
            const SizedBox(height: 12),

            // Option 3: Camera
            _buildMethodCard(
              title: 'Take Photo / Scan',
              subtitle: 'Use camera to take a photo of your $docType',
              badgeText: 'Option 3: Camera',
              badgeColor: const Color(0xFF0F3260),
              icon: LucideIcons.camera,
              iconBg: const Color(0xFF0F3260),
              onTap: () {
                Navigator.pop(ctx);
                _captureProofWithCamera(docType);
              },
            ),
            const SizedBox(height: 16),

            // Guidance Note
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFBC02D).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFBC02D).withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.info, size: 16, color: Color(0xFFB78103)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      isDeposit
                          ? 'Ensure the transaction date, deposit amount, and account number are clearly visible.'
                          : 'Ensure your full name and account number are sharply visible and not blurred.',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: context.textPri,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMethodCard({
    required String title,
    required String subtitle,
    required String badgeText,
    required Color badgeColor,
    required IconData icon,
    required Color iconBg,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.surfaceC,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.crispBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: iconBg.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconBg, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: context.textPri,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          badgeText,
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: badgeColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11.5, color: context.textSec),
                  ),
                ],
              ),
            ),
            Icon(LucideIcons.chevronRight, color: context.textSec, size: 18),
          ],
        ),
      ),
    );
  }

  Future<void> _pickProofFromFile(String docType) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      Uint8List? bytes = file.bytes;
      if (bytes == null && !kIsWeb && file.path != null) {
        try {
          bytes = await File(file.path!).readAsBytes();
        } catch (e) {
          debugPrint('Error reading file from path: $e');
        }
      }

      if (bytes == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not read file data. Please try another file.'),
            backgroundColor: AppTheme.error,
          ),
        );
        return;
      }

      final fileName = file.name.isNotEmpty
          ? file.name
          : '${docType.replaceAll(' ', '_')}_${DateTime.now().millisecondsSinceEpoch}';
      final bool isPdf = fileName.toLowerCase().endsWith('.pdf');

      ImageQualityResult? quality;
      if (!isPdf) {
        try {
          quality = await ImageQualityService.analyzeQuality(bytes);
        } catch (e) {
          debugPrint('Quality analysis skipped: $e');
        }
      }

      if (!mounted) return;

      _showProofPreviewSheet(
        bytes: bytes,
        fileName: fileName,
        docType: docType,
        sourceDescription: isPdf ? 'PDF File' : 'Document File',
        isPdf: isPdf,
        quality: quality,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to select file: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    }
  }

  Future<void> _pickProofFromGallery(String docType) async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
      );

      if (image == null) return;

      final bytes = await image.readAsBytes();
      final originalName = image.name.isNotEmpty
          ? image.name
          : '${docType.replaceAll(' ', '_')}_${DateTime.now().millisecondsSinceEpoch}.jpg';

      ImageQualityResult? quality;
      try {
        quality = await ImageQualityService.analyzeQuality(bytes);
      } catch (e) {
        debugPrint('Quality analysis error: $e');
      }

      if (!mounted) return;

      _showProofPreviewSheet(
        bytes: bytes,
        fileName: originalName,
        docType: docType,
        sourceDescription: 'Gallery',
        isPdf: false,
        quality: quality,
      );
    } catch (e) {
      debugPrint('Gallery picker error: $e. Falling back to FilePicker.');
      if (!mounted) return;
      _pickProofFromFile(docType);
    }
  }

  Future<void> _captureProofWithCamera(String docType) async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
      );

      if (image == null) return;

      final bytes = await image.readAsBytes();
      final originalName = image.name.isNotEmpty
          ? image.name
          : '${docType.replaceAll(' ', '_')}_${DateTime.now().millisecondsSinceEpoch}.jpg';

      ImageQualityResult? quality;
      try {
        quality = await ImageQualityService.analyzeQuality(bytes);
      } catch (e) {
        debugPrint('Quality analysis error: $e');
      }

      if (!mounted) return;

      _showProofPreviewSheet(
        bytes: bytes,
        fileName: originalName,
        docType: docType,
        sourceDescription: 'Camera',
        isPdf: false,
        quality: quality,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Camera unavailable: $e. You can use Browse Files instead.'),
          backgroundColor: AppTheme.error,
        ),
      );
    }
  }

  void _showProofPreviewSheet({
    required Uint8List bytes,
    required String fileName,
    required String docType,
    required String sourceDescription,
    required bool isPdf,
    ImageQualityResult? quality,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: BoxDecoration(
          color: context.bgC,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.18),
              blurRadius: 24,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        child: Column(
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Review $docType',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: context.textPri,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Confirm your document before uploading',
                        style: TextStyle(fontSize: 12, color: context.textSec),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F3260).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF0F3260).withOpacity(0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isPdf ? LucideIcons.fileText : LucideIcons.image,
                        size: 14,
                        color: const Color(0xFF0F3260),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        sourceDescription,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F3260),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Preview Container
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: context.crispBorder),
                ),
                child: isPdf
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(18),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444).withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  LucideIcons.fileText,
                                  size: 48,
                                  color: Color(0xFFEF4444),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                fileName,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: context.textPri,
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'PDF Document • ${(bytes.lengthInBytes / 1024).toStringAsFixed(1)} KB',
                                style: TextStyle(fontSize: 12, color: context.textSec),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Ready for Upload',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF059669),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Image.memory(
                          bytes,
                          fit: BoxFit.contain,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 14),

            // Quality indicator banner (if analyzed)
            if (quality != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: quality.isBlurry
                      ? const Color(0xFFEF4444).withOpacity(0.08)
                      : const Color(0xFF10B981).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: quality.isBlurry
                        ? const Color(0xFFEF4444).withOpacity(0.3)
                        : const Color(0xFF10B981).withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      quality.isBlurry ? LucideIcons.alertTriangle : LucideIcons.checkCircle,
                      size: 16,
                      color: quality.isBlurry ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        quality.isBlurry
                            ? 'Photo may be blurry (${quality.sharpnessPercent}% clarity). Please make sure account numbers are readable.'
                            : 'Sharp & clear scan (${quality.sharpnessPercent}% clarity). Ready for submission.',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: quality.isBlurry ? const Color(0xFFEF4444) : const Color(0xFF059669),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _showDocumentSelectionSheet(docType);
                      },
                      icon: const Icon(LucideIcons.refreshCw, size: 16),
                      label: const Text('Retake / Change', style: TextStyle(fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: context.textPri,
                        side: BorderSide(color: context.crispBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _uploadProofBytes(bytes, fileName, docType);
                      },
                      icon: const Icon(LucideIcons.check, size: 18),
                      label: Text('Confirm $docType', style: const TextStyle(fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F3260),
                        foregroundColor: Colors.white,
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _uploadProofBytes(Uint8List bytes, String originalName, String docType) async {
    final bool isDeposit = docType == 'Deposit Slip';
    setState(() {
      _isUploading = true;
      if (isDeposit) {
        _depositSlipFeedback = null;
      } else {
        _atmCardFeedback = null;
      }
    });

    try {
      final uid = _authService.currentUser?.id;
      if (uid == null) throw Exception("User not authenticated");

      final safeName = originalName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
      final prefix = isDeposit ? 'DEPOSIT' : 'ATM';
      final String storagePath =
          'submissions/$uid/${prefix}_${DateTime.now().millisecondsSinceEpoch}_$safeName';

      final String downloadUrl = await _storageService.uploadFile(
        path: storagePath,
        bytes: bytes,
      );

      if (!mounted) return;

      setState(() {
        _isUploading = false;
        final bool isPdf = originalName.toLowerCase().endsWith('.pdf');
        if (isDeposit) {
          _depositSlipFeedback = "✅ Deposit Slip Ready";
          _depositSlipFileName = originalName;
          _depositSlipUrl = downloadUrl;
          _depositSlipBytes = bytes;
          _depositSlipIsPdf = isPdf;
        } else {
          _atmCardFeedback = "✅ ATM Proof Ready";
          _atmCardFileName = originalName;
          _atmCardUrl = downloadUrl;
          _atmProofBytes = bytes;
          _atmProofIsPdf = isPdf;
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(LucideIcons.checkCircle2, color: Colors.white, size: 18),
              const SizedBox(width: 10),
              Expanded(child: Text('$docType uploaded successfully and ready for submission!')),
            ],
          ),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        if (isDeposit) {
          _depositSlipFeedback = "Error: ${e.toString()}";
        } else {
          _atmCardFeedback = "Error: ${e.toString()}";
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Upload failed: $e'),
          backgroundColor: AppTheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showReviewSheet(String label, String fileName) {
    final bool isAtm = label.contains('ATM') || fileName == _atmCardFileName;
    final bool isDeposit = label.contains('Deposit') || fileName == _depositSlipFileName;
    final bool isBankDoc = isAtm || isDeposit;
    final String docType = isDeposit ? 'Deposit Slip' : (isAtm ? 'ATM Proof' : 'Document');

    final Uint8List? docBytes = isDeposit ? _depositSlipBytes : (isAtm ? _atmProofBytes : null);
    final String? docUrl = isDeposit ? _depositSlipUrl : (isAtm ? _atmCardUrl : _submissionPdfUrl);
    final bool isPdf = fileName.toLowerCase().endsWith('.pdf') || (isDeposit ? _depositSlipIsPdf : (isAtm ? _atmProofIsPdf : true));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.72,
        decoration: BoxDecoration(
          color: context.bgC,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isDeposit
                        ? LucideIcons.fileText
                        : (isAtm ? LucideIcons.creditCard : LucideIcons.eye),
                    color: AppTheme.primaryColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBankDoc ? '$docType Review' : 'Document Review',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      Text(
                        label,
                        style: TextStyle(color: context.textSec, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: context.surfaceC,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: context.crispBorder),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (!isPdf && docBytes != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.memory(
                          docBytes,
                          height: 150,
                          fit: BoxFit.contain,
                        ),
                      )
                    else if (!isPdf && docUrl != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          docUrl,
                          height: 150,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => Icon(
                            isDeposit ? LucideIcons.fileText : LucideIcons.creditCard,
                            size: 56,
                            color: AppTheme.primaryColor.withOpacity(0.5),
                          ),
                        ),
                      )
                    else
                      Icon(
                        fileName.toLowerCase().endsWith('.pdf')
                            ? LucideIcons.fileText
                            : (isDeposit ? LucideIcons.fileText : LucideIcons.image),
                        size: 56,
                        color: AppTheme.primaryColor.withOpacity(0.5),
                      ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        fileName,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'File ready for submission',
                      style: TextStyle(color: AppTheme.success, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            if (docUrl != null) ...[
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final uri = Uri.parse(docUrl);
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    } else {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not open document.')),
                      );
                    }
                  },
                  icon: const Icon(LucideIcons.externalLink, size: 18),
                  label: const Text(
                    'Preview Full Document',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primaryColor,
                    side: const BorderSide(color: AppTheme.primaryColor, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
            if (isBankDoc) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _showDocumentSelectionSheet(docType);
                  },
                  icon: const Icon(LucideIcons.refreshCw, size: 16),
                  label: Text(
                    'Re-upload or Replace $docType',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF0F3260),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Done',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final canPop = Navigator.canPop(context);

    return Container(
      padding: EdgeInsets.fromLTRB(16, topPadding + 10, 24, 24),
      decoration: const BoxDecoration(
        color: AppTheme.primaryColor,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        border: Border(
          bottom: BorderSide(
            color: Color(0xFFFBC02D), // Golden Yellow Bottom Accent Line
            width: 3.0,
          ),
        ),
      ),
      child: Row(
        children: [
          if (canPop)
            IconButton(
              icon: const Icon(
                LucideIcons.chevronLeft,
                color: Colors.white,
                size: 24,
              ),
              onPressed: () => Navigator.pop(context),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Document Submission',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Complete your application',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.7),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              LucideIcons.fileUp,
              color: Colors.white,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgC,
      body: Column(
        children: [
          _buildHeader(context),
          _buildCustomStepIndicator(),
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: _buildCurrentStepContent(),
            ),
          ),
          _buildStepNavigationButtons(),
        ],
      ),
    );
  }

  Widget _buildCustomStepIndicator() {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 20, 24, 12),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        children: [
          _buildStepNode(0, 'Guide', LucideIcons.bookOpen),
          _buildStepConnector(0),
          _buildStepNode(1, 'Files', LucideIcons.fileText),
          _buildStepConnector(1),
          _buildStepNode(2, 'Final', LucideIcons.checkCircle),
        ],
      ),
    );
  }

  Widget _buildStepNode(int stepIndex, String title, IconData fallbackIcon) {
    final isCompleted = _currentStep > stepIndex;
    final isActive = _currentStep == stepIndex;

    Color nodeBgColor = context.bgC;
    Color nodeContentColor = context.textSec;
    Border? border = Border.all(color: context.crispBorder, width: 1.5);

    if (isCompleted) {
      nodeBgColor = AppTheme.primaryColor;
      nodeContentColor = const Color(0xFFFBC02D); // Golden Yellow Icon/Number
      border = null;
    } else if (isActive) {
      nodeBgColor = const Color(0xFFFBC02D); // Golden Yellow Active
      nodeContentColor = AppTheme.primaryColor; // Navy Text
      border = null;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: nodeBgColor,
            shape: BoxShape.circle,
            border: border,
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: const Color(0xFFFBC02D).withOpacity(0.3),
                      blurRadius: 8,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: isCompleted
              ? Icon(LucideIcons.check, color: nodeContentColor, size: 18)
              : Text(
                  '${stepIndex + 1}',
                  style: TextStyle(
                    color: nodeContentColor,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: TextStyle(
            color: isActive ? AppTheme.primaryColor : context.textSec,
            fontSize: 11,
            fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildStepConnector(int precedingStep) {
    final isFilled = _currentStep > precedingStep;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(bottom: 16, left: 8, right: 8),
        height: 3,
        decoration: BoxDecoration(
          color: isFilled ? AppTheme.primaryColor : context.crispBorder,
          borderRadius: BorderRadius.circular(1.5),
        ),
      ),
    );
  }

  Widget _buildCurrentStepContent() {
    switch (_currentStep) {
      case 0:
        return _buildStep1();
      case 1:
        return _buildStep2();
      case 2:
        return _buildStep3();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildStepNavigationButtons() {
    final isLastStep = _currentStep == 2;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        decoration: BoxDecoration(
          color: context.surfaceC,
          border: Border(top: BorderSide(color: context.crispBorder, width: 1.5)),
        ),
        child: Row(
          children: [
            if (_currentStep > 0)
              Expanded(
                child: SizedBox(
                  height: 52,
                  child: OutlinedButton(
                    onPressed: _isUploading ? null : _handleBack,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.primaryColor,
                      side: const BorderSide(color: AppTheme.primaryColor, width: 1.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text('Back', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ),
            if (_currentStep > 0) const SizedBox(width: 16),
            Expanded(
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppTheme.primaryColor,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFBC02D).withOpacity(0.15),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: ElevatedButton(
                  onPressed: _isUploading ? null : _handleContinue,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    isLastStep ? 'Submit Application' : 'Continue',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleBack() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep -= 1;
      });
    }
  }

  Future<void> _handleContinue() async {
    if (_currentStep == 1) {
      if (!_formKey.currentState!.validate()) {
        return;
      }
      if (_submissionPdfUrl == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please upload your ID document and signature before continuing.'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      if (_atmCardUrl == null && _depositSlipUrl == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please upload at least one banking requirement (ATM Proof or Deposit Slip) before continuing.'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
    }
    if (_currentStep < 2) {
      setState(() {
        _currentStep += 1;
      });
    } else {
      setState(() => _isUploading = true);
      try {
        final user = _authService.currentUser;
        if (user != null) {
          final doc = await _authService.getStudentProfile(
            user.id,
          );
          final data = doc;
          final String studentId =
              data?['studentId'] ?? 'Unknown ID';
          final String fullName = data?['fullName'] ?? 'Student';

          Map<String, dynamic> documents = {};
          if (data != null && data['documents'] is Map) {
            documents = Map<String, dynamic>.from(data['documents']);
          }
          if (_atmCardUrl != null) {
            documents['atmCardUrl'] = _atmCardUrl;
            documents['atm_card_url'] = _atmCardUrl;
            documents['atmCardFileName'] = _atmCardFileName;
            documents['atm_card_file_name'] = _atmCardFileName;
          }
          if (_depositSlipUrl != null) {
            documents['depositSlipUrl'] = _depositSlipUrl;
            documents['deposit_slip_url'] = _depositSlipUrl;
            documents['depositSlipFileName'] = _depositSlipFileName;
            documents['deposit_slip_file_name'] = _depositSlipFileName;
          }
          final String proofTypeSummary = (_atmCardUrl != null && _depositSlipUrl != null)
              ? 'ATM Card & Deposit Slip'
              : (_depositSlipUrl != null ? 'Deposit Slip' : 'ATM Card');
          documents['atmProofType'] = proofTypeSummary;
          documents['atm_proof_type'] = proofTypeSummary;

          documents['submissionPdfUrl'] = _submissionPdfUrl;
          documents['submission_pdf_url'] = _submissionPdfUrl;
          documents['submissionPdfName'] = _pdfFileName;
          documents['submission_pdf_name'] = _pdfFileName;
          if (_idFrontUrl != null) {
            documents['idFrontUrl'] = _idFrontUrl;
            documents['id_front_url'] = _idFrontUrl;
          }
          if (_idBackUrl != null) {
            documents['idBackUrl'] = _idBackUrl;
            documents['id_back_url'] = _idBackUrl;
          }
          documents['saNumber'] = _saController.text.trim();
          documents['sa_number'] = _saController.text.trim();
          documents['saVerificationStatus'] = 'Pending';
          documents['idValidationStatus'] = 'Pending';
          if (_stickerAcademicYear != null) {
            documents['academicYear'] = _stickerAcademicYear;
            documents['academic_year'] = _stickerAcademicYear;
          }
          if (_stickerSemester != null) documents['semester'] = _stickerSemester;
          if (_stickerValidated != null) {
            documents['stickerValidated'] = _stickerValidated;
            documents['sticker_validated'] = _stickerValidated;
          }
          if (_stickerOverriddenForAdmin != null) {
            documents['stickerOverriddenForAdmin'] = _stickerOverriddenForAdmin;
          }

          final Map<String, dynamic> studentPayload = {
            'status': 'Pending',
            'saNumber': _saController.text.trim(),
            'sa_number': _saController.text.trim(),
            'submissionPdfUrl': _submissionPdfUrl,
            'submission_pdf_url': _submissionPdfUrl,
            'submissionPdfName': _pdfFileName,
            'submission_pdf_name': _pdfFileName,
            'atmProofType': proofTypeSummary,
            'atm_proof_type': proofTypeSummary,
            'documents': documents,
            'pdfVerified': true,
            'academicYear': _stickerAcademicYear ?? AcademicTermService.currentTerm.academicYear,
            'academic_year': _stickerAcademicYear ?? AcademicTermService.currentTerm.academicYear,
            'semester': _stickerSemester ?? AcademicTermService.currentTerm.semester,
            'stickerValidated': _stickerValidated ?? true,
            'sticker_validated': _stickerValidated ?? true,
            'createdAt': DateTime.now().toUtc().toIso8601String(),
            'submittedAt': DateTime.now().toUtc().toIso8601String(),
            'submitted_at': DateTime.now().toUtc().toIso8601String(),
            'requiresResubmission': false,
            'adminRemarks': null,
          };
          if (_atmCardUrl != null) {
            studentPayload['atmCardUrl'] = _atmCardUrl;
            studentPayload['atm_card_url'] = _atmCardUrl;
            studentPayload['atmCardFileName'] = _atmCardFileName;
          }
          if (_depositSlipUrl != null) {
            studentPayload['depositSlipUrl'] = _depositSlipUrl;
            studentPayload['deposit_slip_url'] = _depositSlipUrl;
            studentPayload['depositSlipFileName'] = _depositSlipFileName;
          }
          if (_idFrontUrl != null) {
            studentPayload['idFrontUrl'] = _idFrontUrl;
            studentPayload['id_front_url'] = _idFrontUrl;
          }
          if (_idBackUrl != null) {
            studentPayload['idBackUrl'] = _idBackUrl;
            studentPayload['id_back_url'] = _idBackUrl;
          }

          await _authService.updateStudentProfile(user.id, studentPayload);

          final notificationService = NotificationService();
          await notificationService.sendNotification(
            studentId: 'admin',
            title: 'SA Number Submitted',
            message: 'Student $fullName has submitted SA Number for verification.',
            type: 'info',
          );
          await notificationService.sendNotification(
            studentId: 'admin',
            title: 'ID Validation Submitted',
            message: 'Student $fullName has uploaded ID documents for validation.',
            type: 'info',
          );

          await _auditService.logActivity(
            action:
                'Submitted documents for scholarship verification',
            userName: fullName,
            role: 'Student',
            studentId: studentId,
          );
        }

        if (!mounted) return;
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Documents submitted successfully!'),
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
          ),
        );

        if (Navigator.canPop(context)) {
          Navigator.pop(context);
        } else {
          setState(() {
            _currentStep = 0;
            _submissionPdfUrl = null;
            _pdfFeedback = null;
            _pdfFileName = null;
            _atmCardUrl = null;
            _atmCardFeedback = null;
            _atmCardFileName = null;
            _atmProofBytes = null;
            _atmProofIsPdf = false;
            _depositSlipUrl = null;
            _depositSlipFeedback = null;
            _depositSlipFileName = null;
            _depositSlipBytes = null;
            _depositSlipIsPdf = false;
          });
        }
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit documents: $e'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      } finally {
        if (mounted) setState(() => _isUploading = false);
      }
    }
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        const Text(
          'Submission Protocol',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F3260)),
        ),
        const SizedBox(height: 8),
        Text(
          'Please ensure you have high-quality scans of the following requirements ready:',
          style: TextStyle(color: context.textSec, fontSize: 13, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 20),
        _bulletPoint('Camera Capture: Front and Back of Student ID'),
        _bulletPoint('Digital Signature: Draw signature directly in the app'),
        _bulletPoint('ATM Card Proof (Scan or photo of your Landbank ATM Card)'),
        _bulletPoint('Deposit Slip Proof (Scan or photo of Bank Deposit Slip / Receipt)'),
        const SizedBox(height: 28),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFFBC02D).withOpacity(0.08), // Light Yellow tint
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFFBC02D).withOpacity(0.2)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Color(0xFFFBC02D),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      LucideIcons.shieldAlert,
                      color: Color(0xFF0F3260),
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Quality Check Required',
                    style: TextStyle(
                      color: Color(0xFF0F3260),
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Please ensure your ID captures are clear, well-lit, and easily readable. Your digital signature should be drawn clearly. A blurred or incomplete submission may lead to rejection.',
                style: TextStyle(
                  color: Color(0xFF0F3260),
                  fontSize: 12,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _bulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: AppTheme.success,
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.check, size: 10, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: context.textPri),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          if (_isUploading)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Column(
                children: [
                  const CircularProgressIndicator(color: Color(0xFF0F3260)),
                  const SizedBox(height: 12),
                  Text(
                    'Uploading document...',
                    style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

          // SA Number Field
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: context.surfaceC,
              borderRadius: BorderRadius.circular(24),
              boxShadow: AppTheme.softShadow,
              border: Border.all(color: context.crispBorder, width: 1.5),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      LucideIcons.landmark,
                      size: 18,
                      color: AppTheme.primaryColor,
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Banking Details',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F3260)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _saController,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  decoration: InputDecoration(
                    labelText: 'SA Number',
                    hintText: 'Enter your 10 to 12-digit SA number',
                    prefixIcon: const Icon(LucideIcons.creditCard, size: 18),
                    counterText: "",
                    filled: true,
                    fillColor: context.bgC,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: context.crispBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFFBC02D), width: 2),
                    ),
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  maxLength: 12,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'SA Number is required';
                    }
                    final trimmed = value.trim();
                    if (trimmed.length < 10 || trimmed.length > 12) {
                      return 'SA Number must be between 10 and 12 digits';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                Text(
                  'Please enter your official scholarship account number carefully.',
                  style: TextStyle(fontSize: 11, color: context.textSec, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          _buildUploadCard(
            'ID Capture & Digital Signature',
            LucideIcons.camera,
            onTap: () => _handleUpload(),
            feedback: _pdfFeedback,
            subtitle: 'Use camera to scan ID and sign',
            fileName: _pdfFileName,
          ),
          _buildUploadCard(
            'ATM Proof',
            LucideIcons.creditCard,
            onTap: () => _showDocumentSelectionSheet('ATM Proof'),
            feedback: _atmCardFeedback,
            subtitle: _atmCardFileName != null
                ? 'ATM Proof attached: $_atmCardFileName'
                : 'Upload photo or document of your Landbank ATM card',
            fileName: _atmCardFileName,
          ),
          _buildUploadCard(
            'Deposit Slip',
            LucideIcons.fileText,
            onTap: () => _showDocumentSelectionSheet('Deposit Slip'),
            feedback: _depositSlipFeedback,
            subtitle: _depositSlipFileName != null
                ? 'Deposit Slip attached: $_depositSlipFileName'
                : 'Upload photo or document of your bank deposit slip',
            fileName: _depositSlipFileName,
          ),
        ],
      ),
    );
  }

  Widget _buildUploadCard(
    String label,
    IconData icon, {
    required VoidCallback onTap,
    String? feedback,
    bool isDuplicate = false,
    String subtitle = 'PDF, PNG or JPG (Max 5MB)',
    String? fileName,
  }) {
    final bool isCompleted =
        feedback != null && !isDuplicate && fileName != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppTheme.softShadow,
        border: Border.all(
          color: isDuplicate
              ? AppTheme.error
              : (isCompleted
                    ? AppTheme.success.withOpacity(0.5)
                    : context.crispBorder),
          width: isCompleted || isDuplicate ? 2 : 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isCompleted ? () => _showReviewSheet(label, fileName) : onTap,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppTheme.success.withOpacity(0.08)
                            : (isDuplicate
                                  ? AppTheme.error.withOpacity(0.08)
                                  : AppTheme.primaryColor.withOpacity(
                                      0.05,
                                    )),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        isCompleted
                            ? LucideIcons.fileCheck2
                            : (isDuplicate ? LucideIcons.copy : icon),
                        color: isCompleted
                            ? AppTheme.success
                            : (isDuplicate
                                  ? AppTheme.error
                                  : AppTheme.primaryColor),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: Color(0xFF0F3260),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            isCompleted ? 'Tap to Review: $fileName' : subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: isCompleted
                                  ? AppTheme.success
                                  : context.textSec,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isCompleted)
                      Icon(
                        LucideIcons.externalLink,
                        size: 16,
                        color: AppTheme.success,
                      )
                    else
                      Icon(
                        LucideIcons.uploadCloud,
                        size: 18,
                        color: AppTheme.primaryColor,
                      ),
                  ],
                ),
                if (feedback != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isCompleted
                          ? AppTheme.success.withOpacity(0.05)
                          : AppTheme.warning.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isCompleted
                              ? LucideIcons.sparkles
                              : LucideIcons.alertCircle,
                          size: 14,
                          color: isCompleted
                              ? AppTheme.success
                              : AppTheme.warning,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            feedback,
                            style: TextStyle(
                              fontSize: 11,
                              color: isCompleted
                                  ? AppTheme.success
                                  : AppTheme.warning,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isCompleted)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton.icon(
                            onPressed: onTap,
                            icon: const Icon(LucideIcons.refreshCw, size: 13),
                            label: const Text(
                              'Re-upload',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            style: TextButton.styleFrom(
                              foregroundColor: AppTheme.primaryColor,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep3() {
    return Column(
      children: [
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppTheme.success.withOpacity(0.08),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            LucideIcons.checkCircle2,
            size: 64,
            color: AppTheme.success,
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Verification Complete',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F3260)),
        ),
        const SizedBox(height: 12),
        Text(
          'Your documents have been processed and are ready for official filing.',
          textAlign: TextAlign.center,
          style: TextStyle(color: context.textSec, height: 1.5, fontSize: 13.5, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 32),
        if (_pdfFileName != null) ...[
          _buildReviewItem(_pdfFileName!, 'ID Submission Document'),
          const SizedBox(height: 12),
        ],
        if (_atmCardFileName != null) ...[
          _buildReviewItem(_atmCardFileName!, 'ATM Card Proof'),
          const SizedBox(height: 12),
        ],
        if (_depositSlipFileName != null) ...[
          _buildReviewItem(_depositSlipFileName!, 'Deposit Slip Proof'),
          const SizedBox(height: 12),
        ],
        if (_pdfFileName == null && _atmCardFileName == null && _depositSlipFileName == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Text(
              'No documents uploaded yet.',
              style: TextStyle(
                color: context.textSec,
                fontStyle: FontStyle.italic,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildReviewItem(String name, String label) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.05),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              label.contains('PDF') ? LucideIcons.fileText : LucideIcons.image,
              size: 20,
              color: AppTheme.primaryColor,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: Color(0xFF0F3260),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(fontSize: 11, color: context.textSec, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
