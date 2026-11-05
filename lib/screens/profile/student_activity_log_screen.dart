import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';

class StudentActivityLogScreen extends StatefulWidget {
  const StudentActivityLogScreen({super.key});

  @override
  State<StudentActivityLogScreen> createState() =>
      _StudentActivityLogScreenState();
}

class _StudentActivityLogScreenState extends State<StudentActivityLogScreen> {
  final AuthService _authService = AuthService();
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  DateTime? _selectedDate;
  String _activePreset = 'all'; // 'all', '24h', '7days'
  late Stream<List<Map<String, dynamic>>> _auditStream;
  Map<String, dynamic>? _studentProfile;

  @override
  void initState() {
    super.initState();
    _auditStream = _authService.getAuditLogsStream();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = _authService.currentUser;
    if (user != null) {
      try {
        final profile = await _authService.getStudentProfile(user.id);
        if (mounted) {
          setState(() {
            _studentProfile = profile;
          });
        }
      } catch (e) {
        debugPrint('StudentActivityLogScreen: Profile load error: $e');
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _isCurrentUserActivity({
    required Map<String, dynamic> data,
    required String currentUid,
    required String currentEmail,
    required String profileStudentNo,
    required String profileName,
    required String inferredStudentNo,
  }) {
    final String logRole =
        (data['role'] ?? 'Student').toString().trim().toLowerCase();
    final String logUserName =
        (data['userName'] ?? data['adminName'] ?? '').toString().trim().toLowerCase();
    final String logStudentId =
        (data['studentId'] ?? '').toString().trim().toLowerCase();
    final String cleanLogSid =
        logStudentId.replaceAll('-', '').replaceAll(' ', '');

    // Administrator activities are performed on the student, not by the student
    if (logRole.contains('admin')) {
      return false;
    }

    if (profileName.isNotEmpty && logUserName == profileName) {
      return true;
    }
    if (currentEmail.isNotEmpty &&
        (logUserName == currentEmail || logStudentId == currentEmail)) {
      return true;
    }
    if (profileStudentNo.isNotEmpty &&
        (logStudentId == profileStudentNo ||
            cleanLogSid ==
                profileStudentNo.replaceAll('-', '').replaceAll(' ', ''))) {
      return true;
    }
    if (inferredStudentNo.isNotEmpty &&
        (logStudentId == inferredStudentNo ||
            cleanLogSid ==
                inferredStudentNo.replaceAll('-', '').replaceAll(' ', ''))) {
      return true;
    }
    if (currentUid.isNotEmpty && logStudentId == currentUid) {
      return true;
    }

    return true; // Default to true for matched student-scoped entries
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = _authService.currentUser;
    if (currentUser == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Account Activity')),
        body: const Center(child: Text('Please log in to view activity.')),
      );
    }

    final currentUid = currentUser.id.toLowerCase().trim();
    final currentEmail = (currentUser.email ?? '').toLowerCase().trim();
    final profileStudentNo = (_studentProfile?['student_no'] ??
            _studentProfile?['studentId'] ??
            '')
        .toString()
        .trim()
        .toLowerCase();
    final cleanProfileStudentNo =
        profileStudentNo.replaceAll('-', '').replaceAll(' ', '');
    final profileName = (_studentProfile?['fullName'] ??
            _studentProfile?['full_name'] ??
            '')
        .toString()
        .trim()
        .toLowerCase();

    // Infer student number from email prefix if profile data is still loading
    String inferredStudentNo = profileStudentNo;
    if (inferredStudentNo.isEmpty && currentEmail.contains('@')) {
      final prefix =
          currentEmail.split('@').first.replaceAll('_', '').replaceAll('-', '');
      if (RegExp(r'^\d+$').hasMatch(prefix)) {
        inferredStudentNo = prefix;
      }
    }
    final cleanInferred =
        inferredStudentNo.replaceAll('-', '').replaceAll(' ', '');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account Activity'),
        actions: [
          IconButton(
            tooltip: 'Refresh Activity Logs',
            icon: const Icon(LucideIcons.refreshCw, size: 18),
            onPressed: () {
              setState(() {
                _auditStream = _authService.getAuditLogsStream();
              });
              _loadProfile();
            },
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final bool isMobile = constraints.maxWidth < 900;

          return StreamBuilder<List<Map<String, dynamic>>>(
            stream: _auditStream,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return const Center(child: Text('Error loading activity logs'));
              }

              // 1. Strictly isolate logs relevant ONLY to this user
              List<Map<String, dynamic>> docs = snapshot.data ?? [];

              docs = docs.where((data) {
                final String logStudentId = (data['studentId'] ?? '')
                    .toString()
                    .trim()
                    .toLowerCase();
                final String cleanLogSid =
                    logStudentId.replaceAll('-', '').replaceAll(' ', '');
                final String logTargetUser = (data['targetUser'] ?? '')
                    .toString()
                    .trim()
                    .toLowerCase();
                final String logUserName = (data['userName'] ??
                        data['adminName'] ??
                        '')
                    .toString()
                    .trim()
                    .toLowerCase();
                final String logRole =
                    (data['role'] ?? 'Student').toString().trim().toLowerCase();

                // 1a. Direct match on Target User UID (Admin action on this student)
                if (logTargetUser.isNotEmpty &&
                    currentUid.isNotEmpty &&
                    logTargetUser == currentUid) {
                  return true;
                }

                // 1b. Direct match on Student ID number
                final bool isSpecificStudentId = logStudentId.isNotEmpty &&
                    logStudentId != 'n/a' &&
                    logStudentId != 'admin' &&
                    logStudentId != 'superadmin' &&
                    logStudentId != 'unknown';

                if (isSpecificStudentId) {
                  if (profileStudentNo.isNotEmpty &&
                      (logStudentId == profileStudentNo ||
                          cleanLogSid == cleanProfileStudentNo)) {
                    return true;
                  }
                  if (inferredStudentNo.isNotEmpty &&
                      (logStudentId == inferredStudentNo ||
                          cleanLogSid == cleanInferred)) {
                    return true;
                  }
                  if (currentUid.isNotEmpty && logStudentId == currentUid) {
                    return true;
                  }
                }

                // 1c. Match on User Name or Email if log role is Student
                if (logRole == 'student') {
                  if (profileName.isNotEmpty && logUserName == profileName) {
                    return true;
                  }
                  if (currentEmail.isNotEmpty &&
                      (logUserName == currentEmail ||
                          logStudentId == currentEmail)) {
                    return true;
                  }
                  if (profileStudentNo.isNotEmpty &&
                      logUserName.contains(profileStudentNo)) {
                    return true;
                  }
                  if (inferredStudentNo.isNotEmpty &&
                      logUserName.contains(inferredStudentNo)) {
                    return true;
                  }
                }

                return false;
              }).toList();

              // 2. Date Filtering
              final now = DateTime.now();
              if (_selectedDate != null) {
                docs = docs.where((data) {
                  final timestamp = data['timestamp'];
                  if (timestamp != null) {
                    try {
                      final dateTime =
                          DateTime.parse(timestamp.toString()).toLocal();
                      return dateTime.year == _selectedDate!.year &&
                          dateTime.month == _selectedDate!.month &&
                          dateTime.day == _selectedDate!.day;
                    } catch (_) {}
                  }
                  return false;
                }).toList();
              } else if (_activePreset == '24h') {
                docs = docs.where((data) {
                  final timestamp = data['timestamp'];
                  if (timestamp != null) {
                    try {
                      final dateTime =
                          DateTime.parse(timestamp.toString()).toLocal();
                      return now.difference(dateTime).inHours < 24;
                    } catch (_) {}
                  }
                  return true;
                }).toList();
              } else if (_activePreset == '7days') {
                docs = docs.where((data) {
                  final timestamp = data['timestamp'];
                  if (timestamp != null) {
                    try {
                      final dateTime =
                          DateTime.parse(timestamp.toString()).toLocal();
                      return now.difference(dateTime).inDays < 7;
                    } catch (_) {}
                  }
                  return true;
                }).toList();
              }

              // 3. Search Query Filter
              if (_searchQuery.isNotEmpty) {
                final query = _searchQuery.toLowerCase();
                docs = docs.where((data) {
                  final String action =
                      (data['action'] ?? '').toString().toLowerCase();
                  final String userName = (data['userName'] ??
                          data['adminName'] ??
                          '')
                      .toString()
                      .toLowerCase();
                  final String platform =
                      (data['ipAddress'] ?? '').toString().toLowerCase();
                  return action.contains(query) ||
                      userName.contains(query) ||
                      platform.contains(query);
                }).toList();
              }

              return SingleChildScrollView(
                padding: EdgeInsets.all(isMobile ? 14 : 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'My Activity History',
                      style: isMobile
                          ? Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                              )
                          : Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Track your login sessions, profile edits, and scholarship updates.',
                      style: TextStyle(
                        color: context.textSec,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Filters and Presets Section
                    _buildFilters(context, isMobile, docs.length),
                    const SizedBox(height: 18),

                    if (docs.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 60),
                          child: Column(
                            children: [
                              Icon(
                                LucideIcons.search,
                                size: 48,
                                color: Colors.grey.withValues(alpha: 0.5),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _searchQuery.isNotEmpty || _selectedDate != null
                                    ? 'No activity logs match your filter.'
                                    : 'No account activity recorded yet.',
                                style: const TextStyle(
                                  color: Colors.grey,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (_selectedDate != null ||
                                  _activePreset != 'all' ||
                                  _searchQuery.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                OutlinedButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      _selectedDate = null;
                                      _activePreset = 'all';
                                      _searchQuery = '';
                                      _searchController.clear();
                                    });
                                  },
                                  icon: const Icon(LucideIcons.rotateCcw, size: 14),
                                  label: const Text('Reset Filters'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      )
                    else
                      Container(
                        decoration: context.glassDecoration,
                        child: ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: docs.length,
                          separatorBuilder: (context, index) => Divider(
                            color: context.surfaceC.withValues(alpha: 0.12),
                            height: 1,
                          ),
                          itemBuilder: (context, index) {
                            final data = docs[index];
                            final bool isCurrentUserAction =
                                _isCurrentUserActivity(
                              data: data,
                              currentUid: currentUid,
                              currentEmail: currentEmail,
                              profileStudentNo: profileStudentNo,
                              profileName: profileName,
                              inferredStudentNo: inferredStudentNo,
                            );
                            return _buildLogItem(
                              context,
                              data,
                              isMobile,
                              isCurrentUserAction,
                            );
                          },
                        ),
                      ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildFilters(BuildContext context, bool isMobile, int resultCount) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: context.glassDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    LucideIcons.history,
                    size: 16,
                    color: AppTheme.secondaryColor,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Search & Filter',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$resultCount logs',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: context.isDark ? Colors.white70 : AppTheme.primaryColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Search Field + Calendar Picker
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search login, profile, or device...',
                    hintStyle: const TextStyle(fontSize: 12.5),
                    prefixIcon: const Icon(LucideIcons.search, size: 18),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(LucideIcons.x, size: 16),
                            onPressed: () {
                              setState(() {
                                _searchQuery = '';
                                _searchController.clear();
                              });
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.grey.withValues(alpha: 0.05),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: 0,
                      horizontal: 10,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate ?? DateTime.now(),
                    firstDate: DateTime(2025),
                    lastDate: DateTime.now(),
                    builder: (context, child) {
                      return Theme(
                        data: Theme.of(context).copyWith(
                          colorScheme: ColorScheme.light(
                            primary: AppTheme.primaryColor,
                            onPrimary: Colors.white,
                            surface: context.surfaceC,
                            onSurface: context.textPri,
                          ),
                        ),
                        child: child!,
                      );
                    },
                  );
                  if (picked != null) {
                    setState(() {
                      _selectedDate = picked;
                      _activePreset = 'custom';
                    });
                  }
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _selectedDate != null
                        ? AppTheme.primaryColor
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    LucideIcons.calendar,
                    size: 18,
                    color: _selectedDate != null ? Colors.white : context.textSec,
                  ),
                ),
              ),
              if (_selectedDate != null) ...[
                const SizedBox(width: 4),
                IconButton(
                  onPressed: () => setState(() {
                    _selectedDate = null;
                    _activePreset = 'all';
                  }),
                  icon: const Icon(LucideIcons.x, size: 16),
                  tooltip: 'Clear Date Filter',
                ),
              ],
            ],
          ),

          const SizedBox(height: 10),

          // Date Filter Preset Chips
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildPresetChip('All Time', 'all'),
              _buildPresetChip('Last 24h', '24h'),
              _buildPresetChip('Past 7 Days', '7days'),
              if (_selectedDate != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppTheme.primaryColor.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    DateFormat('MMM d, yyyy').format(_selectedDate!),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPresetChip(String label, String presetKey) {
    final bool isSelected = _selectedDate == null && _activePreset == presetKey;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedDate = null;
          _activePreset = presetKey;
        });
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryColor
              : Colors.grey.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? AppTheme.primaryColor
                : Colors.grey.withValues(alpha: 0.2),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : null,
          ),
        ),
      ),
    );
  }

  Widget _buildLogItem(
    BuildContext context,
    Map<String, dynamic> data,
    bool isMobile,
    bool isCurrentUserAction,
  ) {
    final String action = (data['action'] ?? 'Performed Action').toString();
    final String rawActor =
        (data['userName'] ?? data['adminName'] ?? '').toString().trim();
    final String role = (data['role'] ?? 'Student').toString().trim();
    final String platform =
        (data['ipAddress'] ?? 'Unknown Device').toString().trim();
    final String studentId = (data['studentId'] ?? '').toString().trim();
    final dynamic timestamp = data['timestamp'];

    // Format local timezone timestamp and relative time
    String timeStr = 'Just now';
    String relativeTime = '';
    if (timestamp != null) {
      try {
        final dateTime = DateTime.parse(timestamp.toString()).toLocal();
        timeStr = DateFormat('MMM d, yyyy • h:mm a').format(dateTime);

        final diff = DateTime.now().difference(dateTime);
        if (diff.inSeconds < 45) {
          relativeTime = 'Just now';
        } else if (diff.inMinutes < 60) {
          relativeTime = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          relativeTime = '${diff.inHours}h ago';
        } else if (diff.inDays < 7) {
          relativeTime = '${diff.inDays}d ago';
        } else {
          relativeTime = DateFormat('MMM d').format(dateTime);
        }
      } catch (_) {}
    }

    // Determine icon and color based on activity type
    final actionLower = action.toLowerCase();
    IconData itemIcon = LucideIcons.activity;
    Color iconColor = AppTheme.primaryColor;
    Color iconBg = AppTheme.primaryColor.withValues(alpha: 0.12);

    if (actionLower.contains('login') || actionLower.contains('logged in')) {
      itemIcon = LucideIcons.logIn;
      iconColor = const Color(0xFF10B981); // Emerald green for logins
      iconBg = const Color(0xFF10B981).withValues(alpha: 0.14);
    } else if (actionLower.contains('register')) {
      itemIcon = LucideIcons.userPlus;
      iconColor = const Color(0xFF6366F1);
      iconBg = const Color(0xFF6366F1).withValues(alpha: 0.14);
    } else if (actionLower.contains('photo') || actionLower.contains('picture')) {
      itemIcon = LucideIcons.camera;
      iconColor = const Color(0xFF8B5CF6);
      iconBg = const Color(0xFF8B5CF6).withValues(alpha: 0.14);
    } else if (actionLower.contains('profile')) {
      itemIcon = LucideIcons.userCheck;
      iconColor = const Color(0xFF3B82F6);
      iconBg = const Color(0xFF3B82F6).withValues(alpha: 0.14);
    } else if (actionLower.contains('submit') || actionLower.contains('upload')) {
      itemIcon = LucideIcons.uploadCloud;
      iconColor = const Color(0xFF0EA5E9);
      iconBg = const Color(0xFF0EA5E9).withValues(alpha: 0.14);
    } else if (actionLower.contains('verif') ||
        actionLower.contains('approv') ||
        actionLower.contains('validat')) {
      itemIcon = LucideIcons.shieldCheck;
      iconColor = const Color(0xFFF59E0B);
      iconBg = const Color(0xFFF59E0B).withValues(alpha: 0.14);
    }

    // Account identification
    final String performerName = isCurrentUserAction
        ? 'You'
        : (rawActor.isNotEmpty
            ? rawActor
            : (role.isNotEmpty ? role : 'Administrator'));

    final bool isSuperAdmin = role.toLowerCase().contains('super');
    final bool isAdmin = role.toLowerCase().contains('admin');

    Color roleBadgeColor = const Color(0xFF10B981);
    if (isSuperAdmin) {
      roleBadgeColor = const Color(0xFFF59E0B);
    } else if (isAdmin) {
      roleBadgeColor = const Color(0xFF3B82F6);
    } else if (isCurrentUserAction) {
      roleBadgeColor = AppTheme.primaryColor;
    }

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isMobile ? 12 : 16,
        vertical: 10,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: iconBg,
              shape: BoxShape.circle,
            ),
            child: Icon(itemIcon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Performer Tag + Relative Timestamp
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2.5,
                      ),
                      decoration: BoxDecoration(
                        color: roleBadgeColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: roleBadgeColor.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isCurrentUserAction
                                ? LucideIcons.user
                                : LucideIcons.shield,
                            size: 11,
                            color: roleBadgeColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            performerName,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: roleBadgeColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (relativeTime.isNotEmpty) ...[
                      const Spacer(),
                      Text(
                        relativeTime,
                        style: TextStyle(
                          fontSize: 11,
                          color: context.textSec,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),

                // Action description
                Text(
                  action,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: context.textPri,
                    height: 1.25,
                  ),
                ),

                const SizedBox(height: 6),

                // Meta row: Time, Device, Target ID
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.clock, size: 11, color: context.textSec),
                        const SizedBox(width: 4),
                        Text(
                          timeStr,
                          style: TextStyle(
                            fontSize: 11,
                            color: context.textSec,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.monitor, size: 11, color: context.textSec),
                        const SizedBox(width: 4),
                        Text(
                          platform,
                          style: TextStyle(
                            fontSize: 11,
                            color: context.textSec,
                          ),
                        ),
                      ],
                    ),
                    if (studentId.isNotEmpty &&
                        studentId != 'N/A' &&
                        !isCurrentUserAction)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            LucideIcons.badgeCheck,
                            size: 11,
                            color: context.textSec,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'ID: $studentId',
                            style: TextStyle(
                              fontSize: 11,
                              color: context.textSec,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
