import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
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
      backgroundColor: context.bgC,
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
                    requirements =
                        requirements.expand((doc) {
                          if (doc == 'Enrollment Form' || doc == 'ID Card') {
                            return ['ID (Front)', 'ID (Back)', 'Combined PDF Submission'];
                          }
                          return [doc];
                        }).toSet().toList();

                    final Map<String, dynamic> docs = (data['documents'] is Map) ? Map<String, dynamic>.from(data['documents']) : {};
                    final String saVerificationStatus = docs['saVerificationStatus']?.toString() ?? 'Pending';
                    final String idValidationStatus = docs['idValidationStatus']?.toString() ?? 'Pending';

                    // Calculate requirement verification progress
                    int verifiedCount = 0;
                    for (var req in requirements) {
                      if (_isRequirementVerified(req, saVerificationStatus, idValidationStatus)) {
                        verifiedCount++;
                      }
                    }
                    double progressValue = requirements.isNotEmpty ? (verifiedCount / requirements.length) : 0.0;

                    String progressLabel = 'Awaiting Review ($verifiedCount of ${requirements.length} verified)';
                    if (verifiedCount == requirements.length && requirements.isNotEmpty) {
                      progressValue = 1.0;
                      progressLabel = 'All requirements complete';
                    } else if (saVerificationStatus == 'Missing' || saVerificationStatus == 'Rejected' || idValidationStatus == 'Missing' || idValidationStatus == 'Rejected' || data['requiresResubmission'] == true) {
                      progressLabel = 'Resubmission Required ($verifiedCount of ${requirements.length} verified)';
                    }

                    return CustomScrollView(
                      physics: const BouncingScrollPhysics(),
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
                                gradient: LinearGradient(
                                  colors: [Color(0xFF0F3260), Color(0xFF1E3A8A)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.vertical(
                                  bottom: Radius.circular(32),
                                ),
                              ),
                              child: SafeArea(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'My Submissions',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 22,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: -0.5,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(12),
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
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: statusColor.withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(
                                            color: statusColor.withOpacity(0.3),
                                            width: 1,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              statusIcon,
                                              color: statusColor,
                                              size: 13,
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              statusLabel.toUpperCase(),
                                              style: TextStyle(
                                                color: statusColor,
                                                fontWeight: FontWeight.w800,
                                                fontSize: 10,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        scholarshipName,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 19,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: -0.3,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Submitted on $submittedDate',
                                        style: TextStyle(
                                          color: Colors.white.withOpacity(0.65),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
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
                                _buildProgressCard(progressValue, progressLabel, statusColor),
                                const SizedBox(height: 28),
                                // Section header
                                Row(
                                  children: [
                                    Container(
                                      width: 4,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        color: AppTheme.accentColor, // Golden Yellow
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    const Text(
                                      'Document Checklist',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 18,
                                        color: Color(0xFF0F3260),
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                ...requirements.asMap().entries.map(
                                  (e) => _buildRequirementItem(
                                    context,
                                    e.value,
                                    _getRequirementState(e.value, saVerificationStatus, idValidationStatus),
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
      backgroundColor: context.bgC,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFF0F3260)),
            const SizedBox(height: 16),
            Text(
              'Loading your submission status...',
              style: TextStyle(color: context.textSec, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Scaffold(
      backgroundColor: context.bgC,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F3260).withOpacity(0.06),
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
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Submit your documents to get started.',
              style: TextStyle(color: context.textSec, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressCard(double progress, String progressLabel, Color statusColor) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.crispBorder, width: 1.5),
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
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              Text(
                '${(progress * 100).toInt()}%',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
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
              minHeight: 8,
              backgroundColor: context.bgC,
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
        color: color.withOpacity(0.06),
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
                    fontWeight: FontWeight.w900,
                    color: color,
                    fontSize: 13,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  remarks,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: context.textPri,
                    fontWeight: FontWeight.w500,
                  ),
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
    String state, // 'verified', 'missing', or 'pending'
    int index,
  ) {
    final bool isVerified = state == 'verified';
    final bool isMissing = state == 'missing';

    // Determine colors based on state
    Color borderColor;
    Color iconBgColor;
    Color iconColor;
    IconData iconData;
    Color titleColor;
    String subtitle;
    Color subtitleColor;

    if (isVerified) {
      borderColor = AppTheme.success.withOpacity(0.2);
      iconBgColor = AppTheme.success.withOpacity(0.08);
      iconColor = AppTheme.success;
      iconData = LucideIcons.checkCircle2;
      titleColor = AppTheme.success;
      subtitle = '✓ Verified & Accepted';
      subtitleColor = AppTheme.success.withOpacity(0.7);
    } else if (isMissing) {
      borderColor = AppTheme.error.withOpacity(0.2);
      iconBgColor = AppTheme.error.withOpacity(0.08);
      iconColor = AppTheme.error;
      iconData = LucideIcons.alertCircle;
      titleColor = AppTheme.error;
      subtitle = '⚠ Missing — Tap to resubmit';
      subtitleColor = AppTheme.error.withOpacity(0.7);
    } else {
      borderColor = context.crispBorder;
      iconBgColor = const Color(0xFF0F3260).withOpacity(0.05);
      iconColor = const Color(0xFF0F3260);
      iconData = LucideIcons.fileText;
      titleColor = const Color(0xFF0F3260);
      subtitle = 'Tap to upload';
      subtitleColor = context.textSec.withOpacity(0.7);
    }

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
          color: context.surfaceC,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: borderColor,
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
                    color: iconBgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    iconData,
                    color: iconColor,
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
                          fontWeight: FontWeight.w700,
                          color: titleColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: subtitleColor,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isVerified)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.success.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.success,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  )
                else if (isMissing)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.refreshCw,
                      size: 16,
                      color: AppTheme.error,
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.accentColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      LucideIcons.chevronRight,
                      size: 16,
                      color: Color(0xFF0F3260),
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
          colors: [Color(0xFFFBC02D), Color(0xFFF5A623)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppTheme.accentColor.withOpacity(0.3),
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
            fontWeight: FontWeight.w900,
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

  /// Returns 'verified', 'missing', or 'pending' based on admin actions.
  /// SA Number checks saVerificationStatus; ID documents check idValidationStatus.
  String _getRequirementState(String requirement, String saVerificationStatus, String idValidationStatus) {
    final r = requirement.toLowerCase();
    
    // SA Number → check saVerificationStatus
    if (r.contains('sa number')) {
      if (saVerificationStatus == 'Verified' || saVerificationStatus == 'Approved') {
        return 'verified';
      } else if (saVerificationStatus == 'Missing' || saVerificationStatus == 'Rejected') {
        return 'missing';
      }
      return 'pending';
    }
    
    // ID documents → check idValidationStatus
    if (r.contains('id') || r.contains('pdf') || r.contains('signature')) {
      if (idValidationStatus == 'Verified' || idValidationStatus == 'Approved') {
        return 'verified';
      } else if (idValidationStatus == 'Missing' || idValidationStatus == 'Rejected') {
        return 'missing';
      }
      return 'pending';
    }
    
    return 'pending';
  }

  /// Helper used by progress calculation.
  bool _isRequirementVerified(String requirement, String saVerificationStatus, String idValidationStatus) {
    return _getRequirementState(requirement, saVerificationStatus, idValidationStatus) == 'verified';
  }
}
