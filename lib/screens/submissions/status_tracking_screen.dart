import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import 'upload_workflow_screen.dart';
import 'submission_history_screen.dart';

class StatusTrackingScreen extends StatefulWidget {
  const StatusTrackingScreen({super.key});

  @override
  State<StatusTrackingScreen> createState() => _StatusTrackingScreenState();
}

class _StatusTrackingScreenState extends State<StatusTrackingScreen>
    with SingleTickerProviderStateMixin {
  final AuthService _authService = AuthService();

  Map<String, dynamic>? _studentData;
  bool _isLoading = true;
  String? _errorMessage;

  StreamSubscription<List<Map<String, dynamic>>>? _streamSubscription;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    _initDataAndStream();
  }

  @override
  void dispose() {
    _streamSubscription?.cancel();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _initDataAndStream() async {
    final user = _authService.currentUser;
    if (user == null) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'User not logged in';
        });
      }
      return;
    }

    // 1. Initial direct load to guarantee instant rendering
    await _fetchProfile(user.id);

    // 2. Real-time stream subscription for automatic status updates
    try {
      _streamSubscription?.cancel();
      _streamSubscription = _authService.getStudentStream(user.id).listen(
        (list) {
          if (!mounted) return;
          if (list.isNotEmpty) {
            setState(() {
              _studentData = list.first;
              _isLoading = false;
              _errorMessage = null;
            });
          }
        },
        onError: (e) {
          debugPrint('StatusTrackingScreen stream notice: $e');
        },
      );
    } catch (_) {}
  }

  Future<void> _fetchProfile(String uid) async {
    try {
      final doc = await _authService.getStudentProfile(uid);
      if (mounted) {
        setState(() {
          _studentData = doc;
          _isLoading = false;
          _errorMessage = doc == null ? 'No student record found.' : null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load status: $e';
        });
      }
    }
  }

  Future<void> _refresh() async {
    final user = _authService.currentUser;
    if (user != null) {
      await _fetchProfile(user.id);
    }
  }

  String _formatMaskedSa(String sa) {
    final clean = sa.trim();
    if (clean.length <= 4) return clean;
    final lastFour = clean.substring(clean.length - 4);
    return '•••• •••• $lastFour';
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;
    if (user == null) {
      return Scaffold(
        backgroundColor: context.bgC,
        body: const Center(child: Text('User not logged in')),
      );
    }

    return Scaffold(
      backgroundColor: context.bgC,
      body: _isLoading
          ? _buildLoadingState()
          : (_studentData == null && _errorMessage != null
              ? _buildErrorState()
              : RefreshIndicator(
                  color: AppTheme.primaryColor,
                  backgroundColor: context.surfaceC,
                  onRefresh: _refresh,
                  child: _buildBody(context),
                )),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppTheme.primaryColor),
          const SizedBox(height: 20),
          Text(
            'Syncing verification status...',
            style: TextStyle(
              color: context.textSec,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.alertTriangle, size: 48, color: AppTheme.error),
            ),
            const SizedBox(height: 20),
            Text(
              _errorMessage ?? 'Unable to load status',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _refresh,
              icon: const Icon(LucideIcons.refreshCw, size: 16),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final data = _studentData;

    final String status = data?['status'] ?? 'Pending';
    final bool isApproved = status == 'Approved' || status == 'Verified';
    final bool isRejected = status == 'Rejected';
    final bool requiresResubmission = data?['requiresResubmission'] == true;

    final String scholarshipName = data?['scholarshipName'] ??
        data?['scholarship_name'] ??
        'TES Scholarship Program';

    final String? remarks = (data?['adminRemarks'] ?? data?['admin_remarks'])?.toString().trim();

    var submittedDate = 'N/A';
    final dateVal = data?['submittedAt'] ?? data?['submitted_at'] ?? data?['createdAt'] ?? data?['created_at'];
    if (dateVal != null) {
      try {
        final ts = DateTime.parse(dateVal.toString());
        submittedDate = DateFormat('MMM d, yyyy').format(ts);
      } catch (_) {}
    }

    // Documents & verification details
    Map<String, dynamic> docs = {};
    if (data != null && data['documents'] is Map) {
      docs = Map<String, dynamic>.from(data['documents']);
    } else if (data != null && data['documents'] is String && (data['documents'] as String).trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(data['documents'] as String);
        if (decoded is Map) docs = Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }

    final String saVerificationStatus = (docs['saVerificationStatus'] ??
            docs['sa_verification_status'] ??
            data?['saVerificationStatus'] ??
            data?['sa_verification_status'] ??
            (isApproved ? 'Verified' : 'Pending'))
        .toString();

    final String idValidationStatus = (docs['idValidationStatus'] ??
            docs['id_validation_status'] ??
            data?['idValidationStatus'] ??
            data?['id_validation_status'] ??
            (isApproved ? 'Verified' : 'Pending'))
        .toString();

    final bool isSaVerified = saVerificationStatus.toLowerCase() == 'verified' ||
        saVerificationStatus.toLowerCase() == 'approved' ||
        isApproved;

    final bool isIdVerified = idValidationStatus.toLowerCase() == 'verified' ||
        idValidationStatus.toLowerCase() == 'approved' ||
        isApproved;

    // Check presence of individual requirements
    final String? saNum = data?['saNumber'] ?? data?['sa_number'] ?? docs['saNumber'] ?? docs['sa_number'];
    final bool hasSa = saNum != null && saNum.trim().isNotEmpty && saNum.trim().toUpperCase() != 'N/A';

    final String? pdfUrl = data?['submissionPdfUrl'] ?? data?['submission_pdf_url'] ?? docs['submissionPdfUrl'] ?? docs['submission_pdf_url'];
    final bool hasIdPdf = pdfUrl != null && pdfUrl.isNotEmpty;

    final String? atmUrl = data?['atmCardUrl'] ?? data?['atm_card_url'] ?? docs['atmCardUrl'] ?? docs['atm_card_url'];
    final bool hasAtmProof = atmUrl != null && atmUrl.isNotEmpty;
    final String atmProofType = (data?['atmProofType'] ?? docs['atmProofType'] ?? docs['atm_proof_type'] ?? 'ATM Card').toString();

    final bool hasFrontBack = (docs['idFrontUrl'] ?? data?['idFrontUrl']) != null &&
        (docs['idBackUrl'] ?? data?['idBackUrl']) != null;

    final bool hasAnySubmission = hasSa || hasIdPdf || hasAtmProof || hasFrontBack || isApproved;

    // Calculate verification timeline progress (4 stages)
    final bool isBothRequirementsVerified = isSaVerified && isIdVerified;

    int completedStages = 1; // Stage 1 (Account Registration) is always verified
    if (hasAnySubmission) completedStages++;
    if (isSaVerified) completedStages++;
    if (isIdVerified) completedStages++;

    final double progressValue = (isBothRequirementsVerified || isApproved) ? 1.0 : (completedStages / 4.0);
    final String progressLabel = (isBothRequirementsVerified || isApproved)
        ? 'All Requirements Verified (100%)'
        : (requiresResubmission
            ? 'Action Required: Resubmission needed'
            : '$completedStages of 4 verification stages completed');

    Color statusColor = AppTheme.warning;
    if (isBothRequirementsVerified || isApproved) {
      statusColor = AppTheme.success;
    } else if (isRejected || requiresResubmission) {
      statusColor = AppTheme.error;
    }

    final bool needsAction = requiresResubmission ||
        isRejected ||
        !hasAnySubmission ||
        saVerificationStatus.toLowerCase() == 'missing' ||
        saVerificationStatus.toLowerCase() == 'rejected' ||
        idValidationStatus.toLowerCase() == 'missing' ||
        idValidationStatus.toLowerCase() == 'rejected';

    return Column(
      children: [
        _buildHeader(
          context: context,
          scholarshipName: scholarshipName,
          status: status,
          requiresResubmission: requiresResubmission,
          saStatus: saVerificationStatus,
          idStatus: idValidationStatus,
          onRefresh: _refresh,
        ),
        Expanded(
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 1. Main Status Indicator Banner
                      _buildMainStatusCard(
                        context: context,
                        status: status,
                        requiresResubmission: requiresResubmission,
                        submittedDate: submittedDate,
                        hasAnySubmission: hasAnySubmission,
                        saStatus: saVerificationStatus,
                        idStatus: idValidationStatus,
                      ),
                      const SizedBox(height: 24),

                      // 2. Official Remarks (if present)
                      if (remarks != null && remarks.isNotEmpty) ...[
                        _buildRemarksCard(remarks, statusColor),
                        const SizedBox(height: 24),
                      ],

                      // 3. Verification Timeline Progress Summary
                      _buildProgressCard(progressValue, progressLabel, statusColor),
                      const SizedBox(height: 24),

                      // 4. Verification Timeline Component
                      _buildVerticalTimeline(
                        context: context,
                        saStatus: saVerificationStatus,
                        idStatus: idValidationStatus,
                        overallStatus: status,
                        hasSubmission: hasAnySubmission,
                        hasSa: hasSa,
                        saNum: saNum,
                        hasIdPdf: hasIdPdf,
                        hasAtmProof: hasAtmProof,
                        atmProofType: atmProofType,
                        requiresResubmission: requiresResubmission,
                      ),
                      const SizedBox(height: 28),

                      // 5. Action Buttons
                      if (needsAction) ...[
                        _buildActionButton(
                          context,
                          label: !hasAnySubmission ? 'SUBMIT REQUIREMENTS NOW' : 'RESUBMIT / FIX REQUIREMENTS',
                          icon: !hasAnySubmission ? LucideIcons.uploadCloud : LucideIcons.refreshCw,
                          color: const Color(0xFFF59E0B),
                          onTap: () => _navigateToUpload(context),
                        ),
                        const SizedBox(height: 12),
                      ],

                      if (hasAnySubmission) ...[
                        _buildSecondaryButton(
                          context,
                          label: 'VIEW SUBMISSION HISTORY',
                          icon: LucideIcons.history,
                          onTap: () => _navigateToHistory(context),
                        ),
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
  }

  Widget _buildHeader({
    required BuildContext context,
    required String scholarshipName,
    required String status,
    required bool requiresResubmission,
    required String saStatus,
    required String idStatus,
    required VoidCallback onRefresh,
  }) {
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
      padding: EdgeInsets.fromLTRB(16, topPadding + 10, 20, 20),
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
          if (canPop) ...[
            IconButton(
              icon: const Icon(LucideIcons.chevronLeft, color: Colors.white, size: 24),
              onPressed: () => Navigator.pop(context),
            ),
            const SizedBox(width: 4),
          ],
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
                const SizedBox(height: 3),
                Text(
                  scholarshipName,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.75),
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh Status',
            icon: const Icon(LucideIcons.refreshCw, color: Colors.white, size: 18),
            onPressed: onRefresh,
          ),
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(headerIcon, color: Colors.white, size: 18),
          ),
        ],
      ),
    );
  }

  Widget _buildMainStatusCard({
    required BuildContext context,
    required String status,
    required bool requiresResubmission,
    required String submittedDate,
    required bool hasAnySubmission,
    required String saStatus,
    required String idStatus,
  }) {
    Color cardColor;
    Gradient cardGradient;
    IconData icon;
    String statusTitle;
    String statusSubtitle;
    Color iconBgColor;

    final bool isBothRequirementsVerified =
        (saStatus.toLowerCase() == 'verified' || saStatus.toLowerCase() == 'approved' || status == 'Approved' || status == 'Verified') &&
        (idStatus.toLowerCase() == 'verified' || idStatus.toLowerCase() == 'approved' || status == 'Approved' || status == 'Verified');

    if (status == 'Approved' || status == 'Verified' || isBothRequirementsVerified) {
      cardColor = const Color(0xFF10B981);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF059669), Color(0xFF10B981)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.badgeCheck;
      statusTitle = 'Requirements Verified';
      statusSubtitle = 'Your submitted scholarship requirements are verified and approved by the administrator.';
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
      statusSubtitle = 'One or more documents require your revision. Please review official remarks and resubmit.';
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
      statusSubtitle = 'Your application was not approved. Review administrator remarks or visit the scholarship desk.';
      iconBgColor = Colors.white24;
    } else if (!hasAnySubmission) {
      cardColor = const Color(0xFF0F3260);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF0A2540), Color(0xFF1E3A8A)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.uploadCloud;
      statusTitle = 'Pending Submission';
      statusSubtitle = 'You have not submitted your scholarship requirements yet. Tap below to upload and sign.';
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
      statusSubtitle = 'Your documents are in the review queue. You will be notified immediately once verified.';
      iconBgColor = Colors.white24;
    }

    return Container(
      decoration: BoxDecoration(
        gradient: cardGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: cardColor.withOpacity(0.32),
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
              color: Colors.white.withOpacity(0.08),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
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
                      child: Icon(icon, color: Colors.white, size: 22),
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
                            hasAnySubmission ? 'Submitted on $submittedDate' : 'Awaiting Student Action',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.75),
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  statusSubtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.92),
                    fontSize: 13,
                    height: 1.45,
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
        border: Border.all(color: color.withOpacity(0.25), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.messageCircle, color: color, size: 18),
              const SizedBox(width: 10),
              Text(
                'OFFICIAL ADMINISTRATOR REMARKS',
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
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Verification Progress',
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
    required bool hasSubmission,
    required bool hasSa,
    required String? saNum,
    required bool hasIdPdf,
    required bool hasAtmProof,
    required String atmProofType,
    required bool requiresResubmission,
  }) {
    final bool isApproved = overallStatus == 'Approved' || overallStatus == 'Verified';
    final String maskedSa = (saNum != null && saNum.isNotEmpty) ? _formatMaskedSa(saNum) : '';

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(24),
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
                'Verification Timeline',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: context.textPri,
                  letterSpacing: -0.3,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Official Protocol',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),

          // Stage 1: Account Registration
          _buildTimelineNode(
            context: context,
            title: 'Account Registration & Eligibility',
            subtitle: 'Profile verified with the official university scholar masterlist.',
            state: 'verified',
            isLast: false,
          ),

          // Stage 2: Requirements & Proof Submission
          _buildTimelineNode(
            context: context,
            title: 'Requirements & Proof Submission',
            subtitle: hasSubmission
                ? 'Signed ID document, photo capture, and $atmProofType proof submitted.'
                : 'Pending initial upload of ID, digital signature, and $atmProofType proof.',
            state: hasSubmission ? 'verified' : (requiresResubmission ? 'missing' : 'pending'),
            isLast: false,
            onTap: !hasSubmission || requiresResubmission ? () => _navigateToUpload(context) : null,
          ),

          // Stage 3: SA Number Verification
          _buildTimelineNode(
            context: context,
            title: 'Savings Account (SA) Number Verification',
            subtitle: (saStatus == 'Verified' || isApproved)
                ? (maskedSa.isNotEmpty ? 'SA Number ($maskedSa) confirmed with official bank records.' : 'Savings account officially verified.')
                : (saStatus == 'Missing' || saStatus == 'Rejected'
                    ? 'Attention required: SA number rejected or invalid.'
                    : (hasSa ? 'Submitted ($maskedSa) and awaiting bank verification.' : 'Official bank account number required.')),
            state: (saStatus == 'Verified' || isApproved)
                ? 'verified'
                : (saStatus == 'Missing' || saStatus == 'Rejected' ? 'missing' : 'pending'),
            isLast: false,
            onTap: saStatus != 'Verified' && !isApproved ? () => _navigateToUpload(context) : null,
          ),

          // Stage 4: ID Card & Signature Validation
          _buildTimelineNode(
            context: context,
            title: 'ID Card & Digital Signature Validation',
            subtitle: (idStatus == 'Verified' || isApproved)
                ? 'ID front/back capture and digital specimen signature approved.'
                : (idStatus == 'Missing' || idStatus == 'Rejected'
                    ? 'Attention required: ID image unreadable or signature missing.'
                    : (hasIdPdf ? 'Uploaded credentials under examination by scholarship desk.' : 'ID scans and signature required.')),
            state: (idStatus == 'Verified' || isApproved)
                ? 'verified'
                : (idStatus == 'Missing' || idStatus == 'Rejected' ? 'missing' : 'pending'),
            isLast: true,
            onTap: idStatus != 'Verified' && !isApproved ? () => _navigateToUpload(context) : null,
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
      nodeBg = const Color(0xFF10B981).withOpacity(0.12);
      icon = LucideIcons.check;
      lineColor = const Color(0xFF10B981);
    } else if (state == 'missing') {
      iconColor = const Color(0xFFEF4444);
      nodeBg = const Color(0xFFEF4444).withOpacity(0.12);
      icon = LucideIcons.alertTriangle;
      lineColor = const Color(0xFFEF4444);
    } else {
      iconColor = const Color(0xFF3B82F6);
      nodeBg = const Color(0xFF3B82F6).withOpacity(0.12);
      icon = LucideIcons.clock;
      lineColor = context.isDark ? const Color(0xFF334155) : Colors.grey.shade300;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          Expanded(
            child: InkWell(
              onTap: state != 'verified' ? onTap : null,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13.5,
                        color: state == 'pending' ? context.textPri.withOpacity(0.7) : context.textPri,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: context.textSec,
                        height: 1.4,
                      ),
                    ),
                    if (state != 'verified' && onTap != null) ...[
                      const SizedBox(height: 5),
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

  Widget _buildActionButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withOpacity(0.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, color: Colors.white, size: 18),
        label: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
            fontSize: 14,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
    );
  }

  Widget _buildSecondaryButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16, color: AppTheme.primaryColor),
      label: Text(
        label,
        style: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 13,
          color: AppTheme.primaryColor,
          letterSpacing: 0.5,
        ),
      ),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 15),
        side: const BorderSide(color: AppTheme.primaryColor, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
      ),
    );
  }

  void _navigateToUpload(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()),
    ).then((_) => _refresh());
  }

  void _navigateToHistory(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SubmissionHistoryScreen()),
    );
  }
}
