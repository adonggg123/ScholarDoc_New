import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
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
                if (status == 'Approved' || status == 'Verified') {
                  statusColor = AppTheme.success;
                } else if (status == 'Rejected' || status == 'Missing') {
                  statusColor = AppTheme.error;
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

                    return Column(
                      children: [
                        _buildHeader(
                          context,
                          scholarshipName,
                          status,
                          data['requiresResubmission'] == true,
                          saVerificationStatus,
                          idValidationStatus,
                        ),
                        Expanded(
                          child: CustomScrollView(
                            physics: const BouncingScrollPhysics(),
                            slivers: [
                              // --- Content Body ---
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      // 1. Main Status Indicator Card
                                      _buildMainStatusCard(context, status, data['requiresResubmission'] == true, submittedDate),
                                      const SizedBox(height: 24),

                                      // 2. Official Remarks (Alert Box) if present
                                      if (remarks != null && remarks.isNotEmpty) ...[
                                        _buildRemarksCard(remarks, statusColor),
                                        const SizedBox(height: 24),
                                      ],

                                      // 3. Checklist Progress Summary
                                      _buildProgressCard(progressValue, progressLabel, statusColor),
                                      const SizedBox(height: 32),

                                      // 4. Vertical Process Timeline Component
                                      _buildVerticalTimeline(
                                        context: context,
                                        saStatus: saVerificationStatus,
                                        idStatus: idValidationStatus,
                                        overallStatus: status,
                                        requiresResubmission: data['requiresResubmission'] == true,
                                      ),
                                      const SizedBox(height: 32),

                                      // 5. Action Resubmit Button
                                      if (data['requiresResubmission'] == true || saVerificationStatus == 'Missing' || idValidationStatus == 'Missing') ...[
                                        _buildResubmitButton(context),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ],
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

  Widget _buildHeader(
    BuildContext context,
    String scholarshipName,
    String status,
    bool requiresResubmission,
    String saStatus,
    String idStatus,
  ) {
    final topPadding = MediaQuery.of(context).padding.top;
    final canPop = Navigator.canPop(context);

    IconData headerIcon = LucideIcons.clock;
    if (status == 'Approved' || status == 'Verified') {
      headerIcon = LucideIcons.shieldCheck;
    } else if (status == 'Rejected') {
      headerIcon = LucideIcons.xCircle;
    } else if (requiresResubmission || saStatus == 'Missing' || idStatus == 'Missing') {
      headerIcon = LucideIcons.alertTriangle;
    }

    return Container(
      padding: EdgeInsets.fromLTRB(16, topPadding + 10, 24, 24),
      decoration: const BoxDecoration(
        color: AppTheme.primaryColor,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        border: Border(
          bottom: BorderSide(
            color: Color(0xFFFBC02D), // Golden Yellow Bottom Accent Line
            width: 3.0,
          ),
        ),
      ),
      child: Row(
        children: [
          if (canPop)
            IconButton(
              icon: const Icon(
                LucideIcons.chevronLeft,
                color: Colors.white,
                size: 24,
              ),
              onPressed: () => Navigator.pop(context),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Verification Status',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  scholarshipName,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.7),
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              headerIcon,
              color: Colors.white,
              size: 20,
            ),
          ),
        ],
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
            const SizedBox(height: 20),
            Text(
              'Syncing application status...',
              style: TextStyle(color: context.textSec, fontWeight: FontWeight.w600, fontSize: 14),
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
        child: Padding(
          padding: const EdgeInsets.all(32),
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
                  size: 56,
                  color: Color(0xFF0F3260),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Submission History',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(
                'Complete and submit your scholarship checklist to initialize review.',
                style: TextStyle(color: context.textSec, fontWeight: FontWeight.w500, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMainStatusCard(BuildContext context, String status, bool requiresResubmission, String submittedDate) {
    Color cardColor;
    Gradient cardGradient;
    IconData icon;
    String statusTitle;
    String statusSubtitle;
    Color iconBgColor;

    if (status == 'Approved' || status == 'Verified') {
      cardColor = const Color(0xFF10B981);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF059669), Color(0xFF10B981)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.shieldCheck;
      statusTitle = 'Application Approved';
      statusSubtitle = 'Congratulations! Your scholarship application is verified and approved by the administrator.';
      iconBgColor = Colors.white24;
    } else if (requiresResubmission) {
      cardColor = const Color(0xFFD97706);
      cardGradient = const LinearGradient(
        colors: [Color(0xFFB45309), Color(0xFFD97706)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.alertTriangle;
      statusTitle = 'Action Required';
      statusSubtitle = 'One or more of your documents require revision. Please resubmit the missing details below.';
      iconBgColor = Colors.white24;
    } else if (status == 'Rejected') {
      cardColor = const Color(0xFFDC2626);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF991B1B), Color(0xFFDC2626)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.xCircle;
      statusTitle = 'Submission Denied';
      statusSubtitle = 'Your application was rejected. Review the remarks below or contact the scholarship desk.';
      iconBgColor = Colors.white24;
    } else {
      cardColor = const Color(0xFF3B82F6);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF1D4ED8), Color(0xFF3B82F6)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.clock;
      statusTitle = 'Under Evaluation';
      statusSubtitle = 'Your credentials are currently in the review queue. We will notify you once verification completes.';
      iconBgColor = Colors.white24;
    }

    return Container(
      decoration: BoxDecoration(
        gradient: cardGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: cardColor.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            bottom: -20,
            child: Icon(
              icon,
              size: 150,
              color: Colors.white10,
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: iconBgColor,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        icon,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            statusTitle,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Submitted on $submittedDate',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.7),
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  statusSubtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 13,
                    height: 1.4,
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

  Widget _buildRemarksCard(String remarks, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.messageCircle, color: color, size: 20),
              const SizedBox(width: 10),
              Text(
                'OFFICIAL REMARKS',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  color: color,
                  fontSize: 11,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            remarks,
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: context.textPri,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
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
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(context.isDark ? 0.2 : 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Requirements Progress',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: context.textPri,
                ),
              ),
              Text(
                '${(progress * 100).toInt()}%',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                  color: statusColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            progressLabel,
            style: TextStyle(
              fontSize: 12,
              color: context.textSec,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: context.isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalTimeline({
    required BuildContext context,
    required String saStatus,
    required String idStatus,
    required String overallStatus,
    required bool requiresResubmission,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: context.crispBorder, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Verification Timeline',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: context.textPri,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 24),
          
          // Step 1: Account Registration
          _buildTimelineNode(
            context: context,
            title: 'Account Registration',
            subtitle: 'Profile created and masterlist verified successfully.',
            state: 'verified',
            isLast: false,
          ),

          // Step 2: SA Number Verification
          _buildTimelineNode(
            context: context,
            title: 'SA Number Verification',
            subtitle: _getTimelineSubtitle('sa', saStatus),
            state: _getTimelineNodeState(saStatus),
            isLast: false,
            onTap: () => _navigateToUpload(context),
          ),

          // Step 3: ID Validation
          _buildTimelineNode(
            context: context,
            title: 'ID & Signature Validation',
            subtitle: _getTimelineSubtitle('id', idStatus),
            state: _getTimelineNodeState(idStatus),
            isLast: false,
            onTap: () => _navigateToUpload(context),
          ),

          // Step 4: Final Board Approval
          _buildTimelineNode(
            context: context,
            title: 'Final Scholarship Board Approval',
            subtitle: _getTimelineSubtitle('overall', overallStatus),
            state: (overallStatus == 'Approved' || overallStatus == 'Verified') ? 'verified' : (overallStatus == 'Rejected' ? 'missing' : 'pending'),
            isLast: true,
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineNode({
    required BuildContext context,
    required String title,
    required String subtitle,
    required String state, // 'verified', 'missing', or 'pending'
    required bool isLast,
    VoidCallback? onTap,
  }) {
    Color iconColor;
    Color nodeBg;
    IconData icon;
    Color lineColor;

    if (state == 'verified') {
      iconColor = const Color(0xFF10B981);
      nodeBg = const Color(0xFF10B981).withOpacity(0.08);
      icon = LucideIcons.check;
      lineColor = const Color(0xFF10B981);
    } else if (state == 'missing') {
      iconColor = const Color(0xFFEF4444);
      nodeBg = const Color(0xFFEF4444).withOpacity(0.08);
      icon = LucideIcons.alertTriangle;
      lineColor = const Color(0xFFEF4444);
    } else {
      iconColor = const Color(0xFF3B82F6);
      nodeBg = const Color(0xFF3B82F6).withOpacity(0.08);
      icon = LucideIcons.clock;
      lineColor = context.isDark ? const Color(0xFF334155) : Colors.grey.shade300;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Graphic node structure
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: nodeBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: iconColor, width: 2),
                ),
                child: Center(
                  child: Icon(icon, color: iconColor, size: 14),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: lineColor,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          // Description details
          Expanded(
            child: InkWell(
              onTap: state != 'verified' ? onTap : null,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: state == 'pending' ? context.textPri.withOpacity(0.6) : context.textPri,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.textSec,
                        height: 1.4,
                      ),
                    ),
                    if (state != 'verified' && onTap != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Text(
                            state == 'missing' ? 'Resolve Now' : 'Tap to upload',
                            style: TextStyle(
                              fontSize: 11,
                              color: iconColor,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(LucideIcons.chevronRight, size: 12, color: iconColor),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getTimelineNodeState(String subStatus) {
    if (subStatus == 'Verified' || subStatus == 'Approved') {
      return 'verified';
    } else if (subStatus == 'Missing' || subStatus == 'Rejected') {
      return 'missing';
    }
    return 'pending';
  }

  String _getTimelineSubtitle(String type, String status) {
    if (type == 'sa') {
      if (status == 'Verified' || status == 'Approved') {
        return 'SA Number verified and matching official records.';
      } else if (status == 'Missing' || status == 'Rejected') {
        return 'Requires attention: SA Number rejected or missing.';
      }
      return 'SA Number submitted and awaiting evaluation.';
    } else if (type == 'id') {
      if (status == 'Verified' || status == 'Approved') {
        return 'ID verification PDF is successfully validated.';
      } else if (status == 'Missing' || status == 'Rejected') {
        return 'Requires attention: PDF is missing or signatures are unreadable.';
      }
      return 'ID capture images submitted and awaiting review.';
    } else {
      if (status == 'Approved' || status == 'Verified') {
        return 'All verifications resolved. Scholarship activated.';
      } else if (status == 'Rejected') {
        return 'Scholarship application denied. Remarks provided.';
      }
      return 'Awaiting SA and ID validation completions.';
    }
  }

  void _navigateToUpload(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()),
    );
  }

  Widget _buildResubmitButton(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: () => _navigateToUpload(context),
        icon: const Icon(LucideIcons.refreshCw, color: Colors.white, size: 18),
        label: const Text(
          'RESUBMIT DOCUMENTS',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  /// Keep helper matching original signatures
  String _getRequirementState(String requirement, String saVerificationStatus, String idValidationStatus) {
    final r = requirement.toLowerCase();
    if (r.contains('sa number')) {
      if (saVerificationStatus == 'Verified' || saVerificationStatus == 'Approved') {
        return 'verified';
      } else if (saVerificationStatus == 'Missing' || saVerificationStatus == 'Rejected') {
        return 'missing';
      }
      return 'pending';
    }
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

  bool _isRequirementVerified(String requirement, String saVerificationStatus, String idValidationStatus) {
    return _getRequirementState(requirement, saVerificationStatus, idValidationStatus) == 'verified';
  }
}
