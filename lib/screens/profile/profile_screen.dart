import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/cloudinary_service.dart';
import '../auth/welcome_screen.dart';
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

  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final CloudinaryService _cloudinaryService = CloudinaryService();

  Map<String, dynamic>? _profileData;
  bool _isProfileLoading = true;
  bool _isSaving = false;
  bool _isUploadingPhoto = false;
  String? _profilePictureUrl;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc != null) {
        final data = doc;
        setState(() {
          _profileData = data;
          _nameController.text = data['fullName'] ?? '';
          _emailController.text = data['email'] ?? '';
          _contactController.text = data['contactNumber'] ?? '';
          _sectionController.text = data['section'] ?? '';
          _saController.text = data['saNumber'] ?? '';
          _birthdateController.text = data['birthdate'] ?? '01/01/2000';
          _profilePictureUrl = data['profilePictureUrl'] as String?;
          _isProfileLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
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
      backgroundColor: const Color(0xFFF0F4FF),
      body: CustomScrollView(
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
            actions: [
              Container(
                margin: const EdgeInsets.only(right: 16),
                child: IconButton(
                  onPressed: _handleLogout,
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.logOut, color: Colors.white70, size: 18),
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  color: AppTheme.primaryColor,
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 40),
                      GestureDetector(
                        onTap: _isUploadingPhoto ? null : _pickAndUploadPhoto,
                        child: Stack(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: _isUploadingPhoto
                                      ? [Colors.white38, Colors.white24]
                                      : [const Color(0xFFFBC02D), const Color(0xFFF9A825)],
                                ),
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
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${_profileData?['course'] ?? 'Course'} • ${_profileData?['year'] ?? 'Year'}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.72),
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accentColor.withValues(alpha: 0.22),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: AppTheme.accentColor.withValues(alpha: 0.5)),
                          ),
                          child: Text(
                            _profileData?['scholarshipName'] ?? 'No Scholarship',
                            style: TextStyle(
                              color: AppTheme.accentColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Personal Info card
                    _buildCard(
                      title: 'Personal Information',
                      icon: LucideIcons.user,
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
                    // Academic card
                    _buildCard(
                      title: 'Academic & Program',
                      icon: LucideIcons.graduationCap,
                      children: [
                        _buildReadOnlyField('Scholarship Program',
                            _profileData?['scholarshipName'] ?? 'Not Assigned',
                            LucideIcons.star),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Student ID',
                            _profileData?['studentId'] ?? '...', LucideIcons.badgeCheck),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Email Address',
                            _profileData?['email'] ?? '...', LucideIcons.mail),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Year Became Scholar',
                            _profileData?['scholarYearLevel'] ?? 'N/A', LucideIcons.calendarCheck),
                        const SizedBox(height: 16),
                        _buildReadOnlyField('Payouts Received',
                            (_profileData?['payoutsReceived']?.toString() ?? '0'), LucideIcons.wallet),
                        const SizedBox(height: 16),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Banking card
                    _buildCard(
                      title: 'Banking Details',
                      icon: LucideIcons.landmark,
                      children: [
                        Text(
                          'Provide your Savings Account (SA) number for scholarship fund disbursement.',
                          style: TextStyle(
                              fontSize: 13, color: context.textSec, height: 1.5),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _saController,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'SA Number',
                            hintText: 'xxxx-xxxx-xxxx',
                            prefixIcon: const Icon(LucideIcons.creditCard,
                                color: AppTheme.primaryColor),
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: Colors.grey.shade200),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(
                                  color: AppTheme.primaryColor, width: 2),
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
                    // App Preferences card
                    _buildCard(
                      title: 'App Preferences',
                      icon: LucideIcons.settings,
                      children: [
                        ValueListenableBuilder<ThemeMode>(
                          valueListenable: ThemeProvider().themeNotifier,
                          builder: (context, theme, _) {
                            return Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryColor.withValues(alpha: 0.08),
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
                                              fontWeight: FontWeight.w600, fontSize: 14)),
                                      Text('Switch between Light and Dark mode',
                                          style: TextStyle(
                                              fontSize: 12, color: context.textSec)),
                                    ],
                                  ),
                                ),
                                Switch(
                                  value: theme == ThemeMode.dark,
                                  activeThumbColor: AppTheme.primaryColor,
                                  activeTrackColor:
                                      AppTheme.primaryColor.withValues(alpha: 0.2),
                                  onChanged: (_) => ThemeProvider().toggleTheme(),
                                ),
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    // Save button
                    Container(
                      width: double.infinity,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryColor.withValues(alpha: 0.35),
                            blurRadius: 16,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _isSaving ? null : _handleSave,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
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
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16),
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Activity log tile
                    _buildActivityLogTile(context),
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

  Widget _buildCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 16, color: AppTheme.primaryColor),
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: Colors.grey.shade100),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: children,
            ),
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
            style: const TextStyle(
                fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: Colors.grey.shade400),
              const SizedBox(width: 10),
              Expanded(
                child: Text(value,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
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
            style: const TextStyle(
                fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 16, color: AppTheme.primaryColor),
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppTheme.primaryColor, width: 2),
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
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.history, size: 20, color: AppTheme.primaryColor),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('View Account Activity',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  SizedBox(height: 2),
                  Text('Security & Privacy logs',
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.accentColor.withValues(alpha: 0.15),
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

  /// Builds the profile avatar — shows actual photo if URL exists, else icon.
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
      backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.5),
      child: _isUploadingPhoto
          ? const CircularProgressIndicator(color: Colors.white)
          : const Icon(LucideIcons.user, size: 52, color: Colors.white),
    );
  }

  /// Opens file picker and uploads selected image to Cloudinary.
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

      // Upload to Cloudinary
      final String url = await _cloudinaryService.uploadProfilePicture(
        bytes: bytes,
        fileName: file.name,
      );

      // Save URL to Firestore
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
          });
          await _auditService.logActivity(
            action: 'Updated Profile (SA number)',
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
    await _authService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
      (route) => false,
    );
  }

  Widget _buildBirthdateField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Birthdate (mm/dd/yyyy)',
            style: TextStyle(
                fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _birthdateController,
          readOnly: true,
          onTap: () => _selectBirthdate(context),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            prefixIcon: const Icon(LucideIcons.cake, size: 16, color: AppTheme.primaryColor),
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppTheme.primaryColor, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.error),
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
