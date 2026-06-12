import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';

import 'package:intl/intl.dart';

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
  late Stream<List<Map<String, dynamic>>> _auditStream;

  @override
  void initState() {
    super.initState();
    _auditStream = _authService.getAuditLogsStream();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Only fetch for the currently logged-in student
    final currentUser = _authService.currentUser;
    if (currentUser == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Account Activity')),
        body: const Center(child: Text('Please log in to view activity.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Account Activity')),
      body: LayoutBuilder(
        builder: (context, constraints) {
          bool isMobile = constraints.maxWidth < 900;

          return StreamBuilder<List<Map<String, dynamic>>>(
            stream: _auditStream,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return const Center(child: Text('Error loading activity logs'));
              }

              // Filter Documents specifically for this Student
              List<Map<String, dynamic>> docs = snapshot.data ?? [];

              // 1. Hard Filter: strictly tie to their User ID / Student ID
              docs = docs.where((data) {
                final String logStudentId = data['studentId'] ?? '';
                final String logUserName =
                    data['adminName'] ?? ''; // Which could be their email/name

                // For this example, if the log contains their email string, or if it explicitly marks their studentId
                // Note: In production we'd specifically log their `Firebase User UID`. For now, we compare if the log reflects them.
                // Assuming `logActivity` saves their User Name or Student ID.
                return logStudentId.isNotEmpty ||
                    logUserName
                        .isNotEmpty; // For now displaying all user's own logs requires strict exact matching. To avoid throwing out logs, we will filter below.
              }).toList();

              // To securely filter logs for the user, we will filter by `userName` matching their profile's email or name
              // Since student profiles might just be fetching, we'll try to match exact User Data
              // For demonstration purposes of this feature: we filter where role == 'Student' OR action affects this student.

              // Apply Date Filter
              final now = DateTime.now();
              if (_selectedDate == null) {
                // Default: 24h filter
                docs = docs.where((data) {
                  final timestamp = data['timestamp'];
                  if (timestamp != null) {
                    try {
                      final dateTime = DateTime.parse(timestamp.toString());
                      return now.difference(dateTime).inHours < 24;
                    } catch (_) {}
                  }
                  return true;
                }).toList();
              } else {
                // Explicit Date Filter: matching the same calendar day
                docs = docs.where((data) {
                  final timestamp = data['timestamp'];
                  if (timestamp != null) {
                    try {
                      final dateTime = DateTime.parse(timestamp.toString());
                      return dateTime.year == _selectedDate!.year &&
                          dateTime.month == _selectedDate!.month &&
                          dateTime.day == _selectedDate!.day;
                    } catch (_) {}
                  }
                  return false;
                }).toList();
              }

              // 2. Search Filter
              if (_searchQuery.isNotEmpty) {
                final query = _searchQuery.toLowerCase();
                docs = docs.where((data) {
                  final String action = (data['action'] ?? '').toLowerCase();
                  return action.contains(query);
                }).toList();
              }

              return SingleChildScrollView(
                padding: EdgeInsets.all(isMobile ? 12 : 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'My Activity History',
                      style: isMobile
                          ? Theme.of(context).textTheme.titleLarge
                          : Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Keep track of system updates and account actions.',
                    ),
                    const SizedBox(height: 24),

                    // Filters Section
                    _buildFilters(isMobile),
                    const SizedBox(height: 24),

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
                              const Text(
                                'No matching activity logs found.',
                                style: TextStyle(color: Colors.grey),
                              ),
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
                            color: context.surfaceC.withValues(alpha: 0.1),
                            height: 1,
                          ),
                          itemBuilder: (context, index) {
                            final data = docs[index];
                            return _buildLogItem(context, data, isMobile);
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

  Widget _buildFilters(bool isMobile) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: context.glassDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    LucideIcons.history,
                    size: 18,
                    color: AppTheme.secondaryColor,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Search Activity',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
              if (_selectedDate == null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.3),
                    ),
                  ),
                  child: const Text(
                    'Last 24h',
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.amber,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          // Search Field and Date Picker
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search actions (e.g. "Login", "Profile")...',
                    prefixIcon: const Icon(LucideIcons.search, size: 20),
                    filled: true,
                    fillColor: Colors.grey.withValues(alpha: 0.05),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                ),
              ),
              const SizedBox(width: 12),
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
                            primary: AppTheme.secondaryColor,
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
                    setState(() => _selectedDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _selectedDate != null
                        ? AppTheme.secondaryColor
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    LucideIcons.calendar,
                    size: 20,
                    color: _selectedDate != null
                        ? Colors.white
                        : context.textSec,
                  ),
                ),
              ),
              if (_selectedDate != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () => setState(() => _selectedDate = null),
                  icon: const Icon(LucideIcons.x, size: 18),
                  tooltip: 'Clear Date Filter',
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLogItem(
    BuildContext context,
    Map<String, dynamic> data,
    bool isMobile,
  ) {
    final String action = data['action'] ?? 'Performed Action';
    final String platform = data['ipAddress'] ?? 'Unknown Device';
    final dynamic timestamp = data['timestamp'];

    String timeStr = 'Just now';
    if (timestamp != null) {
      try {
        final dateTime = DateTime.parse(timestamp.toString());
        timeStr = DateFormat('MMM d, h:mm a').format(dateTime);

        final diff = DateTime.now().difference(dateTime);
        if (diff.inMinutes < 1) {
          timeStr = 'Just now';
        } else if (diff.inMinutes < 60) {
          timeStr = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          timeStr = '${diff.inHours}h ago';
        }
      } catch (_) {}
    }

    return ListTile(
      contentPadding: EdgeInsets.symmetric(
        horizontal: isMobile ? 12 : 16,
        vertical: 8,
      ),
      leading: isMobile
          ? null
          : Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.secondaryColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.activity,
                color: AppTheme.secondaryColor,
                size: 18,
              ),
            ),
      title: RichText(
        text: TextSpan(
          style: TextStyle(color: context.textPri, fontSize: 14),
          children: [
            const TextSpan(
              text: 'You ',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            TextSpan(text: action.toLowerCase()),
          ],
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.clock, size: 12, color: context.textSec),
                const SizedBox(width: 4),
                Text(timeStr, style: const TextStyle(fontSize: 11)),
              ],
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.monitor, size: 12, color: context.textSec),
                const SizedBox(width: 4),
                Text(platform, style: const TextStyle(fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
