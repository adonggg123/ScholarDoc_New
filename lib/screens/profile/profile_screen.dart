import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/cloudinary_service.dart';
import '../../services/scholarship_service.dart';
import '../auth/login_screen.dart';
import 'student_activity_log_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _saController = TextEditingController();
  final _nameController = TextEditingController();
  final _contactController = TextEditingController();
  final _sectionController = TextEditingController();
  final _emailController = TextEditingController();
  final _birthdateController = TextEditingController();
  final _yearBecameScholarController = TextEditingController();
  final _payoutsReceivedController = TextEditingController(text: '0');

  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final CloudinaryService _cloudinaryService = CloudinaryService();
  final ScholarshipService _scholarshipService = ScholarshipService();
  StreamSubscription<List<Scholarship>>? _scholarshipSub;

  String? _selectedScholarship;
  final List<String> _scholarshipOptions = ['TES', 'TDP', 'DBP', 'SANTEH', 'STUFAP', 'CHED TES'];

  Map<String, dynamic>? _profileData;
  bool _isProfileLoading = true;
  bool _isSaving = false;
  bool _isUploadingPhoto = false;
  String? _profilePictureUrl;
  final Set<String> _expandedSections = {'academic'};

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _scholarshipSub = _scholarshipService.getActiveScholarships().listen((list) {
      if (mounted && list.isNotEmpty) {
        setState(() {
          for (final s in list) {
            if (s.name.isNotEmpty && !_scholarshipOptions.contains(s.name)) {
              _scholarshipOptions.add(s.name);
            }
          }
        });
      }
    });
  }

  Future<void> _loadProfile() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc != null) {
        final data = doc;
        final schName = data['scholarshipName'] ?? data['scholarship_name'] ?? 'TES';
        if (!_scholarshipOptions.contains(schName)) {
          _scholarshipOptions.add(schName);
        }
        setState(() {
          _profileData = data;
          _selectedScholarship = schName;
          _nameController.text = data['fullName'] ?? '';
          _emailController.text = data['email'] ?? '';
          _contactController.text = data['contactNumber'] ?? '';
          _sectionController.text = data['section'] ?? '';
          _saController.text = data['saNumber'] ?? '';
          _birthdateController.text = data['birthdate'] ?? '01/01/2000';
          _yearBecameScholarController.text = (data['yearBecameScholar'] ?? data['year_became_scholar'] ?? data['scholarYearLevel'] ?? '').toString();
          _payoutsReceivedController.text = (data['payoutsReceived'] ?? data['payouts_received'] ?? '0').toString();
          _profilePictureUrl = data['profilePictureUrl'] as String?;
          _isProfileLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _scholarshipSub?.cancel();
    _yearBecameScholarController.dispose();
    _payoutsReceivedController.dispose();
    _saController.dispose();
    _nameController.dispose();
    _contactController.dispose();
    _sectionController.dispose();
    _emailController.dispose();
    _birthdateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgC,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // --- Profile Header ---
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: AppTheme.primaryColor,
            automaticallyImplyLeading: false,
            elevation: 0,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF0F3260), Color(0xFF1E3A8A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
                  border: Border(
                    bottom: BorderSide(
                      color: Color(0xFFFBC02D), // Golden Yellow line
                      width: 3.0,
                    ),
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 30),
                      GestureDetector(
                        onTap: _isUploadingPhoto ? null : _pickAndUploadPhoto,
                        child: Stack(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFFFBC02D), // Golden Yellow
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFFBC02D).withOpacity(0.3),
                                    blurRadius: 16,
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
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFBC02D),
                                  shape: BoxShape.circle,
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
                                    : const Icon(LucideIcons.camera, size: 14,
                                        color: AppTheme.primaryColor),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (_isProfileLoading)
                        const CircularProgressIndicator(color: Colors.white)
                      else ...[
                        Text(
                          _profileData?['fullName'] ?? 'Student Name',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${_profileData?['course'] ?? 'Course'} • ${_profileData?['year'] ?? 'Year'}',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.72),
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppTheme.accentColor.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: AppTheme.accentColor.withOpacity(0.4)),
                          ),
                          child: Text(
                            _selectedScholarship ?? _profileData?['scholarshipName'] ?? 'No Scholarship',
                            style: TextStyle(
                              color: AppTheme.accentColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),

          // --- Body ---
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    // Personal Info section
                    _buildCollapsibleSection(
                      sectionKey: 'personal',
                      title: 'Personal Information',
                      icon: LucideIcons.user,
                      subtitle: _profileData?['fullName'] ?? 'View & edit your details',
                      children: [
                        _buildEditableField('Full Name', _nameController, LucideIcons.user),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Gender', _profileData?['gender'] ?? 'Not Specified', LucideIcons.user),
                        const SizedBox(height: 16),
                        _buildBirthdateField(context),
                        const SizedBox(height: 16),
                        _buildEditableField('Contact Number', _contactController, LucideIcons.phone),
                        const SizedBox(height: 16),
                        _buildEditableField('Section', _sectionController, LucideIcons.layers),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Academic section
                    _buildCollapsibleSection(
                      sectionKey: 'academic',
                      title: 'Academic & Program',
                      icon: LucideIcons.graduationCap,
                      subtitle: _selectedScholarship ?? _profileData?['scholarshipName'] ?? 'Scholarship details',
                      children: [
                        _buildScholarshipDropdownField(),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Degree Program / Course',
                            _profileData?['course'] ?? _profileData?['program_name'] ?? 'Not Specified',
                            LucideIcons.graduationCap),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Student ID',
                            _profileData?['studentId'] ?? '...', LucideIcons.badgeCheck),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Email Address',
                            _profileData?['email'] ?? '...', LucideIcons.mail),
                        const SizedBox(height: 16),
                        _buildYearBecameScholarField(),
                        const SizedBox(height: 16),
                        _buildPayoutsReceivedField(),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Banking section
                    _buildCollapsibleSection(
                      sectionKey: 'banking',
                      title: 'Banking Details',
                      icon: LucideIcons.landmark,
                      subtitle: 'SA number for disbursement',
                      children: [
                        Text(
                          'Provide your Savings Account (SA) number for scholarship fund disbursement.',
                          style: TextStyle(
                              fontSize: 13, color: context.textSec, height: 1.5, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _saController,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'SA Number',
                            hintText: 'xxxx-xxxx-xxxx',
                            prefixIcon: const Icon(LucideIcons.creditCard,
                                color: AppTheme.primaryColor, size: 18),
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
                              borderSide: const BorderSide(
                                  color: Color(0xFFFBC02D), width: 2), // Golden Yellow
                            ),
                            errorBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: AppTheme.error),
                            ),
                            focusedErrorBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: AppTheme.error, width: 2),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 16),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Please enter your SA Number';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // App Preferences section
                    _buildCollapsibleSection(
                      sectionKey: 'preferences',
                      title: 'App Preferences',
                      icon: LucideIcons.settings,
                      subtitle: 'Theme & display settings',
                      children: [
                        ValueListenableBuilder<ThemeMode>(
                          valueListenable: ThemeProvider().themeNotifier,
                          builder: (context, theme, _) {
                            return Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryColor.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(LucideIcons.moon,
                                      size: 18, color: AppTheme.primaryColor),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Dark Mode',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w700, fontSize: 14)),
                                      Text('Switch between Light and Dark mode',
                                          style: TextStyle(
                                              fontSize: 12, color: context.textSec, fontWeight: FontWeight.w500)),
                                    ],
                                  ),
                                ),
                                Switch(
                                  value: theme == ThemeMode.dark,
                                  activeThumbColor: AppTheme.primaryColor,
                                  activeTrackColor:
                                      AppTheme.primaryColor.withOpacity(0.2),
                                  onChanged: (_) => ThemeProvider().toggleTheme(),
                                ),
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    // Save button
                    Container(
                      width: double.infinity,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFBC02D).withOpacity(0.25), // Golden Yellow Glow Shadow
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _isSaving ? null : _handleSave,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: _isSaving
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white))
                            : const Text(
                                'Save Profile Changes',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16),
                              ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Activity log tile
                    _buildActivityLogTile(context),
                    const SizedBox(height: 16),
                    // Log out tile
                    _buildLogoutTile(context),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCollapsibleSection({
    required String sectionKey,
    required String title,
    required IconData icon,
    required String subtitle,
    required List<Widget> children,
  }) {
    final bool isExpanded = _expandedSections.contains(sectionKey);
    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isExpanded
              ? AppTheme.primaryColor.withOpacity(0.2)
              : context.crispBorder,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isExpanded
                ? AppTheme.primaryColor.withOpacity(0.04)
                : Colors.black.withOpacity(0.015),
            blurRadius: isExpanded ? 16 : 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Tappable header
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
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isExpanded
                            ? AppTheme.primaryColor.withOpacity(0.12)
                            : AppTheme.primaryColor.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, size: 18, color: AppTheme.primaryColor),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F3260),
                            ),
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
                    const SizedBox(width: 8),
                    AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 250),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isExpanded
                              ? AppTheme.primaryColor.withOpacity(0.1)
                              : context.bgC,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          LucideIcons.chevronDown,
                          size: 16,
                          color: isExpanded
                              ? AppTheme.primaryColor
                              : Colors.grey.shade400,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Expandable content
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
            duration: const Duration(milliseconds: 250),
            sizeCurve: Curves.easeInOut,
          ),
        ],
      ),
    );
  }

  Widget _buildReadOnlyField(String label, String value, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 11, color: context.textSec, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: context.bgC,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.crispBorder, width: 1),
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: context.textSec.withOpacity(0.6)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(value,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: context.textPri)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEditableField(
      String label, TextEditingController controller, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 11, color: context.textSec, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 16, color: AppTheme.primaryColor),
            filled: true,
            fillColor: context.surfaceC,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
              borderSide:
                  const BorderSide(color: Color(0xFFFBC02D), width: 2), // Golden Yellow
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.error),
            ),
          ),
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Field cannot be empty' : null,
        ),
      ],
    );
  }

  Widget _buildScholarshipDropdownField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Scholarship Program',
              style: TextStyle(
                fontSize: 11,
                color: context.textSec,
                fontWeight: FontWeight.bold,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFFBC02D).withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFFBC02D).withOpacity(0.4)),
              ),
              child: const Text(
                'Assigned Program',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F3260),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _selectedScholarship,
          decoration: InputDecoration(
            prefixIcon: const Icon(LucideIcons.award, size: 18, color: AppTheme.primaryColor),
            filled: true,
            fillColor: context.bgC,
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
          ),
          items: _scholarshipOptions.map((name) {
            return DropdownMenuItem<String>(
              value: name,
              child: Row(
                children: [
                  const Icon(LucideIcons.sparkles, size: 14, color: Color(0xFFFBC02D)),
                  const SizedBox(width: 8),
                  Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                ],
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedScholarship = val;
              });
            }
          },
          validator: (val) => val == null || val.isEmpty ? 'Please select a scholarship' : null,
        ),
      ],
    );
  }

  Widget _buildYearBecameScholarField() {
    final quickYears = ['2022', '2023', '2024', '2025', '2026', '1st Year', '2nd Year', '3rd Year'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Year Became a Scholar',
          style: TextStyle(
            fontSize: 11,
            color: context.textSec,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: _yearBecameScholarController,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: const Icon(LucideIcons.calendarCheck, size: 16, color: AppTheme.primaryColor),
            hintText: 'e.g. 2023, 2024, or 1st Year',
            filled: true,
            fillColor: context.bgC,
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
              borderSide: BorderSide(color: AppTheme.error),
            ),
          ),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter the year you became a scholar' : null,
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
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.white : context.textPri,
                    ),
                  ),
                  backgroundColor: isSelected ? AppTheme.primaryColor : context.surfaceC,
                  side: BorderSide(color: isSelected ? AppTheme.primaryColor : context.crispBorder),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () {
                    setState(() {
                      _yearBecameScholarController.text = yr;
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
        Text(
          'Payouts Received to Date',
          style: TextStyle(
            fontSize: 11,
            color: context.textSec,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: _payoutsReceivedController,
          keyboardType: TextInputType.number,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          decoration: InputDecoration(
            prefixIcon: const Icon(LucideIcons.wallet, size: 16, color: AppTheme.primaryColor),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: 'Decrease payouts',
                  icon: const Icon(LucideIcons.minusCircle, size: 18, color: AppTheme.primaryColor),
                  onPressed: () {
                    int val = int.tryParse(_payoutsReceivedController.text.trim()) ?? 0;
                    if (val > 0) val--;
                    setState(() {
                      _payoutsReceivedController.text = val.toString();
                    });
                  },
                ),
                IconButton(
                  tooltip: 'Increase payouts',
                  icon: const Icon(LucideIcons.plusCircle, size: 18, color: AppTheme.primaryColor),
                  onPressed: () {
                    int val = int.tryParse(_payoutsReceivedController.text.trim()) ?? 0;
                    val++;
                    setState(() {
                      _payoutsReceivedController.text = val.toString();
                    });
                  },
                ),
              ],
            ),
            hintText: 'e.g. 0',
            filled: true,
            fillColor: context.bgC,
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
              borderSide: BorderSide(color: AppTheme.error),
            ),
          ),
          validator: (v) {
            if (v == null || v.trim().isEmpty) return 'Enter number of payouts';
            final n = int.tryParse(v.trim());
            if (n == null || n < 0) return 'Must be a non-negative number';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildActivityLogTile(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const StudentActivityLogScreen()),
      ),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: context.surfaceC,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: context.crispBorder, width: 1.5),
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.history, size: 20, color: AppTheme.primaryColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('View Account Activity',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('Security & Privacy logs',
                      style: TextStyle(fontSize: 12, color: context.textSec, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.accentColor.withOpacity(0.15), // Golden Yellow Accent
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(LucideIcons.chevronRight,
                  size: 16, color: Color(0xFF0F3260)),
            ),
          ],
        ),
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
          border: Border.all(color: AppTheme.error.withOpacity(0.3), width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.logOut, size: 20, color: AppTheme.error),
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

  Widget _buildAvatarWidget() {
    final String? url = _profilePictureUrl;
    if (url != null && url.isNotEmpty) {
      return CircleAvatar(
        radius: 52,
        backgroundColor: const Color(0xFF1A4F9E),
        backgroundImage: NetworkImage(url),
        child: _isUploadingPhoto
            ? Container(
                decoration: const BoxDecoration(
                  color: Colors.black38,
                  shape: BoxShape.circle,
                ),
                child: const CircularProgressIndicator(color: Colors.white),
              )
            : null,
      );
    }
    return CircleAvatar(
      radius: 52,
      backgroundColor: AppTheme.primaryColor.withOpacity(0.5),
      child: _isUploadingPhoto
          ? const CircularProgressIndicator(color: Colors.white)
          : const Icon(LucideIcons.user, size: 52, color: Colors.white),
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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not read image file.')),
          );
        }
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
        });
        await _auditService.logActivity(
          action: 'Updated profile picture',
          userName: _nameController.text.trim(),
          role: 'Student',
          studentId: _profileData?['studentId'],
        );
      }

      setState(() {
        _profilePictureUrl = url;
        _profileData?['profilePictureUrl'] = url;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white, size: 18),
                SizedBox(width: 10),
                Text('Profile picture updated!'),
              ],
            ),
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  Future<void> _handleSave() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isSaving = true);
      final uid = _authService.currentUser?.id;
      if (uid != null) {
        try {
          await _authService.updateStudentProfile(uid, {
            'fullName': _nameController.text.trim(),
            'contactNumber': _contactController.text.trim(),
            'section': _sectionController.text.trim(),
            'saNumber': _saController.text.trim(),
            'birthdate': _birthdateController.text.trim(),
            'scholarshipName': _selectedScholarship ?? 'TES',
            'scholarship_name': _selectedScholarship ?? 'TES',
            'scholarYearLevel': _yearBecameScholarController.text.trim(),
            'year_became_scholar': _yearBecameScholarController.text.trim(),
            'yearBecameScholar': _yearBecameScholarController.text.trim(),
            'payoutsReceived': int.tryParse(_payoutsReceivedController.text.trim()) ?? 0,
            'payouts_received': _payoutsReceivedController.text.trim(),
          });
          await _auditService.logActivity(
            action: 'Updated Profile (Academic & Program, SA number)',
            userName: _nameController.text.trim(),
            role: 'Student',
            studentId: _profileData?['studentId'],
          );
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Profile updated successfully'),
              backgroundColor: AppTheme.success,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
          _loadProfile();
        } catch (e) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppTheme.error,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        } finally {
          if (mounted) setState(() => _isSaving = false);
        }
      }
    }
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
                child: const Icon(LucideIcons.logOut, color: AppTheme.error, size: 22),
              ),
              const SizedBox(width: 12),
              const Text(
                'Log Out',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          content: const Text(
            'Are you sure you want to log out of your ScholarDoc account?',
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Yes, Log Out',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
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

  Widget _buildBirthdateField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Birthdate (mm/dd/yyyy)',
            style: TextStyle(
                fontSize: 11, color: context.textSec, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _birthdateController,
          readOnly: true,
          onTap: () => _selectBirthdate(context),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: const Icon(LucideIcons.cake, size: 16, color: AppTheme.primaryColor),
            filled: true,
            fillColor: context.surfaceC,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
              borderSide:
                  const BorderSide(color: Color(0xFFFBC02D), width: 2), // Golden Yellow
            ),
          ),
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Birthdate cannot be empty' : null,
        ),
      ],
    );
  }

  Future<void> _selectBirthdate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _birthdateController.text.isNotEmpty
          ? _parseDate(_birthdateController.text)
          : DateTime(2005),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
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
        _birthdateController.text = "${picked.month.toString().padLeft(2, '0')}/${picked.day.toString().padLeft(2, '0')}/${picked.year}";
      });
    }
  }

  DateTime _parseDate(String dateStr) {
    try {
      final parts = dateStr.split('/');
      if (parts.length == 3) {
        final month = int.parse(parts[0]);
        final day = int.parse(parts[1]);
        final year = int.parse(parts[2]);
        return DateTime(year, month, day);
      }
    } catch (_) {}
    return DateTime(2005);
  }
}
