import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/cloudinary_service.dart';
import '../../services/scholarship_service.dart';
import '../../services/sms_service.dart';
import '../auth/login_screen.dart';
import 'student_activity_log_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  final _personalFormKey = GlobalKey<FormState>();
  final _academicFormKey = GlobalKey<FormState>();
  final _bankingFormKey = GlobalKey<FormState>();

  final _saController = TextEditingController();
  final _nameController = TextEditingController();
  final _contactController = TextEditingController();
  final _sectionController = TextEditingController();
  final _emailController = TextEditingController();
  final _birthdateController = TextEditingController();
  final _courseController = TextEditingController();
  final _yearLevelController = TextEditingController();
  final _yearBecameScholarController = TextEditingController();
  final _payoutsReceivedController = TextEditingController();

  final _nameFocusNode = FocusNode();
  final _courseFocusNode = FocusNode();
  final _saFocusNode = FocusNode();

  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final CloudinaryService _cloudinaryService = CloudinaryService();
  final ScholarshipService _scholarshipService = ScholarshipService();
  StreamSubscription<List<Scholarship>>? _scholarshipSub;

  String? _selectedScholarship = 'TES';
  String? _selectedGender = 'Male';
  final List<String> _scholarshipOptions = ['TES'];
  final List<String> _genderOptions = ['Male', 'Female', 'Prefer not to say'];

  Map<String, dynamic>? _profileData;
  Map<String, String> _initialSnapshot = {};
  bool _isProfileLoading = true;
  bool _isUploadingPhoto = false;
  String? _savingSection; // 'personal', 'academic', 'banking', 'all', or null
  String? _profilePictureUrl;

  final Set<String> _expandedSections = {'personal', 'academic', 'banking'};
  final Set<String> _editingSections = {};

  bool get _isSaving => _savingSection != null;

  @override
  void initState() {
    super.initState();
    for (final ctrl in [
      _saController,
      _nameController,
      _contactController,
      _sectionController,
      _emailController,
      _birthdateController,
      _courseController,
      _yearLevelController,
      _yearBecameScholarController,
      _payoutsReceivedController,
    ]) {
      ctrl.addListener(_onFieldChanged);
    }
    _loadProfile();
    _scholarshipSub = _scholarshipService.getActiveScholarships().listen((
      list,
    ) {
      // Kept strictly to TES
    });
  }

  void _onFieldChanged() {
    if (mounted && !_isProfileLoading) {
      setState(() {});
    }
  }

  Map<String, String> _currentSnapshot() {
    return {
      'name': _nameController.text.trim(),
      'gender': (_selectedGender ?? 'Male').trim(),
      'birthdate': _birthdateController.text.trim(),
      'email': _emailController.text.trim(),
      'contact': _contactController.text.trim(),
      'section': _sectionController.text.trim(),
      'scholarship': (_selectedScholarship ?? 'TES').trim(),
      'course': _courseController.text.trim(),
      'yearLevel': _yearLevelController.text.trim(),
      'yearBecameScholar': _yearBecameScholarController.text.trim(),
      'payoutsReceived': _payoutsReceivedController.text.trim(),
      'saNumber': _saController.text.trim(),
    };
  }

  void _captureInitialSnapshot() {
    _initialSnapshot = _currentSnapshot();
  }

  bool get _isPersonalDirty {
    if (_initialSnapshot.isEmpty) return false;
    final cur = _currentSnapshot();
    return cur['name'] != _initialSnapshot['name'] ||
        cur['gender'] != _initialSnapshot['gender'] ||
        cur['birthdate'] != _initialSnapshot['birthdate'] ||
        cur['email'] != _initialSnapshot['email'] ||
        cur['contact'] != _initialSnapshot['contact'] ||
        cur['section'] != _initialSnapshot['section'];
  }

  bool get _isAcademicDirty {
    if (_initialSnapshot.isEmpty) return false;
    final cur = _currentSnapshot();
    return cur['scholarship'] != _initialSnapshot['scholarship'] ||
        cur['course'] != _initialSnapshot['course'] ||
        cur['yearLevel'] != _initialSnapshot['yearLevel'] ||
        cur['yearBecameScholar'] != _initialSnapshot['yearBecameScholar'] ||
        cur['payoutsReceived'] != _initialSnapshot['payoutsReceived'];
  }

  bool get _isBankingDirty {
    if (_initialSnapshot.isEmpty) return false;
    final cur = _currentSnapshot();
    return cur['saNumber'] != _initialSnapshot['saNumber'];
  }

  bool get _hasAnyUnsavedChanges =>
      _isPersonalDirty || _isAcademicDirty || _isBankingDirty;

  void _resetSection(String sectionKey) {
    if (_initialSnapshot.isEmpty) return;
    try {
      HapticFeedback.lightImpact();
    } catch (_) {}
    setState(() {
      if (sectionKey == 'personal' || sectionKey == 'all') {
        _nameController.text = _initialSnapshot['name'] ?? '';
        _selectedGender = _initialSnapshot['gender'] ?? 'Male';
        _birthdateController.text = _initialSnapshot['birthdate'] ?? '';
        _emailController.text = _initialSnapshot['email'] ?? '';
        _contactController.text = _initialSnapshot['contact'] ?? '';
        _sectionController.text = _initialSnapshot['section'] ?? '';
        _personalFormKey.currentState?.validate();
        _editingSections.remove('personal');
      }
      if (sectionKey == 'academic' || sectionKey == 'all') {
        _selectedScholarship = _initialSnapshot['scholarship'] ?? 'TES';
        _courseController.text = _initialSnapshot['course'] ?? '';
        _yearLevelController.text = _initialSnapshot['yearLevel'] ?? '';
        _yearBecameScholarController.text =
            _initialSnapshot['yearBecameScholar'] ?? '';
        _payoutsReceivedController.text =
            _initialSnapshot['payoutsReceived'] ?? '';
        _academicFormKey.currentState?.validate();
        _editingSections.remove('academic');
      }
      if (sectionKey == 'banking' || sectionKey == 'all') {
        _saController.text = _initialSnapshot['saNumber'] ?? '';
        _bankingFormKey.currentState?.validate();
        _editingSections.remove('banking');
      }
    });
  }

  void _toggleEditSection(String sectionKey) {
    try {
      HapticFeedback.selectionClick();
    } catch (_) {}
    setState(() {
      if (_editingSections.contains(sectionKey)) {
        _editingSections.remove(sectionKey);
        FocusScope.of(context).unfocus();
      } else {
        _expandedSections.add(sectionKey);
        _editingSections.add(sectionKey);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (sectionKey == 'personal') {
            _nameFocusNode.requestFocus();
          } else if (sectionKey == 'academic') {
            _courseFocusNode.requestFocus();
          } else if (sectionKey == 'banking') {
            _saFocusNode.requestFocus();
          }
        });
      }
    });
  }

  String _formatBirthdateForDisplay(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty ||
        trimmed.toLowerCase() == 'null' ||
        trimmed.toUpperCase() == 'N/A') {
      return '';
    }
    final isoMatch = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})').firstMatch(trimmed);
    if (isoMatch != null) {
      final y = isoMatch.group(1)!;
      final m = isoMatch.group(2)!.padLeft(2, '0');
      final d = isoMatch.group(3)!.padLeft(2, '0');
      return '$m/$d/$y';
    }
    if (trimmed.contains('/')) {
      final parts = trimmed.split('/');
      if (parts.length == 3) {
        final p0 = parts[0].trim();
        final p1 = parts[1].trim();
        final p2 = parts[2].trim();
        if (p0.length == 4) {
          return '${p1.padLeft(2, '0')}/${p2.padLeft(2, '0')}/$p0';
        }
        return '${p0.padLeft(2, '0')}/${p1.padLeft(2, '0')}/$p2';
      }
    }
    return trimmed;
  }

  String? _toIsoDateOrNull(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    final isoMatch = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})$').firstMatch(trimmed);
    if (isoMatch != null) {
      final y = int.tryParse(isoMatch.group(1)!);
      final m = int.tryParse(isoMatch.group(2)!);
      final d = int.tryParse(isoMatch.group(3)!);
      if (y != null &&
          m != null &&
          d != null &&
          y >= 1900 &&
          m >= 1 &&
          m <= 12 &&
          d >= 1 &&
          d <= 31) {
        return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
      }
    }
    if (trimmed.contains('/')) {
      final parts = trimmed.split('/');
      if (parts.length == 3) {
        final m = int.tryParse(parts[0].trim());
        final d = int.tryParse(parts[1].trim());
        final y = int.tryParse(parts[2].trim());
        if (y != null &&
            m != null &&
            d != null &&
            y >= 1900 &&
            m >= 1 &&
            m <= 12 &&
            d >= 1 &&
            d <= 31) {
          return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
        }
      }
    }
    return null;
  }

  Future<void> _loadProfile() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      try {
        final doc = await _authService.getStudentProfile(uid);
        if (doc != null && mounted) {
          final data = doc;
          final rawSch =
              (data['scholarshipName'] ?? data['scholarship_name'] ?? '')
                  .toString()
                  .trim();
          final schName = (rawSch.isEmpty ||
                  rawSch.contains('No Scholarship') ||
                  rawSch.contains('Unassigned'))
              ? 'TES'
              : (rawSch.toUpperCase().contains('TES') ? 'TES' : rawSch);
          if (!_scholarshipOptions.contains(schName)) {
            _scholarshipOptions.add(schName);
          }

          final rawGender =
              (data['gender'] ?? data['sex'] ?? 'Male').toString().trim();
          String parsedGender = 'Male';
          if (rawGender.toLowerCase().startsWith('f')) {
            parsedGender = 'Female';
          } else if (rawGender.toLowerCase().startsWith('m')) {
            parsedGender = 'Male';
          } else if (rawGender.toLowerCase().contains('prefer')) {
            parsedGender = 'Prefer not to say';
          } else if (rawGender.isNotEmpty &&
              rawGender != 'N/A' &&
              rawGender != 'Not Specified') {
            parsedGender = rawGender;
          }
          if (!_genderOptions.contains(parsedGender)) {
            _genderOptions.add(parsedGender);
          }

          final fam = (data['familyDetails'] is Map)
              ? (data['familyDetails'] as Map)
              : {};
          final docs = (data['documents'] is Map)
              ? (data['documents'] as Map)
              : {};

          // Prioritize direct SA number columns first so saved edits reflect immediately
          final saCandidates = [
            data['saNumber'],
            data['sa_number'],
            fam['saNumber'],
            docs['saNumber'],
            docs['sa_number'],
            docs['atmExtractedSaNumber'],
          ];
          String resolvedSa = '';
          for (final cand in saCandidates) {
            if (cand != null) {
              final s = cand.toString().trim();
              if (s.isNotEmpty &&
                  s.toUpperCase() != 'N/A' &&
                  s.toLowerCase() != 'null') {
                resolvedSa = s;
                break;
              }
            }
          }

          final rawEmail =
              (data['email'] ?? data['email_address'] ?? '').toString().trim();
          final displayEmail = rawEmail.toLowerCase().endsWith('@scholardoc.com')
              ? ''
              : rawEmail;

          final rawBirthdate = (data['birthdate'] ??
                  data['birthday'] ??
                  data['date_of_birth'] ??
                  '')
              .toString();

          final rawSection = (data['section'] ??
                  fam['section'] ??
                  fam['section_name'] ??
                  '')
              .toString()
              .trim();

          final rawPayouts = data['payoutsReceived'] ??
              data['payouts_received'] ??
              fam['payoutsReceived'] ??
              fam['payouts_received'];

          final resolvedPhoto = (data['profilePictureUrl'] ??
                  data['profile_picture_url'])
              ?.toString()
              .trim();

          setState(() {
            _profileData = data;
            _selectedScholarship = schName;
            _selectedGender = parsedGender;
            _nameController.text =
                (data['fullName'] ?? data['full_name'] ?? '').toString().trim();
            _emailController.text = displayEmail;
            _contactController.text =
                (data['contactNumber'] ?? data['mobile_number'] ?? '')
                    .toString()
                    .trim();
            _sectionController.text = rawSection;
            _saController.text = resolvedSa;
            _birthdateController.text = _formatBirthdateForDisplay(rawBirthdate);
            _courseController.text =
                (data['course'] ?? data['program_name'] ?? '').toString().trim();
            _yearLevelController.text =
                (data['year'] ?? data['year_level'] ?? '').toString().trim();
            _yearBecameScholarController.text = (data['yearBecameScholar'] ??
                    data['year_became_scholar'] ??
                    data['scholarYearLevel'] ??
                    fam['yearBecameScholar'] ??
                    fam['scholarYearLevel'] ??
                    '')
                .toString()
                .trim();

            if (rawPayouts != null &&
                rawPayouts.toString().trim().isNotEmpty &&
                rawPayouts.toString().trim().toLowerCase() != 'null') {
              _payoutsReceivedController.text = rawPayouts.toString().trim();
            } else {
              _payoutsReceivedController.text = '';
            }

            _profilePictureUrl =
                (resolvedPhoto != null && resolvedPhoto.isNotEmpty)
                    ? resolvedPhoto
                    : null;
            _isProfileLoading = false;
            _captureInitialSnapshot();
          });
        }
      } catch (e) {
        debugPrint('ProfileScreen _loadProfile error: $e');
      } finally {
        if (mounted && _isProfileLoading) {
          setState(() => _isProfileLoading = false);
        }
      }
    } else {
      if (mounted && _isProfileLoading) {
        setState(() => _isProfileLoading = false);
      }
    }
  }

  Future<void> _handleProfileRefresh() async {
    try {
      HapticFeedback.lightImpact();
    } catch (_) {}
    await _loadProfile();
    if (mounted) {
      _showStatusSnackBar(
        'Profile synchronized with latest records',
        icon: LucideIcons.checkCheck,
        backgroundColor: const Color(0xFF0F3260),
        iconColor: const Color(0xFFFBC02D),
      );
    }
  }

  void _showStatusSnackBar(
    String message, {
    IconData icon = LucideIcons.checkCircle2,
    Color? backgroundColor,
    Color iconColor = Colors.white,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: iconColor, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: backgroundColor ?? AppTheme.success,
        duration: const Duration(milliseconds: 2400),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      ),
    );
  }

  Future<void> _copyStudentId(String studentId) async {
    final trimmed = studentId.trim();
    if (trimmed.isEmpty || trimmed == '...') return;
    await Clipboard.setData(ClipboardData(text: trimmed));
    try {
      HapticFeedback.selectionClick();
    } catch (_) {}
    _showStatusSnackBar(
      'Student ID ($trimmed) copied to clipboard',
      icon: LucideIcons.copy,
      backgroundColor: const Color(0xFF0F3260),
      iconColor: const Color(0xFFFBC02D),
    );
  }

  @override
  void dispose() {
    _scholarshipSub?.cancel();
    _nameFocusNode.dispose();
    _courseFocusNode.dispose();
    _saFocusNode.dispose();
    _yearBecameScholarController.dispose();
    _payoutsReceivedController.dispose();
    _saController.dispose();
    _nameController.dispose();
    _contactController.dispose();
    _sectionController.dispose();
    _emailController.dispose();
    _birthdateController.dispose();
    _courseController.dispose();
    _yearLevelController.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE HANDLERS (Personal, Academic Management, Banking, & Save All)
  // ─────────────────────────────────────────────────────────────────────────

  Map<String, dynamic> _buildPersonalPayload() {
    final rawPhone = _contactController.text.trim();
    final normalizedMobile = rawPhone.isNotEmpty
        ? (SmsService.normalizePhilippineMobile(rawPhone) ?? rawPhone)
        : '';
    final rawDob = _birthdateController.text.trim();
    final isoDob = _toIsoDateOrNull(rawDob);

    final payload = <String, dynamic>{
      'fullName': _nameController.text.trim(),
      'full_name': _nameController.text.trim(),
      'gender': _selectedGender ?? 'Male',
      'section': _sectionController.text.trim(),
      'contactNumber': normalizedMobile,
      'mobile_number': normalizedMobile,
      'birthdate': rawDob,
      'date_of_birth': isoDob,
    };

    final enteredEmail = _emailController.text.trim();
    if (enteredEmail.isNotEmpty) {
      payload['email'] = enteredEmail;
      payload['email_address'] = enteredEmail;
    } else {
      final existingEmail =
          (_profileData?['email'] ?? _profileData?['email_address'] ?? '')
              .toString()
              .trim();
      if (!existingEmail.toLowerCase().endsWith('@scholardoc.com')) {
        payload['email'] = '';
        payload['email_address'] = '';
      }
    }
    return payload;
  }

  Map<String, dynamic> _buildAcademicPayload() {
    final scholarYr = _yearBecameScholarController.text.trim();
    final payoutsStr = _payoutsReceivedController.text.trim();
    final payoutsNum = payoutsStr.isNotEmpty ? int.tryParse(payoutsStr) : null;

    return <String, dynamic>{
      'scholarshipName': _selectedScholarship ?? 'TES',
      'scholarship_name': _selectedScholarship ?? 'TES',
      'course': _courseController.text.trim(),
      'program_name': _courseController.text.trim(),
      'year': _yearLevelController.text.trim(),
      'year_level': _yearLevelController.text.trim(),
      'scholarYearLevel': scholarYr,
      'year_became_scholar': scholarYr,
      'yearBecameScholar': scholarYr,
      'payoutsReceived': payoutsNum,
      'payouts_received': payoutsNum != null ? payoutsStr : '',
    };
  }

  Map<String, dynamic> _buildBankingPayload() {
    final enteredSa = _saController.text.trim();
    return <String, dynamic>{
      'saNumber': enteredSa,
      'sa_number': enteredSa,
    };
  }

  Future<void> _handleSavePersonalInformation() async {
    _expandedSections.add('personal');
    if (_personalFormKey.currentState != null &&
        !_personalFormKey.currentState!.validate()) {
      setState(() {});
      _showStatusSnackBar(
        'Please fix the highlighted fields in Personal Information.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    if (_nameController.text.trim().isEmpty) {
      _showStatusSnackBar(
        'Full Name cannot be empty.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    await _executeProfileSave(
      sectionKey: 'personal',
      updates: _buildPersonalPayload(),
      auditAction: 'Updated Personal Information',
      successMessage: 'Personal Information saved successfully!',
    );
  }

  Future<void> _handleSaveAcademicManagement() async {
    _expandedSections.add('academic');
    if (_academicFormKey.currentState != null &&
        !_academicFormKey.currentState!.validate()) {
      setState(() {});
      _showStatusSnackBar(
        'Please fix the highlighted fields in Academic Management.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    await _executeProfileSave(
      sectionKey: 'academic',
      updates: _buildAcademicPayload(),
      auditAction: 'Updated Academic Management',
      successMessage: 'Academic Management changes saved!',
    );
  }

  Future<void> _handleSaveBankingDetails() async {
    _expandedSections.add('banking');
    if (_bankingFormKey.currentState != null &&
        !_bankingFormKey.currentState!.validate()) {
      setState(() {});
      _showStatusSnackBar(
        'Please enter a valid Savings Account (SA) number.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    await _executeProfileSave(
      sectionKey: 'banking',
      updates: _buildBankingPayload(),
      auditAction: 'Updated Banking & Disbursement Details',
      successMessage: 'Banking & Disbursement details updated!',
    );
  }

  Future<void> _handleSaveAllChanges() async {
    _expandedSections.addAll({'personal', 'academic', 'banking'});
    final pOk = _personalFormKey.currentState?.validate() ?? true;
    final aOk = _academicFormKey.currentState?.validate() ?? true;
    final bOk = _bankingFormKey.currentState?.validate() ?? true;
    if (!pOk || !aOk || !bOk) {
      setState(() {});
      _showStatusSnackBar(
        'Please review the highlighted validation errors before saving.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    final combined = <String, dynamic>{
      ..._buildPersonalPayload(),
      ..._buildAcademicPayload(),
      ..._buildBankingPayload(),
    };

    await _executeProfileSave(
      sectionKey: 'all',
      updates: combined,
      auditAction: 'Updated complete student profile',
      successMessage: 'All profile changes saved successfully!',
    );
  }

  Future<void> _executeProfileSave({
    required String sectionKey,
    required Map<String, dynamic> updates,
    required String auditAction,
    required String successMessage,
  }) async {
    final uid = _authService.currentUser?.id;
    if (uid == null) {
      _showStatusSnackBar(
        'No active student session found. Please sign in again.',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _savingSection = sectionKey);

    try {
      await _authService.updateStudentProfile(uid, updates);
      await _auditService.logActivity(
        action: auditAction,
        userName: _nameController.text.trim().isNotEmpty
            ? _nameController.text.trim()
            : 'Student',
        role: 'Student',
        studentId: (_profileData?['studentId'] ?? _profileData?['student_no'])
            ?.toString(),
      );

      if (!mounted) return;
      try {
        HapticFeedback.mediumImpact();
      } catch (_) {}

      if (sectionKey == 'all') {
        _editingSections.clear();
      } else {
        _editingSections.remove(sectionKey);
      }

      await _loadProfile();
      _showStatusSnackBar(successMessage);
    } catch (e) {
      if (!mounted) return;
      _showStatusSnackBar(
        'Failed to save changes: $e',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
    } finally {
      if (mounted) {
        setState(() => _savingSection = null);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final String rawName =
        (_profileData?['fullName'] ?? _profileData?['full_name'] ?? '')
            .toString()
            .trim();
    final String studentId =
        (_profileData?['studentId'] ?? _profileData?['student_no'] ?? '')
            .toString()
            .trim();
    final String displayName = (rawName.isNotEmpty &&
            rawName != studentId &&
            !RegExp(r'^\d+$').hasMatch(rawName))
        ? rawName
        : (_nameController.text.trim().isNotEmpty
            ? _nameController.text.trim()
            : 'Student Scholar');

    final String rawCourse = (_courseController.text.trim().isNotEmpty
            ? _courseController.text.trim()
            : (_profileData?['course'] ?? _profileData?['program_name'] ?? ''))
        .toString()
        .trim();
    final String displayCourse = (rawCourse.isNotEmpty &&
            rawCourse != 'CHED TES Scholar' &&
            rawCourse != 'TES')
        ? rawCourse
        : 'Degree Program Not Set';

    final String rawYear = (_yearLevelController.text.trim().isNotEmpty
            ? _yearLevelController.text.trim()
            : (_profileData?['year'] ?? _profileData?['year_level'] ?? ''))
        .toString()
        .trim();
    final String displayYear = rawYear.isNotEmpty
        ? (rawYear.toLowerCase().contains('year') ? rawYear : '$rawYear Year')
        : 'Year Level Not Set';

    final String scholarshipLabel =
        _selectedScholarship ?? _profileData?['scholarshipName'] ?? 'TES';

    final String rawStatus =
        (_profileData?['status'] ?? 'Active Scholar').toString().trim();

    return Scaffold(
      backgroundColor: context.bgC,
      body: RefreshIndicator(
        color: AppTheme.primaryColor,
        backgroundColor: context.surfaceC,
        strokeWidth: 2.6,
        displacement: 40,
        onRefresh: _handleProfileRefresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            // ─── Executive Profile Hero Header ───
            SliverToBoxAdapter(
              child: _buildProfileHeroHeader(
                context: context,
                displayName: displayName,
                studentId: studentId,
                displayCourse: displayCourse,
                displayYear: displayYear,
                scholarshipLabel: scholarshipLabel,
                statusLabel: rawStatus,
              ),
            ),

            // ─── Main Structured Profile Sections ───
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 110),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Summary Overview Strip
                    _buildQuickSummaryStrip(
                      context: context,
                      scholarshipLabel: scholarshipLabel,
                      displayYear: displayYear,
                    ),

                    // Unsaved Master Save Bar (shown whenever edits exist)
                    if (_hasAnyUnsavedChanges) ...[
                      const SizedBox(height: 16),
                      _buildUnsavedChangesBanner(context),
                    ],

                    const SizedBox(height: 22),
                    _buildSectionCategoryHeader(
                      context,
                      'IDENTITY & CONTACT DETAILS',
                      LucideIcons.shieldCheck,
                    ),
                    const SizedBox(height: 10),

                    // 1. PERSONAL INFORMATION
                    Form(
                      key: _personalFormKey,
                      child: _buildSectionCard(
                        sectionKey: 'personal',
                        title: 'Personal Information',
                        icon: LucideIcons.user,
                        subtitle: displayName != 'Student Scholar'
                            ? '$displayName • Contact & identity'
                            : 'Manage your full name, contact & class section',
                        isDirty: _isPersonalDirty,
                        actionLabel: 'Edit',
                        onActionTap: () => _toggleEditSection('personal'),
                        children: [
                          _buildEditableField(
                            label: 'Full Name *',
                            controller: _nameController,
                            focusNode: _nameFocusNode,
                            icon: LucideIcons.user,
                            hintText: 'LAST NAME, FIRST NAME M.I.',
                            sectionKey: 'personal',
                            validator: (v) =>
                                (v == null || v.trim().isEmpty)
                                    ? 'Full Name is required'
                                    : null,
                          ),
                          const SizedBox(height: 14),
                          LayoutBuilder(
                            builder: (ctx, constraints) {
                              if (constraints.maxWidth >= 340) {
                                return Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(child: _buildGenderDropdownField()),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: _buildBirthdateField(context),
                                    ),
                                  ],
                                );
                              }
                              return Column(
                                children: [
                                  _buildGenderDropdownField(),
                                  const SizedBox(height: 14),
                                  _buildBirthdateField(context),
                                ],
                              );
                            },
                          ),
                          const SizedBox(height: 14),
                          _buildEditableField(
                            label: 'Email Address',
                            controller: _emailController,
                            icon: LucideIcons.mail,
                            hintText: 'e.g. scholar@ustp.edu.ph',
                            keyboardType: TextInputType.emailAddress,
                            sectionKey: 'personal',
                            validator: (v) {
                              final val = (v ?? '').trim();
                              if (val.isEmpty) return null;
                              final emailRegex =
                                  RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                              if (!emailRegex.hasMatch(val)) {
                                return 'Enter a valid email address';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          _buildEditableField(
                            label: 'Mobile Number (SMS Alerts)',
                            controller: _contactController,
                            icon: LucideIcons.phone,
                            hintText: '09123456789',
                            keyboardType: TextInputType.phone,
                            helperText:
                                'Used for OTP security & Semaphore scholarship SMS updates',
                            sectionKey: 'personal',
                            validator: (v) {
                              final val = (v ?? '').trim();
                              if (val.isEmpty) return null;
                              if (!SmsService.isValidPhilippineMobile(val)) {
                                return 'Enter a valid 11-digit PH mobile (e.g. 09123456789)';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          _buildEditableField(
                            label: 'Class Section / Block',
                            controller: _sectionController,
                            icon: LucideIcons.layers,
                            hintText: 'e.g. BSIT-3A (Optional)',
                            sectionKey: 'personal',
                            validator: (_) => null,
                          ),
                          const SizedBox(height: 18),
                          _buildSectionSaveFooter(
                            sectionKey: 'personal',
                            buttonLabel: 'Save Personal Information',
                            isDirty: _isPersonalDirty,
                            onSave: _handleSavePersonalInformation,
                            onReset: () => _resetSection('personal'),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 22),
                    _buildSectionCategoryHeader(
                      context,
                      'ACADEMIC & SCHOLARSHIP RECORD',
                      LucideIcons.graduationCap,
                    ),
                    const SizedBox(height: 10),

                    // 2. ACADEMIC MANAGEMENT
                    Form(
                      key: _academicFormKey,
                      child: _buildSectionCard(
                        sectionKey: 'academic',
                        title: 'Academic Management',
                        icon: LucideIcons.graduationCap,
                        subtitle:
                            '$scholarshipLabel • ${_yearLevelController.text.trim().isNotEmpty ? _yearLevelController.text.trim() : "Program & grant history"}',
                        isDirty: _isAcademicDirty,
                        actionLabel: 'Manage',
                        onActionTap: () => _toggleEditSection('academic'),
                        children: [
                          _buildInstitutionalIdBanner(
                            context,
                            studentId.isNotEmpty ? studentId : '...',
                          ),
                          const SizedBox(height: 16),
                          _buildScholarshipDropdownField(),
                          const SizedBox(height: 16),
                          _buildCourseField(),
                          const SizedBox(height: 16),
                          _buildYearLevelField(),
                          const SizedBox(height: 16),
                          _buildYearBecameScholarField(),
                          const SizedBox(height: 16),
                          _buildPayoutsReceivedField(),
                          const SizedBox(height: 20),
                          _buildSectionSaveFooter(
                            sectionKey: 'academic',
                            buttonLabel: 'Save Academic Changes',
                            isDirty: _isAcademicDirty,
                            onSave: _handleSaveAcademicManagement,
                            onReset: () => _resetSection('academic'),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 22),
                    _buildSectionCategoryHeader(
                      context,
                      'FINANCIAL & DISBURSEMENT',
                      LucideIcons.landmark,
                    ),
                    const SizedBox(height: 10),

                    // 3. BANKING & DISBURSEMENT DETAILS
                    Form(
                      key: _bankingFormKey,
                      child: _buildSectionCard(
                        sectionKey: 'banking',
                        title: 'Banking & Disbursement',
                        icon: LucideIcons.landmark,
                        subtitle: _saController.text.trim().isNotEmpty
                            ? 'SA Account: ${_saController.text.trim()}'
                            : 'Register your Landbank Savings Account (SA)',
                        isDirty: _isBankingDirty,
                        actionLabel: 'Update',
                        onActionTap: () => _toggleEditSection('banking'),
                        children: [
                          _buildBankingInfoCallout(context),
                          const SizedBox(height: 16),
                          _buildSaNumberField(context),
                          const SizedBox(height: 18),
                          _buildSectionSaveFooter(
                            sectionKey: 'banking',
                            buttonLabel: 'Update Banking Details',
                            isDirty: _isBankingDirty,
                            onSave: _handleSaveBankingDetails,
                            onReset: () => _resetSection('banking'),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 22),
                    _buildSectionCategoryHeader(
                      context,
                      'PREFERENCES, SECURITY & SESSION',
                      LucideIcons.settings,
                    ),
                    const SizedBox(height: 10),

                    // 4. UNIFIED SYSTEM & ACCOUNT SETTINGS CARD
                    _buildSystemSettingsCard(context),

                    const SizedBox(height: 16),

                    // 5. SIGN OUT CARD
                    _buildLogoutTile(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HERO HEADER & OVERVIEW WIDGETS
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildProfileHeroHeader({
    required BuildContext context,
    required String displayName,
    required String studentId,
    required String displayCourse,
    required String displayYear,
    required String scholarshipLabel,
    required String statusLabel,
  }) {
    final allExpanded = _expandedSections.length >= 3;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0A2446), Color(0xFF0F3260), Color(0xFF1E3A8A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        border: Border(
          bottom: BorderSide(color: Color(0xFFFBC02D), width: 3.0),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 24),
          child: Column(
            children: [
              // Top Action Bar
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.16),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          LucideIcons.shieldCheck,
                          size: 13,
                          color: Color(0xFFFBC02D),
                        ),
                        SizedBox(width: 6),
                        Text(
                          'SCHOLAR PROFILE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Tooltip(
                    message:
                        allExpanded ? 'Collapse sections' : 'Expand sections',
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          if (allExpanded) {
                            _expandedSections.clear();
                          } else {
                            _expandedSections
                                .addAll({'personal', 'academic', 'banking'});
                          }
                        });
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.16),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              allExpanded
                                  ? LucideIcons.chevronUp
                                  : LucideIcons.chevronDown,
                              size: 14,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              allExpanded ? 'Collapse' : 'Expand All',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Tooltip(
                    message: 'Refresh profile data',
                    child: InkWell(
                      onTap: _isProfileLoading ? null : _handleProfileRefresh,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.16),
                          ),
                        ),
                        child: const Icon(
                          LucideIcons.refreshCw,
                          size: 15,
                          color: Color(0xFFFBC02D),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Avatar + Upload Photo Trigger
              GestureDetector(
                onTap: _isUploadingPhoto ? null : _pickAndUploadPhoto,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(3.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFFBC02D),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFBC02D).withOpacity(0.28),
                            blurRadius: 18,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: AppTheme.primaryColor,
                          shape: BoxShape.circle,
                        ),
                        child: _buildAvatarWidget(),
                      ),
                    ),
                    Positioned(
                      bottom: 2,
                      right: 2,
                      child: Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFBC02D),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFF0F3260),
                            width: 2,
                          ),
                        ),
                        child: _isUploadingPhoto
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppTheme.primaryColor,
                                ),
                              )
                            : const Icon(
                                LucideIcons.camera,
                                size: 14,
                                color: AppTheme.primaryColor,
                              ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              if (_isProfileLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Color(0xFFFBC02D),
                      strokeWidth: 2.5,
                    ),
                  ),
                )
              else ...[
                Text(
                  displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$displayCourse • $displayYear',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    if (studentId.isNotEmpty)
                      InkWell(
                        onTap: () => _copyStudentId(studentId),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 11,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.24),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                LucideIcons.badgeCheck,
                                size: 13,
                                color: Color(0xFFFBC02D),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                'ID: $studentId',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Icon(
                                LucideIcons.copy,
                                size: 11,
                                color: Colors.white.withOpacity(0.75),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.accentColor.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppTheme.accentColor.withOpacity(0.45),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            LucideIcons.award,
                            size: 13,
                            color: AppTheme.accentColor,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            scholarshipLabel,
                            style: const TextStyle(
                              color: AppTheme.accentColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _buildHeaderStatusPill(statusLabel),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderStatusPill(String status) {
    final lower = status.toLowerCase();
    Color pillColor = const Color(0xFF38BDF8);
    if (lower.contains('approv') || lower.contains('verif')) {
      pillColor = const Color(0xFF4ADE80);
    } else if (lower.contains('reject') || lower.contains('resubmit')) {
      pillColor = const Color(0xFFF87171);
    } else if (lower.contains('pend')) {
      pillColor = const Color(0xFFFBBF24);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: pillColor.withOpacity(0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: pillColor.withOpacity(0.45)),
      ),
      child: Text(
        status.isEmpty ? 'Active Scholar' : status,
        style: TextStyle(
          color: pillColor,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _buildQuickSummaryStrip({
    required BuildContext context,
    required String scholarshipLabel,
    required String displayYear,
  }) {
    final sectionText = _sectionController.text.trim();
    final levelSummary = sectionText.isNotEmpty
        ? '${displayYear.replaceAll(' Not Set', '')} • $sectionText'
        : displayYear.replaceAll(' Not Set', 'Not Set');
    final hasSa = _saController.text.trim().isNotEmpty;
    final payoutsText = _payoutsReceivedController.text.trim();
    final bankSummary = hasSa
        ? (payoutsText.isNotEmpty ? 'SA Set • $payoutsText Payouts' : 'SA Recorded')
        : 'SA Not Set';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _buildSummaryMetric(
                context: context,
                icon: LucideIcons.award,
                label: 'GRANT',
                value: scholarshipLabel,
                accent: const Color(0xFFF59E0B),
              ),
            ),
            VerticalDivider(width: 16, thickness: 1, color: context.crispBorder),
            Expanded(
              child: _buildSummaryMetric(
                context: context,
                icon: LucideIcons.graduationCap,
                label: 'YEAR & BLOCK',
                value: levelSummary,
                accent: context.isDark
                    ? const Color(0xFF60A5FA)
                    : AppTheme.primaryColor,
              ),
            ),
            VerticalDivider(width: 16, thickness: 1, color: context.crispBorder),
            Expanded(
              child: _buildSummaryMetric(
                context: context,
                icon: LucideIcons.landmark,
                label: 'DISBURSEMENT',
                value: bankSummary,
                accent: hasSa ? AppTheme.success : AppTheme.error,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryMetric({
    required BuildContext context,
    required IconData icon,
    required String label,
    required String value,
    required Color accent,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: accent),
        const SizedBox(height: 5),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
            color: context.textSec,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: context.textPri,
          ),
        ),
      ],
    );
  }

  Widget _buildUnsavedChangesBanner(BuildContext context) {
    final isSavingAll = _savingSection == 'all';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: context.isDark
            ? const Color(0xFF422006).withOpacity(0.55)
            : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFF59E0B).withOpacity(0.5),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          const Icon(
            LucideIcons.info,
            size: 18,
            color: Color(0xFFD97706),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'You have unsaved profile edits',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: context.isDark
                    ? const Color(0xFFFDE68A)
                    : const Color(0xFF92400E),
              ),
            ),
          ),
          TextButton(
            onPressed: _isSaving ? null : () => _resetSection('all'),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Reset',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: context.textSec,
              ),
            ),
          ),
          const SizedBox(width: 6),
          ElevatedButton(
            onPressed: _isSaving ? null : _handleSaveAllChanges,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: isSavingAll
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Save All',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCategoryHeader(
    BuildContext context,
    String title,
    IconData icon,
  ) {
    final accent =
        context.isDark ? const Color(0xFFFBC02D) : AppTheme.primaryColor;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Row(
        children: [
          Icon(icon, size: 13, color: accent),
          const SizedBox(width: 7),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
              color: context.textSec,
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REUSABLE SECTION CARD & SAVE FOOTER
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildSectionCard({
    required String sectionKey,
    required String title,
    required IconData icon,
    required String subtitle,
    required List<Widget> children,
    bool isDirty = false,
    String? actionLabel,
    VoidCallback? onActionTap,
  }) {
    final bool isExpanded = _expandedSections.contains(sectionKey);
    final bool isEditing = _editingSections.contains(sectionKey);
    final Color headingColor =
        context.isDark ? Colors.white : const Color(0xFF0F3260);
    final Color iconAccent =
        context.isDark ? const Color(0xFFFBC02D) : AppTheme.primaryColor;

    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: (isEditing || isDirty)
              ? const Color(0xFFFBC02D).withOpacity(0.75)
              : (isExpanded
                  ? AppTheme.primaryColor.withOpacity(context.isDark ? 0.45 : 0.2)
                  : context.crispBorder),
          width: (isEditing || isDirty) ? 1.8 : 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isExpanded
                ? AppTheme.primaryColor.withOpacity(context.isDark ? 0.14 : 0.04)
                : Colors.black.withOpacity(0.015),
            blurRadius: isExpanded ? 16 : 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header Row
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedSections.remove(sectionKey);
                  } else {
                    _expandedSections.add(sectionKey);
                  }
                });
              },
              borderRadius: isExpanded
                  ? const BorderRadius.vertical(top: Radius.circular(20))
                  : BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 14, 16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: context.isDark
                            ? const Color(0xFFFBC02D).withOpacity(0.14)
                            : AppTheme.primaryColor.withOpacity(
                                isExpanded ? 0.12 : 0.06,
                              ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, size: 18, color: iconAccent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: headingColor,
                                  ),
                                ),
                              ),
                              if (isDirty) ...[
                                const SizedBox(width: 7),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B)
                                        .withOpacity(0.16),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Text(
                                    'Unsaved',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFD97706),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textSec,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (actionLabel != null && onActionTap != null) ...[
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: onActionTap,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: isEditing
                                ? const Color(0xFFFBC02D).withOpacity(0.22)
                                : (context.isDark
                                    ? Colors.white.withOpacity(0.08)
                                    : AppTheme.primaryColor.withOpacity(0.07)),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isEditing
                                  ? const Color(0xFFFBC02D)
                                  : Colors.transparent,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isEditing
                                    ? LucideIcons.check
                                    : LucideIcons.edit2,
                                size: 12,
                                color: isEditing
                                    ? (context.isDark
                                        ? const Color(0xFFFBC02D)
                                        : const Color(0xFF92400E))
                                    : iconAccent,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                isEditing ? 'Editing' : actionLabel,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: isEditing
                                      ? (context.isDark
                                          ? const Color(0xFFFBC02D)
                                          : const Color(0xFF92400E))
                                      : iconAccent,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 6),
                    AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 220),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isExpanded
                              ? iconAccent.withOpacity(0.1)
                              : context.bgC,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          LucideIcons.chevronDown,
                          size: 16,
                          color: isExpanded ? iconAccent : context.textSec,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Body
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              children: [
                Divider(height: 1, color: context.crispBorder),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: children,
                  ),
                ),
              ],
            ),
            crossFadeState: isExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 220),
            sizeCurve: Curves.easeInOut,
          ),
        ],
      ),
    );
  }

  Widget _buildSectionSaveFooter({
    required String sectionKey,
    required String buttonLabel,
    required bool isDirty,
    required VoidCallback onSave,
    required VoidCallback onReset,
  }) {
    final bool isThisSaving = _savingSection == sectionKey;
    final bool showReset = isDirty || _editingSections.contains(sectionKey);

    return Row(
      children: [
        if (showReset) ...[
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _isSaving ? null : onReset,
              icon: const Icon(LucideIcons.rotateCcw, size: 15),
              label: const Text(
                'Reset',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: context.textSec,
                side: BorderSide(color: context.crispBorder, width: 1.5),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
        ],
        Expanded(
          child: SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _isSaving ? null : onSave,
              icon: isThisSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(LucideIcons.check, size: 18),
              label: Text(
                isThisSaving ? 'Saving Changes...' : buttonLabel,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                elevation: isDirty ? 3 : 1,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM FIELDS (PERSONAL, ACADEMIC MANAGEMENT, BANKING)
  // ─────────────────────────────────────────────────────────────────────────

  Color _fieldIconColor(BuildContext context) =>
      context.isDark ? const Color(0xFFFBC02D) : AppTheme.primaryColor;

  InputDecoration _fieldDecoration({
    required BuildContext context,
    required IconData icon,
    String? hintText,
    String? helperText,
    Widget? suffixIcon,
    Color? fillColor,
  }) {
    return InputDecoration(
      prefixIcon: Icon(icon, size: 16, color: _fieldIconColor(context)),
      suffixIcon: suffixIcon,
      hintText: hintText,
      helperText: helperText,
      helperMaxLines: 2,
      filled: true,
      fillColor: fillColor ?? context.bgC,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.crispBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFFBC02D), width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.error, width: 2),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          color: context.textSec,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildEditableField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    FocusNode? focusNode,
    String? hintText,
    TextInputType? keyboardType,
    String? helperText,
    String? sectionKey,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel(label),
        TextFormField(
          controller: controller,
          focusNode: focusNode,
          keyboardType: keyboardType,
          onTap: () {
            if (sectionKey != null && !_editingSections.contains(sectionKey)) {
              setState(() => _editingSections.add(sectionKey));
            }
          },
          validator: validator ??
              (v) => (v == null || v.trim().isEmpty)
                  ? 'Field cannot be empty'
                  : null,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: icon,
            hintText: hintText,
            helperText: helperText,
            suffixIcon: controller.text.isNotEmpty
                ? IconButton(
                    tooltip: 'Clear field',
                    icon: Icon(
                      LucideIcons.x,
                      size: 15,
                      color: context.textSec,
                    ),
                    onPressed: () {
                      controller.clear();
                      if (sectionKey != null) {
                        setState(() => _editingSections.add(sectionKey));
                      }
                    },
                  )
                : null,
          ),
        ),
      ],
    );
  }

  Widget _buildGenderDropdownField() {
    final currentVal = _genderOptions.contains(_selectedGender)
        ? _selectedGender
        : _genderOptions.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Gender'),
        DropdownButtonFormField<String>(
          value: currentVal,
          isExpanded: true,
          dropdownColor: context.surfaceC,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 13.5,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.user,
          ),
          items: _genderOptions.map((gender) {
            return DropdownMenuItem<String>(
              value: gender,
              child: Text(
                gender,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13.5,
                  color: context.textPri,
                ),
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedGender = val;
                _editingSections.add('personal');
              });
            }
          },
        ),
      ],
    );
  }

  Widget _buildBirthdateField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Birthdate'),
        TextFormField(
          controller: _birthdateController,
          readOnly: false,
          keyboardType: TextInputType.datetime,
          onTap: () {
            setState(() => _editingSections.add('personal'));
            if (_birthdateController.text.trim().isEmpty) {
              _selectBirthdate(context);
            }
          },
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.cake,
            hintText: 'MM/DD/YYYY',
            suffixIcon: IconButton(
              tooltip: 'Pick date from calendar',
              icon: Icon(
                LucideIcons.calendarDays,
                size: 17,
                color: _fieldIconColor(context),
              ),
              onPressed: () => _selectBirthdate(context),
            ),
          ),
          validator: (v) {
            final val = (v ?? '').trim();
            if (val.isEmpty) return null;
            if (_toIsoDateOrNull(val) == null) {
              return 'Use MM/DD/YYYY';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildInstitutionalIdBanner(BuildContext context, String studentId) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: context.isDark
            ? Colors.white.withOpacity(0.04)
            : AppTheme.primaryColor.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.crispBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _fieldIconColor(context).withOpacity(0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              LucideIcons.badgeCheck,
              size: 17,
              color: _fieldIconColor(context),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'INSTITUTIONAL STUDENT ID (VERIFIED)',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: context.textSec,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  studentId,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: context.textPri,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => _copyStudentId(studentId),
            icon: Icon(
              LucideIcons.copy,
              size: 13,
              color: _fieldIconColor(context),
            ),
            label: Text(
              'Copy',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _fieldIconColor(context),
              ),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScholarshipDropdownField() {
    final currentSch = _scholarshipOptions.contains(_selectedScholarship)
        ? _selectedScholarship
        : 'TES';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Scholarship Program'),
        DropdownButtonFormField<String>(
          value: currentSch,
          isExpanded: true,
          dropdownColor: context.surfaceC,
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.award,
          ),
          items: _scholarshipOptions.map((name) {
            return DropdownMenuItem<String>(
              value: name,
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.sparkles,
                    size: 14,
                    color: Color(0xFFFBC02D),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      name,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: context.textPri,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedScholarship = val;
                _editingSections.add('academic');
              });
            }
          },
          validator: (val) =>
              val == null || val.isEmpty ? 'Please select a scholarship' : null,
        ),
      ],
    );
  }

  Widget _buildCourseField() {
    const quickCourses = [
      'BS in Information Technology',
      'BSIT',
      'BSCS',
      'BSBA',
      'BSED',
      'BEED',
      'BSHM',
      'BSN',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Degree Program / Course *'),
        TextFormField(
          controller: _courseController,
          focusNode: _courseFocusNode,
          onTap: () => setState(() => _editingSections.add('academic')),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.graduationCap,
            hintText: 'e.g. BS in Information Technology',
            suffixIcon: _courseController.text.isNotEmpty
                ? IconButton(
                    tooltip: 'Clear course',
                    icon: Icon(
                      LucideIcons.x,
                      size: 15,
                      color: context.textSec,
                    ),
                    onPressed: () {
                      _courseController.clear();
                      setState(() => _editingSections.add('academic'));
                    },
                  )
                : null,
          ),
          validator: (v) => (v == null || v.trim().isEmpty)
              ? 'Degree Program / Course is required'
              : null,
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: quickCourses.map((c) {
              final isSelected =
                  _courseController.text.trim().toLowerCase() ==
                  c.toLowerCase();
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ActionChip(
                  label: Text(
                    c,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.white : context.textPri,
                    ),
                  ),
                  backgroundColor:
                      isSelected ? AppTheme.primaryColor : context.surfaceC,
                  side: BorderSide(
                    color: isSelected
                        ? AppTheme.primaryColor
                        : context.crispBorder,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () {
                    setState(() {
                      _courseController.text = c;
                      _editingSections.add('academic');
                    });
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildYearLevelField() {
    const quickYears = [
      '1st Year',
      '2nd Year',
      '3rd Year',
      '4th Year',
      '5th Year',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Current Year Level *'),
        TextFormField(
          controller: _yearLevelController,
          onTap: () => setState(() => _editingSections.add('academic')),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.calendar,
            hintText: 'e.g. 3rd Year',
          ),
          validator: (v) =>
              (v == null || v.trim().isEmpty) ? 'Year Level is required' : null,
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: quickYears.map((yr) {
              final currentText = _yearLevelController.text.trim().toLowerCase();
              final isSelected = currentText == yr.toLowerCase() ||
                  currentText.startsWith(yr.toLowerCase());
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ActionChip(
                  label: Text(
                    yr,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.white : context.textPri,
                    ),
                  ),
                  backgroundColor:
                      isSelected ? AppTheme.primaryColor : context.surfaceC,
                  side: BorderSide(
                    color: isSelected
                        ? AppTheme.primaryColor
                        : context.crispBorder,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () {
                    setState(() {
                      _yearLevelController.text = yr;
                      _editingSections.add('academic');
                    });
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildYearBecameScholarField() {
    const quickYears = [
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
      '1st Year',
      '2nd Year',
      '3rd Year',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Year Became a Scholar'),
        TextFormField(
          controller: _yearBecameScholarController,
          onTap: () => setState(() => _editingSections.add('academic')),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.calendarCheck,
            hintText: 'e.g. 2023, 2024, or 1st Year',
            suffixIcon: _yearBecameScholarController.text.isNotEmpty
                ? IconButton(
                    tooltip: 'Clear',
                    icon: Icon(
                      LucideIcons.x,
                      size: 15,
                      color: context.textSec,
                    ),
                    onPressed: () {
                      _yearBecameScholarController.clear();
                      setState(() => _editingSections.add('academic'));
                    },
                  )
                : null,
          ),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: quickYears.map((yr) {
              final isSelected = _yearBecameScholarController.text.trim() == yr;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ActionChip(
                  label: Text(
                    yr,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.white : context.textPri,
                    ),
                  ),
                  backgroundColor:
                      isSelected ? AppTheme.primaryColor : context.surfaceC,
                  side: BorderSide(
                    color: isSelected
                        ? AppTheme.primaryColor
                        : context.crispBorder,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () {
                    setState(() {
                      _yearBecameScholarController.text = yr;
                      _editingSections.add('academic');
                    });
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildPayoutsReceivedField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Payouts / Disbursements Received to Date'),
        TextFormField(
          controller: _payoutsReceivedController,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onTap: () => setState(() => _editingSections.add('academic')),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.wallet,
            hintText: '0',
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: 'Decrease payouts',
                  icon: Icon(
                    LucideIcons.minusCircle,
                    size: 19,
                    color: _fieldIconColor(context),
                  ),
                  onPressed: () {
                    int val =
                        int.tryParse(_payoutsReceivedController.text.trim()) ??
                            0;
                    if (val > 0) val--;
                    setState(() {
                      _payoutsReceivedController.text = val.toString();
                      _editingSections.add('academic');
                    });
                  },
                ),
                IconButton(
                  tooltip: 'Increase payouts',
                  icon: Icon(
                    LucideIcons.plusCircle,
                    size: 19,
                    color: _fieldIconColor(context),
                  ),
                  onPressed: () {
                    int val =
                        int.tryParse(_payoutsReceivedController.text.trim()) ??
                            0;
                    val++;
                    setState(() {
                      _payoutsReceivedController.text = val.toString();
                      _editingSections.add('academic');
                    });
                  },
                ),
              ],
            ),
          ),
          validator: (v) {
            final val = (v ?? '').trim();
            if (val.isEmpty) return null;
            final parsed = int.tryParse(val);
            if (parsed == null || parsed < 0) {
              return 'Enter a valid non-negative number';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildBankingInfoCallout(BuildContext context) {
    final saText = _saController.text.trim();
    final verStatus = (_profileData?['saVerificationStatus'] ??
            _profileData?['sa_verification_status'] ??
            '')
        .toString()
        .trim();
    final bool isVerified = verStatus.toLowerCase().contains('verif') ||
        verStatus.toLowerCase().contains('approv');
    final String badgeText = isVerified
        ? 'Verified Account'
        : (saText.isNotEmpty ? 'Recorded' : 'Not Configured');
    final Color badgeColor = isVerified
        ? AppTheme.success
        : (saText.isNotEmpty ? const Color(0xFFD97706) : AppTheme.error);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgC,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.crispBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.shieldCheck,
                size: 15,
                color: _fieldIconColor(context),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Landbank Disbursement Account',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: context.textPri,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: badgeColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Your Savings Account (SA) number is used by the university scholarship & finance office for direct grant disbursement.',
            style: TextStyle(
              fontSize: 12,
              color: context.textSec,
              height: 1.45,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaNumberField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Savings Account (SA) Number'),
        TextFormField(
          controller: _saController,
          focusNode: _saFocusNode,
          keyboardType: TextInputType.text,
          onTap: () => setState(() => _editingSections.add('banking')),
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 15,
            letterSpacing: 0.6,
            color: context.textPri,
          ),
          decoration: _fieldDecoration(
            context: context,
            icon: LucideIcons.creditCard,
            hintText: 'e.g. 1234-5678-90',
            helperText: 'Enter your 10 to 12-digit Landbank SA number',
            suffixIcon: _saController.text.isNotEmpty
                ? IconButton(
                    tooltip: 'Clear SA number',
                    icon: Icon(
                      LucideIcons.x,
                      size: 16,
                      color: context.textSec,
                    ),
                    onPressed: () {
                      _saController.clear();
                      setState(() => _editingSections.add('banking'));
                    },
                  )
                : null,
          ),
          validator: (value) {
            final trimmed = (value ?? '').trim();
            if (trimmed.isEmpty) return null;
            final digitsOnly = trimmed.replaceAll(RegExp(r'[\s\-]'), '');
            if (!RegExp(r'^\d{8,16}$').hasMatch(digitsOnly)) {
              return 'Enter a valid SA number (8–16 digits, hyphens allowed)';
            }
            return null;
          },
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYSTEM & ACCOUNT SETTINGS + LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildSystemSettingsCard(BuildContext context) {
    final iconColor = _fieldIconColor(context);
    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        children: [
          // 1. Dark Mode Toggle Row
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
            child: ValueListenableBuilder<ThemeMode>(
              valueListenable: ThemeProvider().themeNotifier,
              builder: (context, theme, _) {
                final isDark = theme == ThemeMode.dark;
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: iconColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        isDark ? LucideIcons.moonStar : LucideIcons.moon,
                        size: 18,
                        color: iconColor,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Dark Mode',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                              color: context.textPri,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Switch between Light and Dark appearance',
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textSec,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: isDark,
                      activeThumbColor: const Color(0xFFFBC02D),
                      activeTrackColor:
                          const Color(0xFFFBC02D).withOpacity(0.32),
                      onChanged: (_) => ThemeProvider().toggleTheme(),
                    ),
                  ],
                );
              },
            ),
          ),

          Divider(height: 1, color: context.crispBorder),

          // 2. Account Activity Log Row
          InkWell(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const StudentActivityLogScreen(),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: iconColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      LucideIcons.history,
                      size: 18,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'View Account Activity',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14.5,
                            color: context.textPri,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Security, profile updates & submission audit logs',
                          style: TextStyle(
                            fontSize: 12,
                            color: context.textSec,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.accentColor.withOpacity(0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.chevronRight,
                      size: 16,
                      color: context.isDark
                          ? const Color(0xFFFBC02D)
                          : const Color(0xFF0F3260),
                    ),
                  ),
                ],
              ),
            ),
          ),

          Divider(height: 1, color: context.crispBorder),

          // 3. Sync & Refresh Profile Row
          InkWell(
            onTap: _isProfileLoading ? null : _handleProfileRefresh,
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(20),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: iconColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      LucideIcons.refreshCw,
                      size: 18,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sync Profile Record',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14.5,
                            color: context.textPri,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Reload latest scholarship verification & profile data',
                          style: TextStyle(
                            fontSize: 12,
                            color: context.textSec,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    size: 16,
                    color: context.textSec,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoutTile(BuildContext context) {
    return InkWell(
      onTap: _handleLogout,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.error.withOpacity(0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: AppTheme.error.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                LucideIcons.logOut,
                size: 20,
                color: AppTheme.error,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Log Out',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppTheme.error,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Sign out of your ScholarDoc account',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.textSec,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              LucideIcons.chevronRight,
              size: 18,
              color: AppTheme.error.withOpacity(0.7),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVATAR UPLOAD, DATE PICKER & LOGOUT DIALOG
  // ─────────────────────────────────────────────────────────────────────────

  Widget _buildAvatarWidget() {
    final String? url = _profilePictureUrl;
    if (url != null && url.isNotEmpty) {
      return ClipOval(
        child: SizedBox(
          width: 92,
          height: 92,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  color: const Color(0xFF1A4F9E),
                  alignment: Alignment.center,
                  child: const Icon(
                    LucideIcons.user,
                    size: 44,
                    color: Colors.white,
                  ),
                ),
              ),
              if (_isUploadingPhoto)
                Container(
                  color: Colors.black45,
                  alignment: Alignment.center,
                  child: const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }
    return CircleAvatar(
      radius: 46,
      backgroundColor: AppTheme.primaryColor.withOpacity(0.6),
      child: _isUploadingPhoto
          ? const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2.5,
              ),
            )
          : const Icon(LucideIcons.user, size: 44, color: Colors.white),
    );
  }

  Future<void> _pickAndUploadPhoto() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: false,
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final Uint8List? bytes = file.bytes;
      if (bytes == null) {
        _showStatusSnackBar(
          'Could not read image file.',
          icon: LucideIcons.alertCircle,
          backgroundColor: AppTheme.error,
        );
        return;
      }

      setState(() => _isUploadingPhoto = true);

      final String url = await _cloudinaryService.uploadProfilePicture(
        bytes: bytes,
        fileName: file.name,
      );

      final uid = _authService.currentUser?.id;
      if (uid != null) {
        await _authService.updateStudentProfile(uid, {
          'profilePictureUrl': url,
          'profile_picture_url': url,
        });
        await _auditService.logActivity(
          action: 'Updated profile picture',
          userName: _nameController.text.trim(),
          role: 'Student',
          studentId:
              (_profileData?['studentId'] ?? _profileData?['student_no'])
                  ?.toString(),
        );
      }

      setState(() {
        _profilePictureUrl = url;
        _profileData?['profilePictureUrl'] = url;
        _profileData?['profile_picture_url'] = url;
      });

      _showStatusSnackBar('Profile picture updated!');
    } catch (e) {
      _showStatusSnackBar(
        'Upload failed: $e',
        icon: LucideIcons.alertCircle,
        backgroundColor: AppTheme.error,
      );
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  Future<void> _selectBirthdate(BuildContext context) async {
    final bool isDark = context.isDark;
    final DateTime initial = _birthdateController.text.trim().isNotEmpty
        ? _parseDate(_birthdateController.text.trim())
        : DateTime(2005, 1, 1);

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      builder: (ctx, child) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: isDark
                ? ColorScheme.dark(
                    primary: const Color(0xFFFBC02D),
                    onPrimary: const Color(0xFF0F3260),
                    surface: ctx.surfaceC,
                    onSurface: Colors.white,
                  )
                : const ColorScheme.light(
                    primary: AppTheme.primaryColor,
                    onPrimary: Colors.white,
                    onSurface: AppTheme.primaryColor,
                  ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _birthdateController.text =
            "${picked.month.toString().padLeft(2, '0')}/${picked.day.toString().padLeft(2, '0')}/${picked.year}";
        _editingSections.add('personal');
      });
    }
  }

  DateTime _parseDate(String dateStr) {
    final iso = _toIsoDateOrNull(dateStr);
    if (iso != null) {
      final parsed = DateTime.tryParse(iso);
      if (parsed != null &&
          parsed.year >= 1950 &&
          !parsed.isAfter(DateTime.now())) {
        return parsed;
      }
    }
    return DateTime(2005, 1, 1);
  }

  Future<void> _handleLogout() async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          backgroundColor: context.surfaceC,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.error.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.logOut,
                  color: AppTheme.error,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Log Out',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: context.textPri,
                ),
              ),
            ],
          ),
          content: Text(
            'Are you sure you want to log out of your ScholarDoc account?',
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              fontWeight: FontWeight.w500,
              color: context.textSec,
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'No',
                style: TextStyle(
                  color: context.textSec,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.error,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Yes, Log Out',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    await _authService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }
}
