import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';

import '../../services/auth_service.dart';
import '../../services/scholarship_service.dart';
import 'upload_workflow_screen.dart';

class StatusTrackingScreen extends StatefulWidget {
  const StatusTrackingScreen({super.key});

  @override
  State<StatusTrackingScreen> createState() => _StatusTrackingScreenState();
}

class _StatusTrackingScreenState extends State<StatusTrackingScreen>
    with SingleTickerProviderStateMixin {
  final AuthService _authService = AuthService();
  final ScholarshipService _scholarshipService = ScholarshipService();
  Stream<List<Map<String, dynamic>>>? _studentStream;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    final user = _authService.currentUser;
    if (user != null) {
      _studentStream = _authService.getStudentStream(user.id);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;
    if (user == null) {
      return const Scaffold(body: Center(child: Text('User not logged in')));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: _studentStream == null
          ? const Center(child: Text('Connecting to service...'))
          : StreamBuilder<List<Map<String, dynamic>>>(
              stream: _studentStream,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return _buildLoadingState();
                }
                if (snapshot.hasError ||
                    !snapshot.hasData ||
                    snapshot.data!.isEmpty) {
                  return _buildEmptyState();
                }

                final data = snapshot.data!.first;
                final String status = data['status'] ?? 'Pending';
                var submittedDate = 'N/A';
                if (data['createdAt'] != null) {
                  try {
                    final ts = DateTime.parse(data['createdAt'].toString());
                    submittedDate = DateFormat('MMM d, yyyy').format(ts);
                  } catch (_) {}
                }
                final String? remarks = data['adminRemarks'];
                final String scholarshipId = data['scholarshipId'] ?? '';
                final String scholarshipName =
                    data['scholarshipName'] ?? 'No Scholarship Assigned';

                Color statusColor = AppTheme.warning;
                IconData statusIcon = LucideIcons.clock;
                String statusLabel = 'Under Review';
                if (status == 'Approved' || status == 'Verified') {
                  statusColor = AppTheme.success;
                  statusIcon = LucideIcons.checkCircle2;
                  statusLabel = status;
                } else if (status == 'Rejected' || status == 'Missing') {
                  statusColor = AppTheme.error;
                  statusIcon = LucideIcons.xCircle;
                  statusLabel = status;
                }

                return FutureBuilder<Scholarship?>(
                  future: scholarshipId.isNotEmpty
                      ? _scholarshipService.getScholarshipById(scholarshipId)
                      : Future.value(null),
                  builder: (context, scholarshipSnapshot) {
                    List<String> requirements =
                        scholarshipSnapshot.data?.requiredDocuments ??
                        [
                          'SA Number',
                          'ID (Front)',
                          'ID (Back)',
                          'Combined PDF Submission',
                        ];

                    // --- Label Auto-Remapping Logic ---
                    // Automatically replace 'Enrollment Form' and 'ID Card' with modern requirements
                    requirements =
                        requirements.expand((doc) {
                          if (doc == 'Enrollment Form' || doc == 'ID Card') {
                            // If we find either legacy doc, check if we've already added the new ones
                            // We replace them with the requested bundle if they exist
                            return ['ID (Front)', 'ID (Back)', 'Combined PDF Submission'];
                          }
                          return [doc];
                        }).toSet().toList(); // Use Set to avoid duplicates if both were present

                    return CustomScrollView(
                      slivers: [
                        // --- Header ---
                        SliverAppBar(
                          expandedHeight: 180,
                          pinned: true,
                          backgroundColor: AppTheme.primaryColor,
                          elevation: 0,
                          automaticallyImplyLeading: false,
                          shape: const RoundedRectangleBorder(
                            borderRadius: BorderRadius.vertical(
                              bottom: Radius.circular(32),
                            ),
                          ),
                          flexibleSpace: FlexibleSpaceBar(
                            background: Container(
                              decoration: const BoxDecoration(
                                color: AppTheme.primaryColor,
                                borderRadius: BorderRadius.vertical(
                                  bottom: Radius.circular(32),
                                ),
                              ),
                              child: SafeArea(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    24,
                                    12,
                                    24,
                                    24,
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'My Submissions',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 22,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(
                                                alpha: 0.12,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: const Icon(
                                              LucideIcons.filter,
                                              color: Colors.white,
                                              size: 18,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const Spacer(),
                                      // Status chip
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 14,
                                          vertical: 8,
                                        ),
                                        decoration: BoxDecoration(
                                          color: statusColor.withValues(
                                            alpha: 0.18,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
                                          border: Border.all(
                                            color: statusColor.withValues(
                                              alpha: 0.4,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              statusIcon,
                                              color: statusColor,
                                              size: 14,
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              statusLabel,
                                              style: TextStyle(
                                                color: statusColor,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        scholarshipName,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 18,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Submitted on $submittedDate',
                                        style: TextStyle(
                                          color: Colors.white.withValues(
                                            alpha: 0.65,
                                          ),
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Remarks card (if any)
                                if (remarks != null && remarks.isNotEmpty) ...[
                                  _buildRemarksCard(remarks, statusColor),
                                  const SizedBox(height: 20),
                                ],
                                // Progress bar
                                _buildProgressCard(status, statusColor),
                                const SizedBox(height: 24),
                                // Section header
                                Row(
                                  children: [
                                    Container(
                                      width: 4,
                                      height: 22,
                                      decoration: BoxDecoration(
                                        color: AppTheme.accentColor,
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    const Text(
                                      'Document Checklist',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 18,
                                        color: Color(0xFF0F3260),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                ...requirements.asMap().entries.map(
                                  (e) => _buildRequirementItem(
                                    context,
                                    e.value,
                                    status == 'Approved' || status == 'Verified',
                                    e.key,
                                  ),
                                ),
                                if (data['requiresResubmission'] == true) ...[
                                  const SizedBox(height: 24),
                                  _buildResubmitButton(context),
                                ],
                                const SizedBox(height: 100),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
    );
  }

  Widget _buildLoadingState() {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFF0F3260)),
            const SizedBox(height: 16),
            Text(
              'Loading your submission status...',
              style: TextStyle(color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F3260).withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.fileX,
                size: 48,
                color: Color(0xFF0F3260),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No submission data found.',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Submit your documents to get started.',
              style: TextStyle(color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressCard(String status, Color statusColor) {
    double progress = 0.25;
    String progressLabel = 'Submitted — Awaiting Review';
    if (status == 'Approved' || status == 'Verified') {
      progress = 1.0;
      progressLabel = 'All requirements complete';
    } else if (status == 'Rejected' || status == 'Missing') {
      progress = 0.5;
      progressLabel = 'Resubmission Required';
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                progressLabel,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              Text(
                '${(progress * 100).toInt()}%',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: statusColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: Colors.grey.shade100,
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRemarksCard(String remarks, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(18),
        border: Border(left: BorderSide(color: color, width: 4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.messageCircle, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Official Remarks',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: color,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  remarks,
                  style: const TextStyle(fontSize: 13, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequirementItem(
    BuildContext context,
    String title,
    bool isVerified,
    int index,
  ) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 400 + index * 80),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isVerified
                ? AppTheme.success.withValues(alpha: 0.25)
                : Colors.grey.shade200,
            width: 1.5,
          ),
          boxShadow: AppTheme.softShadow,
        ),
        child: InkWell(
          onTap: isVerified
              ? null
              : () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const UploadWorkflowScreen(),
                  ),
                ),
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isVerified
                        ? AppTheme.success.withValues(alpha: 0.1)
                        : const Color(0xFF0F3260).withValues(alpha: 0.06),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isVerified
                        ? LucideIcons.checkCircle2
                        : LucideIcons.fileText,
                    color: isVerified
                        ? AppTheme.success
                        : const Color(0xFF0F3260),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isVerified
                              ? AppTheme.success
                              : const Color(0xFF0F3260),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isVerified ? '✓ Verified & Accepted' : 'Tap to upload',
                        style: TextStyle(
                          fontSize: 12,
                          color: isVerified
                              ? AppTheme.success.withValues(alpha: 0.8)
                              : Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isVerified)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.accentColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      LucideIcons.chevronRight,
                      size: 16,
                      color: Color(0xFF0F3260),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.success,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildResubmitButton(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFBC02D), Color(0xFFF9A825)],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppTheme.accentColor.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()),
        ),
        icon: const Icon(LucideIcons.uploadCloud, color: Color(0xFF0F3260)),
        label: const Text(
          'Action Required: Resubmit Documents',
          style: TextStyle(
            color: Color(0xFF0F3260),
            fontWeight: FontWeight.bold,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
    );
  }
}
