import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/scholarship_service.dart';
import 'login_screen.dart';
import '../main_layout.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final AuthService _authService = AuthService();
  final ScholarshipService _scholarshipService = ScholarshipService();
  StreamSubscription<List<Scholarship>>? _scholarshipSubscription;

  // Controllers
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _studentIdController = TextEditingController();
  final TextEditingController _birthdateController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _contactController = TextEditingController();

  final TextEditingController _fatherNameController = TextEditingController();
  final TextEditingController _fatherAgeController = TextEditingController();
  final TextEditingController _fatherOccController = TextEditingController();

  final TextEditingController _motherNameController = TextEditingController();
  final TextEditingController _motherAgeController = TextEditingController();
  final TextEditingController _motherOccController = TextEditingController();

  final TextEditingController _incomeController = TextEditingController();
  final TextEditingController _religionController = TextEditingController();
  final TextEditingController _tribeController = TextEditingController();

  // Academic & Scholarship Dropdown Values
  String? _selectedCourse;
  String? _selectedYear;
  String? _selectedSection;
  String? _selectedGender;
  Scholarship? _selectedScholarship;
  String? _selectedScholarYearLevel;
  final TextEditingController _payoutsController = TextEditingController(
    text: '0',
  );
  List<Scholarship> _scholarships = [];
  String? _selectedFatherEdu;
  String? _selectedMotherEdu;
  final List<String> _eduStatusOptions = ['Graduate', 'Non-graduate'];
  final List<String> _genders = ['Male', 'Female'];

  @override
  void initState() {
    super.initState();
    _loadScholarships();
  }

  Future<void> _loadScholarships() async {
    try {
      _scholarshipSubscription = _scholarshipService
          .getActiveScholarships()
          .listen(
            (list) {
              if (mounted) {
                setState(() {
                  _scholarships = list;
                });
              }
            },
            onError: (error) {
              debugPrint('RegisterScreen: Error loading scholarships: $error');
            },
          );
    } catch (e) {
      debugPrint('RegisterScreen: Failed to initialize scholarship stream: $e');
    }
  }

  final List<String> _courses = ['BSIT', 'BTLED', 'BFPT'];
  final List<String> _btledMajors = ['TLE', 'ICT', 'HE'];
  final List<String> _years = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
    '5th Year',
  ];
  String? _selectedMajor;
  List<String> _getSectionsForYear(String? year) {
    if (year == null) return [];
    final yearPrefix = year.substring(0, 1); // Get '1' from '1st Year'
    return ['A', 'B', 'C', 'D', 'E', 'F'].map((s) => '$yearPrefix$s').toList();
  }

  Future<void> _selectBirthdate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime(2005),
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
        _birthdateController.text = DateFormat('MM/dd/yyyy').format(picked);
      });
    }
  }

  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _studentIdController.dispose();
    _birthdateController.dispose();
    _emailController.dispose();
    _contactController.dispose();
    _payoutsController.dispose();
    _fatherNameController.dispose();
    _fatherAgeController.dispose();
    _fatherOccController.dispose();
    _motherNameController.dispose();
    _motherAgeController.dispose();
    _motherOccController.dispose();
    _incomeController.dispose();
    _religionController.dispose();
    _tribeController.dispose();
    _scholarshipSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Create Account'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header section
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Image.asset('assets/app_logo2.png', width: 60, height: 60),
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [AppTheme.primaryColor, Color(0xFFFBC02D)],
                      ).createShader(bounds),
                      blendMode: BlendMode.srcIn,
                      child: Text(
                        'ScholarDoc',
                        style:
                            Theme.of(context).textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ) ??
                            const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Register your student credentials to start managing your documents.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(color: context.textSec),
                ),
                const SizedBox(height: 32),

                // --- 1. Personal Information Section ---
                _buildSectionCard(
                  title: 'Personal Information',
                  icon: Icons.person_outline,
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Full Name',
                        prefixIcon: Icon(Icons.person_outline),
                        hintText: 'e.g. Juan De La Cruz',
                      ),
                      validator: (value) => (value == null || value.isEmpty)
                          ? 'Enter your full name'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _studentIdController,
                            decoration: const InputDecoration(
                              labelText: 'Student ID',
                              prefixIcon: Icon(Icons.badge_outlined),
                            ),
                            validator: (value) =>
                                (value == null || value.isEmpty)
                                ? 'Enter student ID'
                                : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedGender,
                            decoration: const InputDecoration(
                              labelText: 'Gender',
                            ),
                            items: _genders
                                .map(
                                  (g) => DropdownMenuItem(
                                    value: g,
                                    child: Text(g),
                                  ),
                                )
                                .toList(),
                            onChanged: (val) =>
                                setState(() => _selectedGender = val),
                            validator: (val) => val == null ? 'Select' : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _birthdateController,
                      readOnly: true,
                      onTap: () => _selectBirthdate(context),
                      decoration: const InputDecoration(
                        labelText: 'Birthdate (mm/dd/yyyy)',
                        prefixIcon: Icon(Icons.cake_outlined),
                        hintText: 'Select your birthdate',
                      ),
                      validator: (value) => (value == null || value.isEmpty)
                          ? 'Select your birthdate'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Gmail Address',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) {
                        if (value == null || value.isEmpty)
                          return 'Enter Gmail';
                        if (!value.toLowerCase().endsWith('@gmail.com')) {
                          return 'Must be a valid Gmail';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _contactController,
                      decoration: const InputDecoration(
                        labelText: 'Contact Number',
                        prefixIcon: Icon(Icons.phone_outlined),
                        hintText: 'e.g. 09123456789',
                      ),
                      keyboardType: TextInputType.phone,
                      validator: (value) => (value == null || value.isEmpty)
                          ? 'Enter contact number'
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // --- 2. Academic & Scholarship Section ---
                _buildSectionCard(
                  title: 'Academic Details',
                  icon: Icons.school_outlined,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _selectedCourse,
                      decoration: const InputDecoration(
                        labelText: 'Course',
                        prefixIcon: Icon(Icons.school_outlined),
                      ),
                      items: _courses
                          .map(
                            (c) => DropdownMenuItem(value: c, child: Text(c)),
                          )
                          .toList(),
                      onChanged: (val) => setState(() {
                        _selectedCourse = val;
                        _selectedMajor = null;
                      }),
                      validator: (val) => val == null ? 'Select course' : null,
                    ),
                    if (_selectedCourse == 'BTLED') ...[
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        key: const ValueKey('btled_major'),
                        initialValue: _selectedMajor,
                        decoration: const InputDecoration(
                          labelText: 'BTLED Major',
                          prefixIcon: Icon(Icons.menu_book_outlined),
                        ),
                        items: _btledMajors
                            .map(
                              (m) => DropdownMenuItem(value: m, child: Text(m)),
                            )
                            .toList(),
                        onChanged: (val) =>
                            setState(() => _selectedMajor = val),
                        validator: (val) => val == null ? 'Select major' : null,
                      ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedYear,
                            decoration: const InputDecoration(
                              labelText: 'Year',
                            ),
                            items: _years
                                .map(
                                  (y) => DropdownMenuItem(
                                    value: y,
                                    child: Text(y),
                                  ),
                                )
                                .toList(),
                            onChanged: (val) => setState(() {
                              _selectedYear = val;
                              _selectedSection = null;
                            }),
                            validator: (val) => val == null ? 'Select' : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedSection,
                            key: ValueKey(_selectedYear),
                            decoration: const InputDecoration(
                              labelText: 'Section',
                            ),
                            items: _getSectionsForYear(_selectedYear)
                                .map(
                                  (s) => DropdownMenuItem(
                                    value: s,
                                    child: Text(s),
                                  ),
                                )
                                .toList(),
                            onChanged: (val) =>
                                setState(() => _selectedSection = val),
                            validator: (val) => val == null ? 'Select' : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<Scholarship>(
                      initialValue: _selectedScholarship,
                      decoration: const InputDecoration(
                        labelText: 'Scholarship Program',
                        prefixIcon: Icon(Icons.stars_outlined),
                      ),
                      items: _scholarships
                          .map(
                            (s) =>
                                DropdownMenuItem(value: s, child: Text(s.name)),
                          )
                          .toList(),
                      onChanged: (val) =>
                          setState(() => _selectedScholarship = val),
                      validator: (val) =>
                          val == null ? 'Select scholarship' : null,
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedScholarYearLevel,
                      decoration: const InputDecoration(
                        labelText: 'Year level when you became a scholar',
                        prefixIcon: Icon(Icons.event_available_outlined),
                        hintText: 'Select year',
                      ),
                      items: _years
                          .map(
                            (y) => DropdownMenuItem(value: y, child: Text(y)),
                          )
                          .toList(),
                      onChanged: (val) => setState(() {
                        _selectedScholarYearLevel = val;
                        if (val != null) {
                          int payouts = 0;
                          if (val.contains('2nd')) {
                            payouts = 1;
                          } else if (val.contains('3rd'))
                            payouts = 2;
                          else if (val.contains('4th') || val.contains('5th'))
                            payouts = 3;
                          _payoutsController.text = payouts.toString();
                        }
                      }),
                      validator: (val) =>
                          val == null ? 'Please select a year' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _payoutsController,
                      decoration: const InputDecoration(
                        labelText: 'Total payouts received to date',
                        prefixIcon: Icon(Icons.payments_outlined),
                        hintText: 'e.g. 0',
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.isEmpty)
                          return 'Please enter a number';
                        final n = int.tryParse(value);
                        if (n == null || n < 0) return 'Enter a valid number';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppTheme.primaryColor.withOpacity(0.1),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.info_outline,
                            size: 16,
                            color: AppTheme.primaryColor,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Student ID is your default password.',
                              style: TextStyle(
                                fontSize: 11,
                                color: context.textSec,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // --- 3. Family Information Section ---
                _buildSectionCard(
                  title: 'Family Background',
                  icon: Icons.family_restroom_outlined,
                  children: [
                    TextFormField(
                      controller: _fatherNameController,
                      decoration: const InputDecoration(
                        labelText: "Father's Full Name",
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (value) => value!.isEmpty ? "Required" : null,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _fatherAgeController,
                            decoration: const InputDecoration(labelText: 'Age'),
                            keyboardType: TextInputType.number,
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _fatherOccController,
                            decoration: const InputDecoration(
                              labelText: 'Occupation',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedFatherEdu,
                      decoration: const InputDecoration(
                        labelText: "Father's Educational Status",
                        prefixIcon: Icon(Icons.school_outlined),
                      ),
                      items: _eduStatusOptions
                          .map(
                            (s) => DropdownMenuItem(value: s, child: Text(s)),
                          )
                          .toList(),
                      onChanged: (val) =>
                          setState(() => _selectedFatherEdu = val),
                      validator: (val) =>
                          val == null ? 'Please select status' : null,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _motherNameController,
                      decoration: const InputDecoration(
                        labelText: "Mother's Full Name",
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (value) => value!.isEmpty ? "Required" : null,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _motherAgeController,
                            decoration: const InputDecoration(labelText: 'Age'),
                            keyboardType: TextInputType.number,
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _motherOccController,
                            decoration: const InputDecoration(
                              labelText: 'Occupation',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedMotherEdu,
                      decoration: const InputDecoration(
                        labelText: "Mother's Educational Status",
                        prefixIcon: Icon(Icons.school_outlined),
                      ),
                      items: _eduStatusOptions
                          .map(
                            (s) => DropdownMenuItem(value: s, child: Text(s)),
                          )
                          .toList(),
                      onChanged: (val) =>
                          setState(() => _selectedMotherEdu = val),
                      validator: (val) =>
                          val == null ? 'Please select status' : null,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _incomeController,
                      decoration: const InputDecoration(
                        labelText: 'Yearly Family Income',
                        prefixIcon: Icon(Icons.account_balance_wallet_outlined),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) => value!.isEmpty ? "Required" : null,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _religionController,
                            decoration: const InputDecoration(
                              labelText: 'Religion',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _tribeController,
                            decoration: const InputDecoration(
                              labelText: 'Tribe',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? "Required" : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 48),

                // Submit Button
                ElevatedButton(
                  onPressed: _isLoading
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            setState(() => _isLoading = true);
                            try {
                              Map<String, dynamic> studentData = {
                                'fullName': _nameController.text.trim(),
                                'studentId': _studentIdController.text.trim(),
                                'birthdate': _birthdateController.text.trim(),
                                'email': _emailController.text.trim(),
                                'course': _selectedCourse,
                                'gender': _selectedGender,
                                'major': _selectedCourse == 'BTLED'
                                    ? _selectedMajor
                                    : null,
                                'courseDisplay': _selectedCourse == 'BTLED'
                                    ? 'BTLED (major in $_selectedMajor)'
                                    : _selectedCourse,
                                'year': _selectedYear,
                                'section': _selectedSection,
                                'scholarshipId': _selectedScholarship?.id,
                                'scholarshipName': _selectedScholarship?.name,
                                'scholarYearLevel': _selectedScholarYearLevel,
                                'payoutsReceived':
                                    int.tryParse(
                                      _payoutsController.text.trim(),
                                    ) ??
                                    0,
                                'contactNumber': _contactController.text.trim(),
                                'role': 'student',
                                'status': 'Pending',
                                'documents': {},
                                'familyDetails': {
                                  'fatherName': _fatherNameController.text
                                      .trim(),
                                  'fatherAge': _fatherAgeController.text.trim(),
                                  'fatherOccupation': _fatherOccController.text
                                      .trim(),
                                  'fatherEduStatus': _selectedFatherEdu,
                                  'motherName': _motherNameController.text
                                      .trim(),
                                  'motherAge': _motherAgeController.text.trim(),
                                  'motherOccupation': _motherOccController.text
                                      .trim(),
                                  'motherEduStatus': _selectedMotherEdu,
                                  'yearlyIncome': _incomeController.text.trim(),
                                  'religion': _religionController.text.trim(),
                                  'tribe': _tribeController.text.trim(),
                                },
                              };

                              await _authService.registerStudent(
                                gmail: _emailController.text.trim(),
                                studentId: _studentIdController.text.trim(),
                                studentData: studentData,
                              );

                              if (!context.mounted) return;
                              Navigator.pushAndRemoveUntil(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const MainLayout(),
                                ),
                                (route) => false,
                              );
                            } catch (e) {
                              if (!context.mounted) return;
                              final errorMsg = e.toString();
                              
                              if (errorMsg.contains('MASTERLIST_DENIED')) {
                                // Show professional masterlist denial dialog
                                _showMasterlistDeniedDialog(context);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      errorMsg
                                          .replaceAll(RegExp(r'\[.*\]'), '')
                                          .replaceAll('Exception: Registration failed: Exception: ', '')
                                          .trim(),
                                    ),
                                    backgroundColor: AppTheme.error,
                                  ),
                                );
                              }
                            } finally {
                              if (mounted) setState(() => _isLoading = false);
                            }
                          }
                        },
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Create Account'),
                ),
                const SizedBox(height: 24),

                // Login Prompt
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Already have an account?",
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const LoginScreen(),
                          ),
                        );
                      },
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.primaryColor,
                        textStyle: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      child: const Text('Sign In Here'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({
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
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Row(
              children: [
                Icon(icon, color: AppTheme.primaryColor, size: 22),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ],
      ),
    );
  }

  void _showMasterlistDeniedDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Container(
          padding: const EdgeInsets.all(28),
          constraints: const BoxConstraints(maxWidth: 400),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Warning Icon with animated container
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.orange.withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: Color(0xFFFF9800),
                  size: 44,
                ),
              ),
              const SizedBox(height: 24),

              // Title
              const Text(
                'Registration Denied',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E293B),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 12),

              // Subtitle
              Text(
                'Your name was not found in the official scholar/grantee masterlist.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),

              // Info Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.info_outline, size: 18, color: AppTheme.primaryColor),
                        const SizedBox(width: 8),
                        const Text(
                          'What should I do?',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildStep('1', 'Double-check that you entered your full name correctly as it appears in official records.'),
                    const SizedBox(height: 8),
                    _buildStep('2', 'Contact the Scholarship Office to verify your enrollment status.'),
                    const SizedBox(height: 8),
                    _buildStep('3', 'Ask your admin to ensure your name has been imported into the system.'),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Action Buttons
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Try Again',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                child: Text(
                  'Go Back to Login',
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Center(
            child: Text(
              number,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[600],
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
