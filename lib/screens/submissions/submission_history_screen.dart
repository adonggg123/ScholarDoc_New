// lib/screens/submissions/submission_history_screen.dart
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import 'package:intl/intl.dart';

class SubmissionHistoryScreen extends StatefulWidget {
  const SubmissionHistoryScreen({super.key});

  @override
  State<SubmissionHistoryScreen> createState() => _SubmissionHistoryScreenState();
}

class _SubmissionHistoryScreenState extends State<SubmissionHistoryScreen> {
  final AuthService _authService = AuthService();
  Map<String, dynamic>? _profileData;
  bool _isLoadingProfile = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (mounted) {
        setState(() {
          _profileData = doc;
          _isLoadingProfile = false;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _isLoadingProfile = false;
        });
      }
    }
  }

  Widget _buildSubmissionItem(BuildContext context, Map<String, String> item) {
    final type = item['type']!;
    final fileName = item['fileName']!;
    final date = item['date']!;
    final status = item['status']!;

    Color statusColor = const Color(0xFFF59E0B);
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = const Color(0xFF10B981);
      statusIcon = LucideIcons.badgeCheck;
    } else if (status == 'Rejected' || status == 'Needs Correction') {
      statusColor = const Color(0xFFEF4444);
      statusIcon = LucideIcons.alertTriangle;
    }

    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              type.contains('ID') ? LucideIcons.fileText : LucideIcons.creditCard,
              color: AppTheme.primaryColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: Color(0xFF0F3260),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  fileName,
                  style: TextStyle(
                    fontSize: 12,
                    color: context.textSec,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(LucideIcons.calendar, size: 12, color: context.textSec.withValues(alpha: 0.7)),
                    const SizedBox(width: 4),
                    Text(
                      date,
                      style: TextStyle(
                        fontSize: 11,
                        color: context.textSec.withValues(alpha: 0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 10, color: statusColor),
                const SizedBox(width: 4),
                Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = _authService.currentUser;
    if (currentUser == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Submission History', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: AppTheme.primaryColor,
          foregroundColor: Colors.white,
        ),
        body: const Center(child: Text('Please log in.')),
      );
    }

    if (_isLoadingProfile) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Submission History', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: AppTheme.primaryColor,
          foregroundColor: Colors.white,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final List<Map<String, String>> submissions = [];
    if (_profileData != null && _profileData!['submittedAt'] != null) {
      final String submittedAt = (() {
        final ts = _profileData!['submittedAt'];
        if (ts != null) {
          try {
            final parsed = DateTime.parse(ts.toString());
            return DateFormat('MMM d, y – h:mm a').format(parsed);
          } catch (_) {}
        }
        return 'N/A';
      })();

      final String status = _profileData!['status'] ?? 'Pending';

      if (_profileData!['submissionPdfName'] != null) {
        submissions.add({
          'type': 'ID Capture & Digital Signature',
          'fileName': _profileData!['submissionPdfName'].toString(),
          'date': submittedAt,
          'status': status,
        });
      }

      final atmCardFileName = _profileData!['atmCardFileName'] ?? 
                              (_profileData!['documents'] is Map ? _profileData!['documents']['atmCardFileName'] : null);
      if (atmCardFileName != null) {
        submissions.add({
          'type': 'ATM Card Proof',
          'fileName': atmCardFileName.toString(),
          'date': submittedAt,
          'status': status,
        });
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submission History', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      backgroundColor: context.bgC,
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: _authService.getAuditLogsStream(),
        builder: (context, snapshot) {
          List<Map<String, dynamic>> logs = [];
          if (snapshot.hasData) {
            logs = snapshot.data!.where((data) {
              final String studentId = data['studentId'] ?? '';
              final String action = (data['action'] ?? '').toString().toLowerCase();
              final bool isSubmission = action.contains('upload') ||
                  action.contains('submit') ||
                  action.contains('document') ||
                  action.contains('submission');
              return studentId == currentUser.id && isSubmission;
            }).toList();
          }

          return CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Submitted Requirements',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F3260),
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (submissions.isEmpty)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: context.surfaceC,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: context.crispBorder),
                          ),
                          child: Center(
                            child: Text(
                              'No active submissions found.',
                              style: TextStyle(color: context.textSec),
                            ),
                          ),
                        )
                      else
                        ...submissions.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: _buildSubmissionItem(context, item),
                            )),
                      const SizedBox(height: 24),
                      const Text(
                        'Submission Activity Logs',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F3260),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting && logs.isEmpty)
                const SliverToBoxAdapter(
                  child: Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
                )
              else if (logs.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: context.surfaceC,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: context.crispBorder),
                      ),
                      child: Center(
                        child: Text(
                          'No recent activity logs.',
                          style: TextStyle(color: context.textSec),
                        ),
                      ),
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final data = logs[index];
                      final String action = data['action'] ?? '';
                      final String device = data['ipAddress'] ?? 'Unknown';
                      final dynamic ts = data['timestamp'];
                      String timeLabel = '';
                      if (ts != null) {
                        try {
                          final date = DateTime.parse(ts.toString());
                          final diff = DateTime.now().difference(date);
                          if (diff.inMinutes < 1) timeLabel = 'Just now';
                          else if (diff.inMinutes < 60) timeLabel = '${diff.inMinutes}m ago';
                          else if (diff.inHours < 24) timeLabel = '${diff.inHours}h ago';
                          else timeLabel = DateFormat('MMM d, y – h:mm a').format(date);
                        } catch (_) {}
                      }
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                        child: Container(
                          decoration: BoxDecoration(
                            color: context.surfaceC,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: context.crispBorder),
                          ),
                          child: ListTile(
                            leading: const Icon(LucideIcons.history, size: 20, color: AppTheme.primaryColor),
                            title: Text(action, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            subtitle: Row(
                              children: [
                                Icon(LucideIcons.clock, size: 12, color: context.textSec),
                                const SizedBox(width: 4),
                                Text(timeLabel, style: const TextStyle(fontSize: 10)),
                                const SizedBox(width: 12),
                                Icon(LucideIcons.monitor, size: 12, color: context.textSec),
                                const SizedBox(width: 4),
                                Text(device, style: const TextStyle(fontSize: 10)),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: logs.length,
                  ),
                ),
              const SliverPadding(padding: EdgeInsets.only(bottom: 40)),
            ],
          );
        },
      ),
    );
  }
}
