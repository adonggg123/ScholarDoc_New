import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/storage_service.dart';
import '../../services/notification_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:typed_data';
import 'id_capture_screen.dart';

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

  String? _atmCardUrl;
  String? _atmCardFeedback;
  String? _atmCardFileName;

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
        setState(() {
          _saController.text = data['saNumber'] ?? '';
        });
      }
    }
    await _loadDraft();
  }

  Future<void> _loadDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final draftSA = prefs.getString('draft_saNumber');
    if (draftSA != null && draftSA.isNotEmpty && _saController.text.isEmpty) {
      setState(() {
        _saController.text = draftSA;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Offline Draft Loaded'),
            backgroundColor: AppTheme.primaryColor,
          ),
        );
      }
    }
  }

  Future<void> _saveDraftOffline() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('draft_saNumber', _saController.text.trim());
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Draft saved locally. You can finish later even offline.',
          ),
          backgroundColor: AppTheme.success,
        ),
      );
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

      if (!mounted) return;

      setState(() {
        _isUploading = false;
        _pdfFeedback = "✅ Document Ready";
        _pdfFileName = originalName;
        _submissionPdfUrl = downloadUrl;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        _pdfFeedback = "Error: ${e.toString()}";
      });
    }
  }

  Future<void> _handleAtmUpload() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png'],
        withData: true,
      );

      if (result == null || result.files.single.bytes == null) return;
      
      final bytes = result.files.single.bytes!;
      String originalName = result.files.single.name;

      setState(() {
        _isUploading = true;
        _atmCardFeedback = null;
      });

      final uid = _authService.currentUser?.id;
      if (uid == null) throw Exception("User not authenticated");

      final String storagePath =
          'submissions/$uid/ATM_${DateTime.now().millisecondsSinceEpoch}_$originalName';
      final String downloadUrl = await _storageService.uploadFile(
        path: storagePath,
        bytes: bytes,
      );

      if (!mounted) return;

      setState(() {
        _isUploading = false;
        _atmCardFeedback = "✅ ATM Card Ready";
        _atmCardFileName = originalName;
        _atmCardUrl = downloadUrl;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        _atmCardFeedback = "Error: ${e.toString()}";
      });
    }
  }

  void _showReviewSheet(String label, String fileName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.65,
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
                  child: const Icon(
                    LucideIcons.eye,
                    color: AppTheme.primaryColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Document Review',
                        style: TextStyle(
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
                    Icon(
                      fileName.endsWith('.pdf')
                          ? LucideIcons.fileText
                          : LucideIcons.image,
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
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final String? urlToOpen = fileName == _pdfFileName ? _submissionPdfUrl : _atmCardUrl;
                  if (urlToOpen != null) {
                    final uri = Uri.parse(urlToOpen);
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    } else {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not open document.')),
                      );
                    }
                  }
                },
                icon: const Icon(LucideIcons.externalLink, size: 18),
                label: const Text(
                  'Preview Document',
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
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 52,
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
                  'Confirm Document',
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
      if (_submissionPdfUrl == null || _atmCardUrl == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please upload both your PDF document and ATM Card before continuing.'),
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
          documents['atmCardUrl'] = _atmCardUrl;
          documents['atmCardFileName'] = _atmCardFileName;
          documents['saVerificationStatus'] = 'Pending';
          documents['idValidationStatus'] = 'Pending';

          await _authService.updateStudentProfile(user.id, {
            'status': 'Pending',
            'saNumber': _saController.text.trim(),
            'submissionPdfUrl': _submissionPdfUrl,
            'submissionPdfName': _pdfFileName,
            'documents': documents,
            'pdfVerified': true,
            'createdAt': DateTime.now().toUtc().toIso8601String(),
            'submittedAt': DateTime.now().toUtc().toIso8601String(),
            'requiresResubmission': false,
            'adminRemarks': null,
          });

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
        _bulletPoint('Clear photo of your Payout ATM Card (JPG/PNG format)'),
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

          // Draft Actions
          Row(
            key: const ValueKey('draft_actions'),
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: _saveDraftOffline,
                icon: const Icon(LucideIcons.save, size: 15),
                label: const Text('Save Draft Offline', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.primaryColor,
                ),
              ),
            ],
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
            'ATM Card Proof (Image)',
            LucideIcons.creditCard,
            onTap: () => _handleAtmUpload(),
            feedback: _atmCardFeedback,
            subtitle: 'Clear photo of your ATM Card (JPG/PNG)',
            fileName: _atmCardFileName,
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
          _buildReviewItem(_pdfFileName!, 'PDF Document'),
          const SizedBox(height: 12),
        ],
        if (_atmCardFileName != null) ...[
          _buildReviewItem(_atmCardFileName!, 'ATM Card Image'),
          const SizedBox(height: 12),
        ],
        if (_pdfFileName == null && _atmCardFileName == null)
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
