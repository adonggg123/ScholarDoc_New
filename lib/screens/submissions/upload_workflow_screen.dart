import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';

import '../../services/storage_service.dart';
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

  // ATM Scanning removed in favor of manual entry

  Future<void> _handleUpload() async {
    try {
      // 1. Navigate to IDCaptureScreen to get the generated PDF bytes
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

      // 3. Real Upload to Firebase Storage
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

  /* 
  Removed _simulateUpload as it is now handled by _handleUpload.
  */

  /* 
  Removed _simulateDuplicateCheck as it is no longer used for the new requirements.
  */

  void _showReviewSheet(String label, String fileName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.1),
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
            const SizedBox(height: 32),
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
                      size: 64,
                      color: AppTheme.primaryColor.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      fileName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'File ready for submission',
                      style: TextStyle(color: AppTheme.success, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
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
                icon: const Icon(LucideIcons.externalLink),
                label: const Text(
                  'Preview Document',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.surfaceC,
                  foregroundColor: AppTheme.primaryColor,
                  side: const BorderSide(color: AppTheme.primaryColor),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 56,
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
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Needs Correction?',
                style: TextStyle(color: context.textSec),
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
      padding: EdgeInsets.fromLTRB(16, topPadding + 10, 24, 40),
      decoration: const BoxDecoration(
        color: AppTheme.primaryColor,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
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
                    fontSize: 22,
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
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              LucideIcons.fileUp,
              color: Colors.white,
              size: 22,
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
          Expanded(
            child: Theme(
              data: Theme.of(context).copyWith(
                colorScheme: ColorScheme.fromSeed(
                  seedColor: AppTheme.primaryColor,
                  primary: AppTheme.primaryColor,
                ),
              ),
              child: Stepper(
                type: StepperType.horizontal,
                currentStep: _currentStep,
                elevation: 0,
                onStepContinue: () async {
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

                        await _authService.updateStudentProfile(user.id, {
                          'status': 'Pending',
                          'saNumber': _saController.text.trim(),
                          'submissionPdfUrl': _submissionPdfUrl,
                          'submissionPdfName': _pdfFileName,
                          'atmCardUrl': _atmCardUrl,
                          'atmCardFileName': _atmCardFileName,
                          'pdfVerified': true,
                          'createdAt': DateTime.now().toIso8601String(),
                          'submittedAt': DateTime.now().toIso8601String(),
                          'requiresResubmission': false,
                          'adminRemarks': null,
                        });

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
                },
                onStepCancel: () {
                  if (_currentStep > 0) {
                    setState(() {
                      _currentStep -= 1;
                    });
                  } else {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    }
                  }
                },
                steps: [
                  Step(
                    title: const Text('Guide', style: TextStyle(fontSize: 12)),
                    content: _buildStep1(),
                    isActive: _currentStep >= 0,
                    state: _currentStep > 0
                        ? StepState.complete
                        : StepState.indexed,
                  ),
                  Step(
                    title: const Text('Files', style: TextStyle(fontSize: 12)),
                    content: _buildStep2(),
                    isActive: _currentStep >= 1,
                    state: _currentStep > 1
                        ? StepState.complete
                        : StepState.indexed,
                  ),
                  Step(
                    title: const Text('Final', style: TextStyle(fontSize: 12)),
                    content: _buildStep3(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Submission Protocol',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        const SizedBox(height: 8),
        Text(
          'Please ensure you have high-quality scans of the following:',
          style: TextStyle(color: context.textSec, fontSize: 13),
        ),
        const SizedBox(height: 24),
        _bulletPoint('Camera Capture: Front and Back of ID'),
        _bulletPoint('Digital Signature: Draw your signature directly in the app'),
        _bulletPoint('Clear photo of your ATM Card (JPG/PNG format)'),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.warning.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.warning.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: AppTheme.warning,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      LucideIcons.shieldAlert,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Quality Check Required',
                    style: TextStyle(
                      color: AppTheme.warning,
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
                  color: AppTheme.warning,
                  fontSize: 12,
                  height: 1.5,
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
            padding: const EdgeInsets.all(2),
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
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
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
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text(
                    'Uploading document...',
                    style: TextStyle(color: AppTheme.primaryColor),
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
                icon: const Icon(LucideIcons.save, size: 16),
                label: const Text('Save Draft Offline'),
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
              border: Border.all(color: context.crispBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.landmark,
                      size: 18,
                      color: AppTheme.primaryColor,
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Banking Details',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _saController,
                  decoration: InputDecoration(
                    labelText: 'SA Number',
                    hintText: 'Enter your 10 to 12-digit SA number',
                    prefixIcon: const Icon(LucideIcons.creditCard),
                    counterText: "",
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
                const SizedBox(height: 16),
                const SizedBox(height: 8),
                Text(
                  'Please enter your official scholarship account number carefully.',
                  style: TextStyle(fontSize: 11, color: context.textSec),
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
                    ? AppTheme.success.withValues(alpha: 0.5)
                    : context.crispBorder),
          width: isCompleted || isDuplicate ? 2 : 1,
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
                            ? AppTheme.success.withValues(alpha: 0.1)
                            : (isDuplicate
                                  ? AppTheme.error.withValues(alpha: 0.1)
                                  : AppTheme.primaryColor.withValues(
                                      alpha: 0.05,
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
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isCompleted ? 'Tap to Review: $fileName' : subtitle,
                            style: TextStyle(
                              fontSize: 12,
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
                        isCompleted
                            ? LucideIcons.refreshCcw
                            : LucideIcons.uploadCloud,
                        size: 18,
                        color: isCompleted
                            ? context.textSec
                            : AppTheme.primaryColor,
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
                          ? AppTheme.success.withValues(alpha: 0.05)
                          : AppTheme.warning.withValues(alpha: 0.05),
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
                              fontWeight: FontWeight.w500,
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
                            icon: const Icon(LucideIcons.refreshCw, size: 14),
                            label: const Text(
                              'Re-upload',
                              style: TextStyle(fontSize: 12),
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
            color: AppTheme.success.withValues(alpha: 0.1),
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
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Text(
          'Your documents have been processed and are ready for official filing.',
          textAlign: TextAlign.center,
          style: TextStyle(color: context.textSec, height: 1.5, fontSize: 14),
        ),
        const SizedBox(height: 40),
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
              ),
            ),
          ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildReviewItem(String name, String size) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.crispBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              LucideIcons.fileText,
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
                  ),
                ),
                Text(
                  size,
                  style: TextStyle(fontSize: 11, color: context.textSec),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(
              LucideIcons.trash2,
              size: 18,
              color: AppTheme.error,
            ),
          ),
        ],
      ),
    );
  }
}
