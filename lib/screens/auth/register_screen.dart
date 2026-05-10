import 'package:flutter/material.dart';
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

  // Controllers
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _studentIdController = TextEditingController();
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
  List<Scholarship> _scholarships = [];
  final List<String> _genders = ['Male', 'Female'];

  @override
  void initState() {
    super.initState();
    _loadScholarships();
  }

  Future<void> _loadScholarships() async {
    _scholarshipService.getActiveScholarships().listen((list) {
      if (mounted) {
        setState(() {
          _scholarships = list;
        });
      }
    });
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

  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _studentIdController.dispose();
    _emailController.dispose();
    _contactController.dispose();
    _fatherNameController.dispose();
    _fatherAgeController.dispose();
    _fatherOccController.dispose();
    _motherNameController.dispose();
    _motherAgeController.dispose();
    _motherOccController.dispose();
    _incomeController.dispose();
    _religionController.dispose();
    _tribeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Create Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: 0),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Image.asset('assets/app_logo2.png', width: 85, height: 85),
                    const SizedBox(width: 0),
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [AppTheme.primaryColor, Color(0xFFFBC02D)],
                      ).createShader(bounds),
                      blendMode: BlendMode.srcIn,
                      child: Text(
                        'ScholarDoc',
                        style:
                            Theme.of(context).textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.w800,
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
                SizedBox(height: 0),
                Text(
                  'Register your student credentials to start managing your documents.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(color: context.textSec),
                ),
                SizedBox(height: 20),

                // Name Input
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person_outline),
                    hintText: 'e.g. Juan De La Cruz',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your full name';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 16),

                // Student ID Input
                TextFormField(
                  controller: _studentIdController,
                  decoration: const InputDecoration(
                    labelText: 'Student ID Number',
                    prefixIcon: Icon(Icons.badge_outlined),
                    hintText: 'e.g. 2023-12345',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your student ID';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 16),

                // Gender Dropdown
                DropdownButtonFormField<String>(
                  initialValue: _selectedGender,
                  decoration: const InputDecoration(
                    labelText: 'Gender',
                    prefixIcon: Icon(Icons.wc_outlined),
                    hintText: 'Select gender',
                  ),
                  items: _genders.map((String gender) {
                    return DropdownMenuItem(value: gender, child: Text(gender));
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedGender = val),
                  validator: (val) =>
                      val == null ? 'Please select your gender' : null,
                ),
                SizedBox(height: 16),

                // Email Input
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Gmail Address',
                    prefixIcon: Icon(Icons.email_outlined),
                    hintText: 'e.g. juan@gmail.com',
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your Gmail address';
                    }
                    if (!value.toLowerCase().endsWith('@gmail.com')) {
                      return 'Please use a valid Gmail address';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 16),

                // Scholarship Selection
                DropdownButtonFormField<Scholarship>(
                  initialValue: _selectedScholarship,
                  decoration: const InputDecoration(
                    labelText: 'Scholarship Program',
                    prefixIcon: Icon(Icons.stars_outlined),
                    hintText: 'Select your scholarship',
                  ),
                  items: _scholarships.map((Scholarship s) {
                    return DropdownMenuItem(value: s, child: Text(s.name));
                  }).toList(),
                  onChanged: (val) =>
                      setState(() => _selectedScholarship = val),
                  validator: (val) =>
                      val == null ? 'Please select a scholarship' : null,
                ),
                SizedBox(height: 16),

                // Contact Information
                TextFormField(
                  controller: _contactController,
                  decoration: const InputDecoration(
                    labelText: 'Contact Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                    hintText: 'e.g. 09123456789',
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your contact number';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 16),

                // Course Dropdown
                DropdownButtonFormField<String>(
                  initialValue: _selectedCourse,
                  decoration: const InputDecoration(
                    labelText: 'Course',
                    prefixIcon: Icon(Icons.school_outlined),
                  ),
                  items: _courses.map((String course) {
                    return DropdownMenuItem(value: course, child: Text(course));
                  }).toList(),
                  onChanged: (val) => setState(() {
                    _selectedCourse = val;
                    _selectedMajor = null; // Reset major when course changes
                  }),
                  validator: (val) =>
                      val == null ? 'Please select your course' : null,
                ),
                SizedBox(height: 16),

                // BTLED Major Dropdown (only visible when BTLED is selected)
                if (_selectedCourse == 'BTLED') ...[
                  DropdownButtonFormField<String>(
                    key: const ValueKey('btled_major'),
                    initialValue: _selectedMajor,
                    decoration: InputDecoration(
                      labelText: 'BTLED Major',
                      prefixIcon: Icon(Icons.menu_book_outlined),
                      hintText: 'Select your major',
                      fillColor: AppTheme.primaryColor.withValues(alpha: 0.04),
                      filled: true,
                    ),
                    items: _btledMajors.map((String major) {
                      return DropdownMenuItem(
                        value: major,
                        child: Text('Major in $major'),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedMajor = val),
                    validator: (val) =>
                        val == null ? 'Please select your BTLED major' : null,
                  ),
                  SizedBox(height: 16),
                ],

                // Year & Section Row
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedYear,
                        decoration: const InputDecoration(
                          labelText: 'Year Level',
                        ),
                        items: _years.map((String year) {
                          return DropdownMenuItem(
                            value: year,
                            child: Text(year),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            _selectedYear = val;
                            _selectedSection =
                                null; // Reset section when year changes
                          });
                        },
                        validator: (val) => val == null ? 'Select year' : null,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedSection,
                        key: ValueKey(
                          _selectedYear,
                        ), // Rebuild when year changes
                        decoration: const InputDecoration(labelText: 'Section'),
                        items: _getSectionsForYear(_selectedYear).map((
                          String section,
                        ) {
                          return DropdownMenuItem(
                            value: section,
                            child: Text(section),
                          );
                        }).toList(),
                        onChanged: (val) =>
                            setState(() => _selectedSection = val),
                        validator: (val) =>
                            val == null ? 'Select section' : null,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 16),

                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppTheme.primaryColor.withValues(alpha: 0.1),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 18,
                        color: AppTheme.primaryColor,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Your Student ID will serve as your default login password.',
                          style: TextStyle(
                            fontSize: 12,
                            color: context.textSec,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // Section Divider: Family Information
                Row(
                  children: [
                    Icon(
                      Icons.family_restroom,
                      color: AppTheme.primaryColor,
                      size: 20,
                    ),
                    SizedBox(width: 12),
                    Text(
                      'Family Information',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Divider(),
                SizedBox(height: 16),

                // Father's Information
                TextFormField(
                  controller: _fatherNameController,
                  decoration: const InputDecoration(
                    labelText: "Father's Full Name",
                    prefixIcon: Icon(Icons.person_outline),
                    hintText: 'e.g. Roberto De La Cruz',
                  ),
                  validator: (value) =>
                      value!.isEmpty ? "Enter father's name" : null,
                ),
                SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      flex: 1,
                      child: TextFormField(
                        controller: _fatherAgeController,
                        decoration: const InputDecoration(
                          labelText: 'Age',
                          hintText: 'e.g. 50',
                        ),
                        keyboardType: TextInputType.number,
                        validator: (value) =>
                            value!.isEmpty ? "Enter age" : null,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _fatherOccController,
                        decoration: const InputDecoration(
                          labelText: 'Occupation',
                          hintText: 'e.g. Farmer',
                        ),
                        validator: (value) =>
                            value!.isEmpty ? "Enter occupation" : null,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 24),

                // Mother's Information
                TextFormField(
                  controller: _motherNameController,
                  decoration: const InputDecoration(
                    labelText: "Mother's Full Name (Maiden Name)",
                    prefixIcon: Icon(Icons.person_outline),
                    hintText: 'e.g. Maria Clara',
                  ),
                  validator: (value) =>
                      value!.isEmpty ? "Enter mother's name" : null,
                ),
                SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      flex: 1,
                      child: TextFormField(
                        controller: _motherAgeController,
                        decoration: const InputDecoration(
                          labelText: 'Age',
                          hintText: 'e.g. 48',
                        ),
                        keyboardType: TextInputType.number,
                        validator: (value) =>
                            value!.isEmpty ? "Enter age" : null,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _motherOccController,
                        decoration: const InputDecoration(
                          labelText: 'Occupation',
                          hintText: 'e.g. Housewife',
                        ),
                        validator: (value) =>
                            value!.isEmpty ? "Enter occupation" : null,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 24),

                // Household Financial Detail
                TextFormField(
                  controller: _incomeController,
                  decoration: const InputDecoration(
                    labelText: 'Total Yearly Family Income',
                    prefixIcon: Icon(Icons.payments_outlined),
                    hintText: 'e.g. 150000',
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) =>
                      value!.isEmpty ? "Enter yearly income" : null,
                ),
                SizedBox(height: 16),

                // Cultural & Religious Background
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _religionController,
                        decoration: const InputDecoration(
                          labelText: 'Religion',
                          hintText: 'e.g. Catholic',
                        ),
                        validator: (value) =>
                            value!.isEmpty ? "Enter religion" : null,
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: TextFormField(
                        controller: _tribeController,
                        decoration: const InputDecoration(
                          labelText: 'Tribe',
                          hintText: 'e.g. Tagalog',
                        ),
                        validator: (value) =>
                            value!.isEmpty ? "Enter tribe" : null,
                      ),
                    ),
                  ],
                ),

                SizedBox(height: 48),

                // Register Button
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
                                  'motherName': _motherNameController.text
                                      .trim(),
                                  'motherAge': _motherAgeController.text.trim(),
                                  'motherOccupation': _motherOccController.text
                                      .trim(),
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
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    e
                                        .toString()
                                        .replaceAll(RegExp(r'\[.*\]'), '')
                                        .trim(),
                                  ),
                                  backgroundColor: AppTheme.error,
                                ),
                              );
                            } finally {
                              if (mounted) setState(() => _isLoading = false);
                            }
                          }
                        },
                  child: _isLoading
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text('Create Account'),
                ),
                SizedBox(height: 24),

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
                        textStyle: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      child: Text('Sign In Here'),
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
}
