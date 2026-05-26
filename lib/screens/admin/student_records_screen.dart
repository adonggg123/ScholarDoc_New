import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/notification_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class StudentRecordsScreen extends StatefulWidget {
  const StudentRecordsScreen({super.key});

  @override
  State<StudentRecordsScreen> createState() => _StudentRecordsScreenState();
}

class _StudentRecordsScreenState extends State<StudentRecordsScreen> {
  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final NotificationService _notificationService = NotificationService();
  final TextEditingController _searchController = TextEditingController();

  String _searchQuery = '';
  String _statusFilter = 'All';
  String _scholarshipFilter = 'All';
  String _courseFilter = 'All';
  String _sortBy = 'Name (A-Z)';

  late Stream<QuerySnapshot> _studentsStream;

  static const List<String> _statusOptions = [
    'All',
    'Pending',
    'Approved',
    'Rejected',
    'Under Review',
  ];
  static const List<String> _courseOptions = ['All', 'BSIT', 'BTLED', 'BFPT'];
  static const List<String> _scholarshipOptions = [
    'All',
    'TES',
    'TDP',
    'DBP',
    'SANTEH',
    'STUFAP',
  ];
  static const List<String> _sortOptions = [
    'Name (A-Z)',
    'Latest First',
    'By Status',
  ];
  static const List<String> _yearOptions = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
  ];
  static const List<String> _courseAddOptions = ['BSIT', 'BTLED', 'BFPT'];
  static const List<String> _semesterOptions = [
    'AY 2023-2024, 1st Sem',
    'AY 2023-2024, 2nd Sem',
    'AY 2024-2025, 1st Sem',
    'AY 2024-2025, 2nd Sem',
    'AY 2025-2026, 1st Sem',
    'AY 2025-2026, 2nd Sem',
  ];

  String _selectedSemester = 'AY 2023-2024, 1st Sem';

  @override
  void initState() {
    super.initState();
    _studentsStream = _authService.getStudentsStream();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showAddStudentDialog() {
    final formKey = GlobalKey<FormState>();
    final nameCtrl = TextEditingController();
    final idCtrl = TextEditingController();
    final birthdateCtrl = TextEditingController();
    final saCtrl = TextEditingController();
    final payoutsReceivedCtrl = TextEditingController(text: '0');
    String selectedCourse = _courseAddOptions.first;
    String selectedYear = _yearOptions.first;
    String selectedScholarYearLevel = _yearOptions.first;
    String selectedFatherEdu = 'Non-graduate';
    String selectedMotherEdu = 'Non-graduate';
    String selectedGender = 'Male';
    bool isLoading = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.userPlus,
                      size: 18,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'Add New Student',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: SizedBox(
                width: 480,
                child: Form(
                  key: formKey,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(height: 8),
                        _dialogField(
                          controller: nameCtrl,
                          label: 'Full Name',
                          hint: 'e.g. Juan Dela Cruz',
                          icon: LucideIcons.user,
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Full name is required'
                              : null,
                        ),
                        _dialogField(
                          controller: idCtrl,
                          label: 'Student ID',
                          hint: 'e.g. 2023-00001',
                          icon: LucideIcons.hash,
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Student ID is required'
                              : null,
                        ),
                        SizedBox(height: 16),
                        _dialogField(
                          controller: birthdateCtrl,
                          label: 'Birthdate (mm/dd/yyyy)',
                          hint: 'Select birthdate',
                          icon: LucideIcons.cake,
                          readOnly: true,
                          onTap: () async {
                            final DateTime? picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime(2005),
                              firstDate: DateTime(1900),
                              lastDate: DateTime.now(),
                            );
                            if (picked != null) {
                              setDialogState(() {
                                birthdateCtrl.text = "${picked.month.toString().padLeft(2, '0')}/${picked.day.toString().padLeft(2, '0')}/${picked.year}";
                              });
                            }
                          },
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Birthdate is required'
                              : null,
                        ),
                        SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: _dialogDropdown(
                                label: 'Course',
                                value: selectedCourse,
                                items: _courseAddOptions,
                                onChanged: (val) =>
                                    setDialogState(() => selectedCourse = val!),
                              ),
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: _dialogDropdown(
                                label: 'Year',
                                value: selectedYear,
                                items: _yearOptions,
                                onChanged: (val) =>
                                    setDialogState(() => selectedYear = val!),
                              ),
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: _dialogDropdown(
                                label: 'Gender',
                                value: selectedGender,
                                items: const ['Male', 'Female'],
                                onChanged: (val) =>
                                    setDialogState(() => selectedGender = val!),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 16),
                        _dialogField(
                          controller: saCtrl,
                          label: 'SA Number (Optional)',
                          hint: 'e.g. 1234-5678-9012',
                          icon: LucideIcons.creditCard,
                          validator: null,
                        ),
                        SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _dialogDropdown(
                                label: 'Year Became Scholar',
                                value: selectedScholarYearLevel,
                                items: _yearOptions,
                                onChanged: (val) => setDialogState(() {
                                  selectedScholarYearLevel = val!;
                                  int payouts = 0;
                                  if (val.contains('2nd')) {
                                    payouts = 1;
                                  } else if (val.contains('3rd'))
                                    payouts = 2;
                                  else if (val.contains('4th') ||
                                      val.contains('5th'))
                                    payouts = 3;
                                  payoutsReceivedCtrl.text = payouts.toString();
                                }),
                              ),
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              child: _dialogField(
                                controller: payoutsReceivedCtrl,
                                label: 'Payouts Received',
                                hint: 'e.g. 0',
                                icon: LucideIcons.wallet,
                                validator: (v) {
                                  if (v != null && v.isNotEmpty) {
                                    if (int.tryParse(v) == null) {
                                      return 'Invalid number';
                                    }
                                  }
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _dialogDropdown(
                                label: "Father's Education",
                                value: selectedFatherEdu,
                                items: const ['Graduate', 'Non-graduate'],
                                onChanged: (val) => setDialogState(
                                  () => selectedFatherEdu = val!,
                                ),
                              ),
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              child: _dialogDropdown(
                                label: "Mother's Education",
                                value: selectedMotherEdu,
                                items: const ['Graduate', 'Non-graduate'],
                                onChanged: (val) => setDialogState(
                                  () => selectedMotherEdu = val!,
                                ),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 8),
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.amber.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: Colors.amber.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                LucideIcons.info,
                                size: 14,
                                color: Colors.amber.shade700,
                              ),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Student will be added with Pending status and must complete registration.',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.amber.shade800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isLoading
                      ? null
                      : () => Navigator.pop(dialogContext),
                  child: Text(
                    'Cancel',
                    style: TextStyle(color: context.textSec),
                  ),
                ),
                ElevatedButton(
                  onPressed: isLoading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setDialogState(() => isLoading = true);
                          try {
                            final newDoc = await FirebaseFirestore.instance
                                .collection('students')
                                .add({
                                  'fullName': nameCtrl.text.trim(),
                                  'studentId': idCtrl.text.trim(),
                                  'birthdate': birthdateCtrl.text.trim(),
                                  'course': selectedCourse,
                                  'year': selectedYear,
                                  'gender': selectedGender,
                                  'status': 'Pending',
                                  'scholarYearLevel': selectedScholarYearLevel,
                                  'payoutsReceived':
                                      int.tryParse(
                                        payoutsReceivedCtrl.text.trim(),
                                      ) ??
                                      0,
                                  'familyDetails': {
                                    'saNumber': saCtrl.text.trim(),
                                    'fatherEduStatus': selectedFatherEdu,
                                    'motherEduStatus': selectedMotherEdu,
                                  },
                                  'createdAt': FieldValue.serverTimestamp(),
                                });

                            // Set uid to match the document ID
                            await newDoc.update({'uid': newDoc.id});

                            await _auditService.logActivity(
                              action:
                                  'Added new student record: ${nameCtrl.text.trim()}',
                              userName: 'Admin',
                              role: 'Admin',
                              studentId: idCtrl.text.trim(),
                            );

                            if (mounted) {
                              Navigator.pop(dialogContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '${nameCtrl.text.trim()} has been added successfully.',
                                  ),
                                  backgroundColor: AppTheme.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isLoading = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Failed to add student. Please try again.',
                                  ),
                                  backgroundColor: AppTheme.error,
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: isLoading
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Add Student',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(() {
      nameCtrl.dispose();
      idCtrl.dispose();
      birthdateCtrl.dispose();
      saCtrl.dispose();
      payoutsReceivedCtrl.dispose();
    });
  }

  Widget _dialogField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    String? Function(String?)? validator,
    bool readOnly = false,
    VoidCallback? onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          readOnly: readOnly,
          onTap: onTap,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            prefixIcon: Icon(icon, size: 16, color: AppTheme.primaryColor),
            filled: true,
            fillColor: Colors.grey.withValues(alpha: 0.05),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppTheme.primaryColor, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppTheme.error),
            ),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _dialogDropdown({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: value,
          onChanged: onChanged,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.grey.withValues(alpha: 0.05),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppTheme.primaryColor, width: 1.5),
            ),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
          items: items
              .map(
                (e) => DropdownMenuItem(
                  value: e,
                  child: Text(e, style: TextStyle(fontSize: 13)),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 900;

        return SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            horizontal: isMobile ? 12 : 24,
            vertical: isMobile ? 12 : 24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(context, isMobile),
              const SizedBox(height: 32),
              _buildFilterBar(context, isMobile),
              const SizedBox(height: 16),
              _buildActiveFilterChips(context),
              const SizedBox(height: 16),
              _buildStudentTable(context, isMobile),
              const SizedBox(height: 40),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, bool isMobile) {
    if (isMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Student Records',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          SizedBox(height: 1),
          Row(
            children: [
              Expanded(child: _buildSemesterDropdown(context)),
              SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: ElevatedButton(
                  onPressed: _showAddStudentDialog,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Icon(LucideIcons.userPlus, size: 18),
                ),
              ),
              SizedBox(width: 8),
              IconButton(
                onPressed: () {
                  setState(() {
                    _studentsStream = _authService.getStudentsStream();
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Records refreshed'),
                        behavior: SnackBarBehavior.floating,
                        width: 200,
                      ),
                    );
                  }
                },
                icon: Icon(
                  LucideIcons.refreshCw,
                  size: 16,
                  color: AppTheme.primaryColor,
                ),
              ),
            ],
          ),
        ],
      );
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Student Records',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            SizedBox(height: 1),
            Text(
              'Manage and review all registered students.',
              style: TextStyle(fontSize: 13, color: context.textSec),
            ),
          ],
        ),
        Row(
          children: [
            _buildSemesterDropdown(context),
            SizedBox(width: 12),
            SizedBox(
              height: 40,
              child: ElevatedButton.icon(
                onPressed: _showAddStudentDialog,
                icon: Icon(LucideIcons.userPlus, size: 18),
                label: Text('Add Student', style: TextStyle(fontSize: 13)),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                ),
              ),
            ),
            SizedBox(width: 8),
            Tooltip(
              message: 'Refresh records',
              child: IconButton(
                onPressed: () {
                  setState(() {
                    _studentsStream = _authService.getStudentsStream();
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Student records refreshed.'),
                        behavior: SnackBarBehavior.floating,
                        width: 280,
                      ),
                    );
                  }
                },
                icon: Icon(
                  LucideIcons.refreshCw,
                  size: 18,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSemesterDropdown(BuildContext context) {
    return PopupMenuButton<String>(
      initialValue: _selectedSemester,
      onSelected: (val) => setState(() => _selectedSemester = val),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (context) => _semesterOptions.map((sem) {
        final bool isSelected = sem == _selectedSemester;
        return PopupMenuItem<String>(
          value: sem,
          child: Row(
            children: [
              if (isSelected)
                Icon(LucideIcons.check, size: 14, color: AppTheme.primaryColor)
              else
                SizedBox(width: 14),
              SizedBox(width: 8),
              Text(
                sem,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppTheme.primaryColor : null,
                ),
              ),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: context.surfaceC,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.calendarDays,
              size: 14,
              color: AppTheme.primaryColor,
            ),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                _selectedSemester,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: context.textPri,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            SizedBox(width: 6),
            Icon(Icons.arrow_drop_down, color: context.textSec, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterBar(BuildContext context, bool isMobile) {
    if (isMobile) {
      return Container(
        padding: EdgeInsets.all(1),
        decoration: context.glassDecoration,
        child: Column(
          children: [
            TextField(
              controller: _searchController,
              onChanged: (value) =>
                  setState(() => _searchQuery = value.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search by name, ID, or SA number...',
                prefixIcon: Icon(
                  LucideIcons.search,
                  size: 18,
                  color: AppTheme.primaryColor,
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: Icon(LucideIcons.x, size: 16),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: context.bgC.withValues(alpha: 0.5),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                contentPadding: EdgeInsets.symmetric(horizontal: 12),
              ),
            ),
            SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildFilterDropdown(
                    context,
                    'Status',
                    _statusOptions,
                    _statusFilter,
                    (val) => setState(() => _statusFilter = val!),
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: _buildFilterDropdown(
                    context,
                    'Scholarship',
                    _scholarshipOptions,
                    _scholarshipFilter,
                    (val) => setState(() => _scholarshipFilter = val!),
                  ),
                ),
              ],
            ),
            SizedBox(height: 10),
            _buildFilterDropdown(
              context,
              'Course',
              _courseOptions,
              _courseFilter,
              (val) => setState(() => _courseFilter = val!),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: context.glassDecoration,
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 40,
              child: TextField(
                controller: _searchController,
                style: TextStyle(fontSize: 13),
                onChanged: (value) =>
                    setState(() => _searchQuery = value.toLowerCase()),
                decoration: InputDecoration(
                  hintText: 'Search by name, ID, or SA number...',
                  prefixIcon: Icon(
                    LucideIcons.search,
                    size: 16,
                    color: AppTheme.primaryColor,
                  ),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: Icon(LucideIcons.x, size: 14),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: context.bgC.withValues(alpha: 0.5),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12),
                ),
              ),
            ),
          ),
          SizedBox(width: 12),
          _buildFilterDropdown(
            context,
            'Status',
            _statusOptions,
            _statusFilter,
            (val) => setState(() => _statusFilter = val!),
          ),
          SizedBox(width: 10),
          _buildFilterDropdown(
            context,
            'Scholarship',
            _scholarshipOptions,
            _scholarshipFilter,
            (val) => setState(() => _scholarshipFilter = val!),
          ),
          SizedBox(width: 10),
          _buildFilterDropdown(
            context,
            'Course',
            _courseOptions,
            _courseFilter,
            (val) => setState(() => _courseFilter = val!),
          ),
          SizedBox(width: 10),
          _buildFilterDropdown(
            context,
            'Sort By',
            _sortOptions,
            _sortBy,
            (val) => setState(() => _sortBy = val!),
          ),
          SizedBox(width: 4),
          if (_statusFilter != 'All' ||
              _scholarshipFilter != 'All' ||
              _courseFilter != 'All' ||
              _searchQuery.isNotEmpty)
            Tooltip(
              message: 'Clear all filters',
              child: IconButton(
                icon: Icon(
                  LucideIcons.filterX,
                  size: 18,
                  color: AppTheme.error,
                ),
                onPressed: _clearAllFilters,
              ),
            )
          else
            IconButton(
              icon: Icon(
                LucideIcons.slidersHorizontal,
                size: 18,
                color: context.textSec,
              ),
              onPressed: null,
              tooltip: 'No active filters',
            ),
        ],
      ),
    );
  }

  Widget _buildFilterDropdown(
    BuildContext context,
    String label,
    List<String> options,
    String currentValue,
    ValueChanged<String?> onChanged,
  ) {
    final bool isActive = currentValue != 'All';
    return PopupMenuButton<String>(
      initialValue: currentValue,
      onSelected: onChanged,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (context) => options.map((option) {
        final bool isSelected = option == currentValue;
        return PopupMenuItem<String>(
          value: option,
          child: Row(
            children: [
              if (isSelected)
                Icon(LucideIcons.check, size: 14, color: AppTheme.primaryColor)
              else
                SizedBox(width: 14),
              SizedBox(width: 8),
              Text(
                option,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppTheme.primaryColor : null,
                ),
              ),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? AppTheme.primaryColor.withValues(alpha: 0.08)
              : context.surfaceC.withValues(alpha: 0.5),
          border: Border.all(
            color: isActive
                ? AppTheme.primaryColor.withValues(alpha: 0.3)
                : context.surfaceC.withValues(alpha: 0.2),
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isActive ? currentValue : label,
              style: TextStyle(
                color: isActive ? AppTheme.primaryColor : context.textSec,
                fontSize: 13,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            SizedBox(width: 4),
            Icon(
              Icons.arrow_drop_down,
              size: 18,
              color: isActive ? AppTheme.primaryColor : context.textSec,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveFilterChips(BuildContext context) {
    final List<Widget> chips = [];

    if (_searchQuery.isNotEmpty) {
      chips.add(
        _buildChip(context, 'Search: "$_searchQuery"', () {
          _searchController.clear();
          setState(() => _searchQuery = '');
        }),
      );
    }
    if (_statusFilter != 'All') {
      chips.add(
        _buildChip(
          context,
          'Status: $_statusFilter',
          () => setState(() => _statusFilter = 'All'),
        ),
      );
    }
    if (_scholarshipFilter != 'All') {
      chips.add(
        _buildChip(
          context,
          'Scholarship: $_scholarshipFilter',
          () => setState(() => _scholarshipFilter = 'All'),
        ),
      );
    }
    if (_courseFilter != 'All') {
      chips.add(
        _buildChip(
          context,
          'Course: $_courseFilter',
          () => setState(() => _courseFilter = 'All'),
        ),
      );
    }

    if (chips.isEmpty) return SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ...chips,
        ActionChip(
          label: Text(
            'Clear All',
            style: TextStyle(fontSize: 12, color: AppTheme.error),
          ),
          avatar: Icon(LucideIcons.x, size: 12, color: AppTheme.error),
          backgroundColor: AppTheme.error.withValues(alpha: 0.08),
          side: BorderSide(color: AppTheme.error.withValues(alpha: 0.2)),
          onPressed: _clearAllFilters,
        ),
      ],
    );
  }

  Widget _buildChip(BuildContext context, String label, VoidCallback onRemove) {
    return Chip(
      label: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
      ),
      deleteIcon: Icon(LucideIcons.x, size: 12),
      onDeleted: onRemove,
      backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.08),
      side: BorderSide(color: AppTheme.primaryColor.withValues(alpha: 0.2)),
      deleteIconColor: context.textSec,
    );
  }

  void _clearAllFilters() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
      _statusFilter = 'All';
      _scholarshipFilter = 'All';
      _courseFilter = 'All';
    });
  }

  Widget _buildStudentTable(BuildContext context, bool isMobile) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: context.glassDecoration,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: isMobile ? 800 : 1000),
          child: StreamBuilder<QuerySnapshot>(
            stream: _studentsStream,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('Error: ${snapshot.error}'),
                  ),
                );
              }

              if (!snapshot.hasData) {
                return const SizedBox(
                  height: 300,
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              final allDocs = snapshot.data!.docs;
              if (allDocs.isEmpty) {
                return const SizedBox(
                  height: 200,
                  child: Center(child: Text('No students registered yet.')),
                );
              }

              // Apply filters
              final filteredDocs = allDocs.where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final String name = (data['fullName'] ?? '').toLowerCase();
                final String studentId = (data['studentId'] ?? '')
                    .toLowerCase();
                final String saNumber =
                    (data['saNumber'] ??
                            data['familyDetails']?['saNumber'] ??
                            '')
                        .toLowerCase();
                final String status = data['status'] ?? 'Pending';
                final String scholarship = data['scholarshipName'] ?? '';
                final String course = data['course'] ?? '';

                // Search filter
                if (_searchQuery.isNotEmpty) {
                  final bool matchesSearch =
                      name.contains(_searchQuery) ||
                      studentId.contains(_searchQuery) ||
                      saNumber.contains(_searchQuery);
                  if (!matchesSearch) return false;
                }

                // Status filter
                if (_statusFilter != 'All' && status != _statusFilter) {
                  return false;
                }

                // Scholarship filter
                if (_scholarshipFilter != 'All' &&
                    !scholarship.contains(_scholarshipFilter)) {
                  return false;
                }

                // Course filter
                if (_courseFilter != 'All' && course != _courseFilter) {
                  return false;
                }

                return true;
              }).toList();

              // Apply sorting
              filteredDocs.sort((a, b) {
                final dataA = a.data() as Map<String, dynamic>;
                final dataB = b.data() as Map<String, dynamic>;

                if (_sortBy == 'Name (A-Z)') {
                  return (dataA['fullName'] ?? '').compareTo(
                    dataB['fullName'] ?? '',
                  );
                } else if (_sortBy == 'Latest First') {
                  final timeA =
                      (dataA['createdAt'] as Timestamp?)?.toDate() ??
                      DateTime(2000);
                  final timeB =
                      (dataB['createdAt'] as Timestamp?)?.toDate() ??
                      DateTime(2000);
                  return timeB.compareTo(timeA);
                } else if (_sortBy == 'By Status') {
                  return (dataA['status'] ?? '').compareTo(
                    dataB['status'] ?? '',
                  );
                }
                return 0;
              });

              if (filteredDocs.isEmpty) {
                return SizedBox(
                  height: 220,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          LucideIcons.search,
                          size: 40,
                          color: Colors.grey.withValues(alpha: 0.4),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'No students match your filters.',
                          style: TextStyle(
                            color: context.textSec,
                            fontSize: 14,
                          ),
                        ),
                        SizedBox(height: 8),
                        TextButton(
                          onPressed: _clearAllFilters,
                          child: Text('Clear all filters'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return DataTable(
                horizontalMargin: 16,
                columnSpacing: 20,
                headingRowHeight: 48,
                dataRowMinHeight: 52,
                dataRowMaxHeight: 56,
                headingRowColor: WidgetStateProperty.all(
                  AppTheme.primaryColor.withValues(alpha: 0.02),
                ),
                columns: [
                  DataColumn(
                    label: Text(
                      'Student Name',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'ID Number',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Course & Year',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Scholarship',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Scholar Year',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Status',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'SA Number',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Birthdate',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Actions',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: context.textPri,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ],
                rows: filteredDocs.asMap().entries.map((entry) {
                  final int index = entry.key;
                  final doc = entry.value;
                  final data = doc.data() as Map<String, dynamic>;
                  final String name = data['fullName'] ?? 'N/A';
                  final String studentId = data['studentId'] ?? 'N/A';
                  final String course = data['course'] ?? 'N/A';
                  final String year = data['year'] ?? 'N/A';
                  final String status = data['status'] ?? 'Pending';
                  final String birthdate = data['birthdate'] ?? '01/01/2000';
                  final String saNumber =
                      data['saNumber'] ??
                      data['familyDetails']?['saNumber'] ??
                      'Not Provided';

                  return _buildDataRow(
                    context,
                    data,
                    doc.id,
                    name,
                    studentId,
                    '$course - $year',
                    data['scholarshipName'] ?? 'N/A',
                    data['scholarYearLevel'] ?? 'N/A',
                    status,
                    saNumber,
                    birthdate,
                    isEven: index % 2 == 0,
                  );
                }).toList(),
              );
            },
          ),
        ),
      ),
    );
  }

  DataRow _buildDataRow(
    BuildContext context,
    Map<String, dynamic> data,
    String docId,
    String name,
    String studentId,
    String courseYear,
    String scholarship,
    String scholarYear,
    String status,
    String saNumber,
    String birthdate, {
    bool isEven = false,
  }) {
    Color statusColor = AppTheme.warning;
    if (status == 'Approved') statusColor = AppTheme.success;
    if (status == 'Rejected') statusColor = AppTheme.error;
    if (status == 'Under Review') statusColor = AppTheme.secondaryColor;

    return DataRow(
      color: WidgetStateProperty.all(
        isEven ? Colors.transparent : context.surfaceC.withValues(alpha: 0.1),
      ),
      cells: [
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              () {
                final String? photoUrl = data['profilePictureUrl'] as String?;
                final String initial = name.isNotEmpty
                    ? name[0].toUpperCase()
                    : '?';
                if (photoUrl != null && photoUrl.isNotEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFFBC02D),
                        width: 2,
                      ),
                    ),
                    child: CircleAvatar(
                      radius: 14,
                      backgroundColor: AppTheme.primaryColor.withValues(
                        alpha: 0.1,
                      ),
                      backgroundImage: NetworkImage(photoUrl),
                    ),
                  );
                }
                return Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFBC02D),
                      width: 2,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: AppTheme.primaryColor.withValues(
                      alpha: 0.12,
                    ),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ),
                );
              }(),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        DataCell(
          Text(
            studentId,
            style: TextStyle(fontSize: 13, color: context.textSec),
          ),
        ),
        DataCell(
          Text(
            courseYear,
            style: TextStyle(fontSize: 13, color: context.textSec),
          ),
        ),
        DataCell(
          Text(
            scholarship,
            style: TextStyle(fontSize: 13, color: context.textSec),
          ),
        ),
        DataCell(
          Text(
            scholarYear,
            style: TextStyle(fontSize: 13, color: context.textSec),
          ),
        ),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: statusColor.withValues(alpha: 0.2),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: statusColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
        DataCell(
          Text(
            saNumber,
            style: TextStyle(
              fontSize: 13,
              color: saNumber == 'Not Provided' ? Colors.grey : context.textPri,
            ),
          ),
        ),
        DataCell(
          Text(
            birthdate,
            style: TextStyle(
              fontSize: 13,
              color: context.textSec,
            ),
          ),
        ),
        DataCell(
          Row(
            children: [
              _buildActionIcon(LucideIcons.eye, AppTheme.primaryColor, () {
                _showStudentProfile(data, docId);
              }),
              const SizedBox(width: 4),
              _buildActionIcon(LucideIcons.checkSquare, AppTheme.success, () {
                _updateStudentStatus(docId, name, studentId, 'Approved');
              }),
              const SizedBox(width: 4),
              _buildActionIcon(LucideIcons.xSquare, AppTheme.error, () {
                _updateStudentStatus(docId, name, studentId, 'Rejected');
              }),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _updateStudentStatus(
    String docId,
    String name,
    String studentId,
    String newStatus,
  ) async {
    try {
      // Update with all administrative fields often required by security rules
      await FirebaseFirestore.instance
          .collection('students')
          .doc(docId)
          .update({
            'status': newStatus,
            'adminRemarks': 'Updated via Student Records',
            'requiresResubmission': false,
            'updatedAt': FieldValue.serverTimestamp(),
          });

      await _auditService.logActivity(
        action: 'Changed student status to $newStatus',
        userName: 'Admin',
        role: 'Admin',
        studentId: studentId,
      );

      String notificationType = 'info';
      String message = 'Your status has been updated to $newStatus.';

      if (newStatus == 'Approved') {
        notificationType = 'success';
        message =
            'Your documents have been verified and approved. Congratulations!';
      } else if (newStatus == 'Rejected') {
        notificationType = 'error';
        message =
            'Your documents were flagged for correction. Please see feedback in your submissions tab.';
      } else if (newStatus == 'Under Review') {
        notificationType = 'warning';
      }

      await _notificationService.sendNotification(
        studentId: docId,
        title: 'Status Updated: $newStatus',
        message: message,
        type: notificationType,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully marked $name as $newStatus.'),
            backgroundColor: newStatus == 'Approved'
                ? AppTheme.success
                : AppTheme.error,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error updating student status: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update status: ${e.toString()}'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  void _showStudentProfile(Map<String, dynamic> data, String docId) async {
    final String name = data['fullName'] ?? 'Unknown Student';
    final String studentId = data['studentId'] ?? 'N/A';
    final String email = data['email'] ?? data['authEmail'] ?? 'N/A';
    final String contactNumber = data['contactNumber'] ?? 'N/A';

    final String courseDisplay =
        data['courseDisplay'] ?? data['course'] ?? 'N/A';
    final String year = data['year'] ?? 'N/A';
    final String section = data['section'] ?? 'N/A';
    final String scholarshipName =
        data['scholarshipName'] ?? 'No Scholarship Selected';

    final String status = data['status'] ?? 'Pending';
    final Map<String, dynamic> family = data['familyDetails'] ?? {};
    final String saNumber = family['saNumber'] ?? 'Not Provided';

    final Timestamp? createdAt = data['createdAt'];
    final String registeredOn = createdAt != null
        ? DateFormat('MMMM dd, yyyy').format(createdAt.toDate())
        : 'N/A';

    final double screenWidth = MediaQuery.of(context).size.width;
    final bool isCompact = screenWidth < 700;

    // Log the profile view
    await _auditService.logActivity(
      action: 'Viewed full student profile: $name',
      userName: 'Admin',
      role: 'Admin',
      studentId: studentId,
    );

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: context.bgC,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 30,
                spreadRadius: 5,
              ),
            ],
          ),
          child: Column(
            children: [
              // Premium Handle bar
              Container(
                margin: const EdgeInsets.symmetric(vertical: 16),
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(32, 8, 32, 32),
                  children: [
                    // Header Section
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppTheme.primaryColor.withValues(
                                alpha: 0.2,
                              ),
                              width: 2,
                            ),
                          ),
                          child: CircleAvatar(
                            radius: 42,
                            backgroundColor: AppTheme.primaryColor.withValues(
                              alpha: 0.08,
                            ),
                            backgroundImage:
                                (data['profilePictureUrl'] != null &&
                                    (data['profilePictureUrl'] as String)
                                        .isNotEmpty)
                                ? NetworkImage(
                                    data['profilePictureUrl'] as String,
                                  )
                                : null,
                            child:
                                (data['profilePictureUrl'] == null ||
                                    (data['profilePictureUrl'] as String)
                                        .isEmpty)
                                ? const Icon(
                                    LucideIcons.user,
                                    size: 42,
                                    color: AppTheme.primaryColor,
                                  )
                                : null,
                          ),
                        ),
                        const SizedBox(width: 24),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  color: context.textPri,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.badge,
                                    size: 14,
                                    color: context.textSec,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    studentId,
                                    style: TextStyle(
                                      color: context.textSec,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  _buildStatusBadge(status),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    // Section 1: Academics & Contact
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.graduationCap,
                          size: 18,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Academic & Contact',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: context.textPri,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    GridView.count(
                      crossAxisCount: isCompact ? 1 : 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: isCompact ? 4.0 : 3.0,
                      children: [
                        _buildProfileInfoCard(
                          LucideIcons.bookOpen,
                          'Program / Course',
                          courseDisplay,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.calendarDays,
                          'Year & Section',
                          '$year - Sec $section',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.award,
                          'Scholarship',
                          scholarshipName,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.mail,
                          'Email Address',
                          email,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.phone,
                          'Contact Number',
                          contactNumber,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.users,
                          'Gender',
                          data['gender'] ?? 'Not Specified',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.cake,
                          'Birthdate',
                          data['birthdate'] ?? '01/01/2000',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.clock,
                          'Registration Date',
                          registeredOn,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.calendarDays,
                          'Scholar Year',
                          data['scholarYearLevel'] ?? 'N/A',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.wallet,
                          'Payouts Received',
                          data['payoutsReceived']?.toString() ?? '0',
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    // Section 2: Financial & Background
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.wallet,
                          size: 18,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Financial & Background',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: context.textPri,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    GridView.count(
                      crossAxisCount: isCompact ? 1 : 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: isCompact ? 4.0 : 3.0,
                      children: [
                        _buildProfileInfoCard(
                          LucideIcons.creditCard,
                          'SA Number (TES)',
                          saNumber,
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.banknote,
                          'Total Yearly Income',
                          'PHP ${family['yearlyIncome'] ?? 'N/A'}',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.church,
                          'Religion',
                          family['religion'] ?? 'N/A',
                        ),
                        _buildProfileInfoCard(
                          LucideIcons.users,
                          'Tribe / Ethnicity',
                          family['tribe'] ?? 'N/A',
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    // Section 3: Family Info
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.heartPulse,
                          size: 18,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Family Documentation',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: context.textPri,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: _buildFamilyCard(
                            'Father',
                            family['fatherName']?.toString(),
                            family['fatherAge']?.toString(),
                            family['fatherOccupation']?.toString(),
                            edu: family['fatherEduStatus']?.toString(),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildFamilyCard(
                            'Mother',
                            family['motherName']?.toString(),
                            family['motherAge']?.toString(),
                            family['motherOccupation']?.toString(),
                            edu: family['motherEduStatus']?.toString(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    // Verification Documents (Mocked for UI flow)
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.folderCheck,
                          size: 18,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Verification Assets',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: context.textPri,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (data['submissionPdfUrl'] != null)
                      _buildDocumentItem(
                        'ID & Signatures Combined PDF',
                        'verified',
                      )
                    else
                      _buildDocumentItem(
                        'No documents uploaded yet',
                        'pending',
                      ),
                    const SizedBox(height: 48),

                    // Compliance Action
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppTheme.primaryColor.withValues(alpha: 0.1),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryColor.withValues(
                              alpha: 0.02,
                            ),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Administrative Actions',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Use these controls to finalize document verification for this student.',
                            style: TextStyle(
                              fontSize: 13,
                              color: context.textSec,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    Navigator.pop(context);
                                    _updateStudentStatus(
                                      docId,
                                      name,
                                      studentId,
                                      'Approved',
                                    );
                                  },
                                  icon: const Icon(
                                    LucideIcons.checkCircle2,
                                    size: 18,
                                  ),
                                  label: const Text(
                                    'Approve Data',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.success,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 18,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    elevation: 0,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.pop(context);
                                    _updateStudentStatus(
                                      docId,
                                      name,
                                      studentId,
                                      'Rejected',
                                    );
                                  },
                                  icon: const Icon(
                                    LucideIcons.xCircle,
                                    size: 18,
                                  ),
                                  label: const Text(
                                    'Flag for Revision',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.error,
                                    side: const BorderSide(
                                      color: AppTheme.error,
                                      width: 1.5,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 18,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 60),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFamilyCard(
    String role,
    String? name,
    String? age,
    String? occupation, {
    String? edu,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppTheme.secondaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  role == 'Father'
                      ? LucideIcons.briefcase
                      : LucideIcons.briefcase,
                  size: 12,
                  color: AppTheme.secondaryColor,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                role,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: context.textSec,
                  fontSize: 13,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            name ?? 'N/A',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: context.textPri,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 12),
          Divider(
            color: context.isDark ? Colors.grey.shade800 : Colors.grey.shade200,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(LucideIcons.calendar, size: 14, color: context.textSec),
              const SizedBox(width: 6),
              Text(
                '${age ?? 'N/A'} yrs',
                style: TextStyle(
                  fontSize: 13,
                  color: context.textSec,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(LucideIcons.briefcase, size: 14, color: context.textSec),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  occupation ?? 'N/A',
                  style: TextStyle(
                    fontSize: 13,
                    color: context.textSec,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (edu != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  LucideIcons.graduationCap,
                  size: 14,
                  color: context.textSec,
                ),
                const SizedBox(width: 6),
                Text(
                  edu,
                  style: TextStyle(
                    fontSize: 13,
                    color: context.textSec,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color = AppTheme.warning;
    if (status == 'Approved') color = AppTheme.success;
    if (status == 'Rejected') color = AppTheme.error;
    if (status == 'Under Review') color = AppTheme.secondaryColor;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            status,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileInfoCard(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade200,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 18, color: AppTheme.primaryColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.textSec,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: context.textPri,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentItem(String title, String status) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              LucideIcons.fileText,
              color: AppTheme.primaryColor,
              size: 18,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: context.textPri,
              ),
            ),
          ),
          if (status == 'verified')
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.success.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.check,
                color: AppTheme.success,
                size: 14,
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Processing',
                style: TextStyle(
                  fontSize: 11,
                  color: AppTheme.warning,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActionIcon(IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          border: Border.all(color: color.withValues(alpha: 0.1), width: 1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14, color: color),
      ),
    );
  }
}
