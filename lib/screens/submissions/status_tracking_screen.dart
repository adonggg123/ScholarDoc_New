import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/academic_term_service.dart';
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

  AcademicTerm _activeTerm = AcademicTermService.currentTerm;
  AcademicTerm? _selectedTerm;

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

    try {
      await AcademicTermService.initialize();
      if (mounted) {
        setState(() {
          _activeTerm = AcademicTermService.currentTerm;
          _selectedTerm ??= _activeTerm;
        });
      }
    } catch (_) {}

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
    try {
      HapticFeedback.lightImpact();
    } catch (_) {}
    try {
      await AcademicTermService.syncFromSupabase();
      if (mounted) {
        setState(() {
          _activeTerm = AcademicTermService.currentTerm;
        });
      }
    } catch (_) {}
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
          : RefreshIndicator(
              color: AppTheme.primaryColor,
              backgroundColor: context.surfaceC,
              strokeWidth: 2.6,
              displacement: 40,
              onRefresh: _refresh,
              child: (_studentData == null && _errorMessage != null)
                  ? _buildErrorState()
                  : _buildBody(context),
            ),
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
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Center(
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
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final data = _studentData;

    final targetTerm = _selectedTerm ?? _activeTerm;
    final bool isViewingActiveTerm = (targetTerm == _activeTerm);

    final String rawStatus = data?['status'] ?? 'Pending';
    final bool requiresResubmission = data?['requiresResubmission'] == true;

    final String scholarshipName = 'TES';

    final String? remarks = (data?['adminRemarks'] ?? data?['admin_remarks'])?.toString().trim();

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

    // Has the student actually submitted required documents?
    final dynamic rawSubmittedAt = data?['submittedAt'] ?? data?['submitted_at'];
    final bool hasSubmittedTimestamp = rawSubmittedAt != null &&
        rawSubmittedAt.toString().trim().isNotEmpty &&
        rawSubmittedAt.toString().trim() != 'null';

    final String? pdfUrl = data?['submissionPdfUrl'] ??
        data?['submission_pdf_url'] ??
        docs['submissionPdfUrl'] ??
        docs['submission_pdf_url'];
    final bool hasIdPdf = pdfUrl != null && pdfUrl.toString().trim().isNotEmpty;

    final String? atmUrl = data?['atmCardUrl'] ??
        data?['atm_card_url'] ??
        docs['atmCardUrl'] ??
        docs['atm_card_url'];
    final bool hasAtmProof = atmUrl != null && atmUrl.toString().trim().isNotEmpty;
    final String atmProofType = (data?['atmProofType'] ??
            docs['atmProofType'] ??
            docs['atm_proof_type'] ??
            'ATM Card')
        .toString();

    final bool hasFrontBack = ((docs['idFrontUrl'] ?? data?['idFrontUrl']) != null &&
            (docs['idFrontUrl'] ?? data?['idFrontUrl']).toString().trim().isNotEmpty) ||
        ((docs['idBackUrl'] ?? data?['idBackUrl']) != null &&
            (docs['idBackUrl'] ?? data?['idBackUrl']).toString().trim().isNotEmpty);

    final bool hasRawSubmission = hasSubmittedTimestamp || hasIdPdf || hasAtmProof || hasFrontBack;

    // Academic Year & Semester matching check
    final String studentAy = (data?['academicYear'] ??
            data?['academic_year'] ??
            docs['academicYear'] ??
            docs['academic_year'] ??
            '')
        .toString()
        .trim();
    final String studentSem = (data?['semester'] ?? docs['semester'] ?? '')
        .toString()
        .trim();

    final bool termMatches = studentAy.isNotEmpty &&
        AcademicTermService.isYearMatching(studentAy, targetTerm.academicYear) &&
        (studentSem.isEmpty || AcademicTermService.isSemesterMatching(studentSem, targetTerm.semester));

    // CRITICAL: Progress & Status reset by Year and Semester!
    // If the student has not submitted requirements for the selected academic term,
    // hasSubmitted is FALSE, which resets progress to 25% (Awaiting Requirements Submission).
    final bool hasSubmitted = hasRawSubmission && termMatches;

    var submittedDate = 'Awaiting Submission';
    if (hasSubmitted && hasSubmittedTimestamp) {
      try {
        final ts = DateTime.parse(rawSubmittedAt.toString());
        submittedDate = DateFormat('MMM d, yyyy').format(ts);
      } catch (_) {
        submittedDate = rawSubmittedAt.toString();
      }
    }

    // Check presence of individual requirements
    final String? saNum = data?['saNumber'] ??
        data?['sa_number'] ??
        docs['saNumber'] ??
        docs['sa_number'];
    final bool hasSa = saNum != null &&
        saNum.toString().trim().isNotEmpty &&
        saNum.toString().trim().toUpperCase() != 'N/A' &&
        saNum.toString().trim() != 'null';

    final String rawSaStatus = (docs['saVerificationStatus'] ??
            docs['sa_verification_status'] ??
            data?['saVerificationStatus'] ??
            data?['sa_verification_status'] ??
            'Pending')
        .toString();

    final String rawIdStatus = (docs['idValidationStatus'] ??
            docs['id_validation_status'] ??
            data?['idValidationStatus'] ??
            data?['id_validation_status'] ??
            'Pending')
        .toString();

    final bool isSaApproved = rawSaStatus.toLowerCase() == 'verified' ||
        rawSaStatus.toLowerCase() == 'approved';
    final bool isSaRejected = rawSaStatus.toLowerCase() == 'rejected';
    final bool isSaMissing = !hasSa || rawSaStatus.toLowerCase() == 'missing';
    final bool isSaVerified = hasSubmitted && hasSa && isSaApproved;

    final bool isIdApproved = rawIdStatus.toLowerCase() == 'verified' ||
        rawIdStatus.toLowerCase() == 'approved';
    final bool isIdRejected = rawIdStatus.toLowerCase() == 'rejected';
    final bool isIdMissing = rawIdStatus.toLowerCase() == 'missing';
    final bool isIdVerified = hasSubmitted && isIdApproved;

    // 4 stages in the verification timeline
    int completedStages = 1; // Stage 1 (Account Registration & Eligibility) is verified
    if (hasSubmitted) completedStages++;
    if (isSaVerified) completedStages++;
    if (isIdVerified) completedStages++;

    final bool allStagesVerified = hasSubmitted && isSaVerified && isIdVerified;
    final double progressValue = completedStages / 4.0;

    final String progressLabel = allStagesVerified
        ? 'All Requirements Verified (100%)'
        : (requiresResubmission && hasSubmitted
            ? 'Action Required: Resubmission needed'
            : (!hasSubmitted
                ? 'Awaiting Requirements Submission for ${targetTerm.shortString} (25%)'
                : '$completedStages of 4 verification stages completed (${(progressValue * 100).toInt()}%)'));

    final String effectiveStatus = hasSubmitted ? rawStatus : 'No Submission Yet';

    Color statusColor = AppTheme.warning;
    if (allStagesVerified) {
      statusColor = AppTheme.success;
    } else if (hasSubmitted && (effectiveStatus == 'Rejected' || requiresResubmission || isSaRejected || isIdRejected)) {
      statusColor = AppTheme.error;
    } else if (!hasSubmitted) {
      statusColor = AppTheme.textSecondary;
    }

    final bool needsAction = !hasSubmitted ||
        requiresResubmission ||
        effectiveStatus == 'Rejected' ||
        isSaMissing ||
        isSaRejected ||
        isIdMissing ||
        isIdRejected;

    return Column(
      children: [
        _buildHeader(
          context: context,
          scholarshipName: scholarshipName,
          status: effectiveStatus,
          allStagesVerified: allStagesVerified,
          requiresResubmission: requiresResubmission,
          saStatus: rawSaStatus,
          idStatus: rawIdStatus,
          targetTerm: targetTerm,
          onRefresh: _refresh,
        ),
        Expanded(
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 0. Academic Period Bar (Term Selector & Reset Status)
                      _buildAcademicTermBar(
                        context: context,
                        targetTerm: targetTerm,
                        isViewingActiveTerm: isViewingActiveTerm,
                        hasSubmittedForTerm: hasSubmitted,
                        hasAnySubmission: hasRawSubmission,
                        studentAy: studentAy,
                        studentSem: studentSem,
                      ),
                      const SizedBox(height: 16),

                      if (!isViewingActiveTerm) ...[
                        _buildArchiveWarningBanner(context),
                        const SizedBox(height: 16),
                      ],

                      // 1. Main Status Indicator Banner
                      _buildMainStatusCard(
                        context: context,
                        status: effectiveStatus,
                        requiresResubmission: requiresResubmission,
                        submittedDate: submittedDate,
                        hasSubmitted: hasSubmitted,
                        allStagesVerified: allStagesVerified,
                        isSaRejected: isSaRejected,
                        isIdRejected: isIdRejected,
                        targetTerm: targetTerm,
                        isViewingActiveTerm: isViewingActiveTerm,
                      ),
                      const SizedBox(height: 24),

                      // 2. Official Remarks (if present and submitted for this term)
                      if (hasSubmitted && remarks != null && remarks.isNotEmpty) ...[
                        _buildRemarksCard(remarks, statusColor),
                        const SizedBox(height: 24),
                      ],

                      // 3. Verification Timeline Progress Summary
                      _buildProgressCard(progressValue, progressLabel, statusColor),
                      const SizedBox(height: 24),

                      // 4. Verification Timeline Component
                      _buildVerticalTimeline(
                        context: context,
                        isSaVerified: isSaVerified,
                        isIdVerified: isIdVerified,
                        rawSaStatus: rawSaStatus,
                        rawIdStatus: rawIdStatus,
                        hasSubmitted: hasSubmitted,
                        hasSa: hasSa,
                        saNum: saNum,
                        hasIdPdf: hasIdPdf,
                        hasAtmProof: hasAtmProof,
                        atmProofType: atmProofType,
                        requiresResubmission: requiresResubmission,
                        targetTerm: targetTerm,
                      ),
                      const SizedBox(height: 28),

                      // 5. Action Buttons
                      if (needsAction) ...[
                        _buildActionButton(
                          context,
                          label: !hasSubmitted
                              ? 'SUBMIT REQUIREMENTS FOR ${targetTerm.academicYear.toUpperCase()}'
                              : 'RESUBMIT / FIX REQUIREMENTS',
                          icon: !hasSubmitted ? LucideIcons.uploadCloud : LucideIcons.refreshCw,
                          color: const Color(0xFFF59E0B),
                          onTap: () => _navigateToUpload(context),
                        ),
                        const SizedBox(height: 12),
                      ],

                      if (hasSubmitted || hasRawSubmission) ...[
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
    required bool allStagesVerified,
    required bool requiresResubmission,
    required String saStatus,
    required String idStatus,
    required AcademicTerm targetTerm,
    required VoidCallback onRefresh,
  }) {
    final topPadding = MediaQuery.of(context).padding.top;
    final canPop = Navigator.canPop(context);

    IconData headerIcon = LucideIcons.clock;
    if (allStagesVerified) {
      headerIcon = LucideIcons.shieldCheck;
    } else if (status == 'Rejected') {
      headerIcon = LucideIcons.xCircle;
    } else if (requiresResubmission || saStatus.toLowerCase() == 'missing' || idStatus.toLowerCase() == 'missing') {
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
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 2,
                  children: [
                    Text(
                      scholarshipName,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white.withOpacity(0.85),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '• ${targetTerm.shortString}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFFFBC02D),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
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
    required bool hasSubmitted,
    required bool allStagesVerified,
    required bool isSaRejected,
    required bool isIdRejected,
    required AcademicTerm targetTerm,
    required bool isViewingActiveTerm,
  }) {
    Color cardColor;
    Gradient cardGradient;
    IconData icon;
    String statusTitle;
    String statusSubtitle;
    Color iconBgColor;

    if (!hasSubmitted) {
      cardColor = const Color(0xFF475569);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF334155), Color(0xFF475569)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.fileClock;
      statusTitle = 'No Submission Yet';
      statusSubtitle = isViewingActiveTerm
          ? 'Submissions for ${targetTerm.displayString} are open. Please upload your required documents and ID sticker to complete your application.'
          : 'No document submission recorded for ${targetTerm.displayString}. Requirements reset every academic year and semester.';
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
    } else if (status == 'Rejected' || isSaRejected || isIdRejected) {
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
    } else if (allStagesVerified) {
      cardColor = const Color(0xFF10B981);
      cardGradient = const LinearGradient(
        colors: [Color(0xFF059669), Color(0xFF10B981)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
      icon = LucideIcons.badgeCheck;
      statusTitle = 'Requirements Verified';
      statusSubtitle = 'Your submitted scholarship requirements are verified and approved for ${targetTerm.shortString}.';
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
      statusSubtitle = 'Your documents for ${targetTerm.shortString} are in the review queue. You will be notified immediately once verified.';
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
                            hasSubmitted ? 'Submitted on $submittedDate' : 'Awaiting Submission • ${targetTerm.shortString}',
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
    required bool isSaVerified,
    required bool isIdVerified,
    required String rawSaStatus,
    required String rawIdStatus,
    required bool hasSubmitted,
    required bool hasSa,
    required String? saNum,
    required bool hasIdPdf,
    required bool hasAtmProof,
    required String atmProofType,
    required bool requiresResubmission,
    required AcademicTerm targetTerm,
  }) {
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
                  targetTerm.shortString,
                  style: const TextStyle(
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
            subtitle: hasSubmitted
                ? 'Signed ID document, photo capture, and $atmProofType proof submitted for ${targetTerm.shortString}.'
                : 'Pending upload of ID, digital signature, and $atmProofType proof for ${targetTerm.shortString}.',
            state: hasSubmitted ? 'verified' : (requiresResubmission ? 'missing' : 'pending'),
            isLast: false,
            onTap: !hasSubmitted || requiresResubmission ? () => _navigateToUpload(context) : null,
          ),

          // Stage 3: SA Number Verification
          _buildTimelineNode(
            context: context,
            title: 'Savings Account (SA) Number Verification',
            subtitle: isSaVerified
                ? (maskedSa.isNotEmpty
                    ? 'SA Number ($maskedSa) confirmed with official bank records.'
                    : 'Savings account officially verified.')
                : (rawSaStatus.toLowerCase() == 'rejected'
                    ? 'Attention required: SA number rejected or invalid.'
                    : (hasSubmitted && hasSa
                        ? 'Submitted ($maskedSa) and awaiting bank verification.'
                        : 'Official bank account number required for ${targetTerm.shortString}.')),
            state: isSaVerified
                ? 'verified'
                : (rawSaStatus.toLowerCase() == 'rejected' ? 'missing' : 'pending'),
            isLast: false,
            onTap: !isSaVerified ? () => _navigateToUpload(context) : null,
          ),

          // Stage 4: ID Card & Signature Validation
          _buildTimelineNode(
            context: context,
            title: 'ID Card & Digital Signature Validation',
            subtitle: isIdVerified
                ? 'ID front/back capture and digital specimen signature approved for ${targetTerm.shortString}.'
                : (rawIdStatus.toLowerCase() == 'rejected'
                    ? 'Attention required: ID image unreadable or signature missing.'
                    : (hasSubmitted
                        ? 'Uploaded credentials under examination by scholarship desk.'
                        : 'ID scans with valid ${targetTerm.academicYear} sticker required.')),
            state: isIdVerified
                ? 'verified'
                : (rawIdStatus.toLowerCase() == 'rejected' ? 'missing' : 'pending'),
            isLast: true,
            onTap: !isIdVerified ? () => _navigateToUpload(context) : null,
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

  Widget _buildAcademicTermBar({
    required BuildContext context,
    required AcademicTerm targetTerm,
    required bool isViewingActiveTerm,
    required bool hasSubmittedForTerm,
    required bool hasAnySubmission,
    required String studentAy,
    required String studentSem,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isViewingActiveTerm
              ? AppTheme.primaryColor.withOpacity(0.25)
              : context.crispBorder,
          width: 1.5,
        ),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isViewingActiveTerm
                  ? const Color(0xFF10B981).withOpacity(0.12)
                  : const Color(0xFF3B82F6).withOpacity(0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              isViewingActiveTerm ? LucideIcons.calendarCheck : LucideIcons.history,
              color: isViewingActiveTerm ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text(
                      'ACADEMIC PERIOD',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: context.textSec,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isViewingActiveTerm
                            ? const Color(0xFF10B981).withOpacity(0.15)
                            : Colors.grey.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isViewingActiveTerm ? 'CURRENT CYCLE' : 'ARCHIVE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: isViewingActiveTerm
                              ? const Color(0xFF10B981)
                              : context.textSec,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  targetTerm.displayString,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: context.textPri,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hasSubmittedForTerm
                      ? '✓ Submission records found for this term'
                      : (isViewingActiveTerm
                          ? 'Progress reset • Awaiting new semester upload'
                          : 'No submission recorded for this term'),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: hasSubmittedForTerm
                        ? const Color(0xFF10B981)
                        : (isViewingActiveTerm ? const Color(0xFFF59E0B) : context.textSec),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => _showTermSelectorSheet(
                context,
                targetTerm,
                studentAy,
                studentSem,
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primaryColor.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Term',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(LucideIcons.chevronDown, size: 14, color: AppTheme.primaryColor),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArchiveWarningBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF3B82F6).withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.25)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.info, size: 16, color: Color(0xFF3B82F6)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Viewing historical period archive. Progress resets every semester.',
              style: TextStyle(
                fontSize: 11.5,
                color: context.textPri,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                _selectedTerm = _activeTerm;
              });
            },
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              'Back to Active',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF3B82F6),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showTermSelectorSheet(
    BuildContext context,
    AcademicTerm currentSelected,
    String studentAy,
    String studentSem,
  ) {
    final terms = AcademicTermService.getAvailableTerms(
      studentYear: studentAy,
      studentSemester: studentSem,
    );

    showModalBottomSheet(
      context: context,
      backgroundColor: context.surfaceC,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(LucideIcons.calendar, size: 18, color: AppTheme.primaryColor),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Select Academic Period',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: context.textPri,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Status & verification progress reset per semester',
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textSec,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                ...terms.map((term) {
                  final isCurrentActive = (term == _activeTerm);
                  final isSelected = (term == currentSelected);
                  final hasRecord = studentAy.isNotEmpty &&
                      AcademicTermService.isYearMatching(studentAy, term.academicYear) &&
                      (studentSem.isEmpty || AcademicTermService.isSemesterMatching(studentSem, term.semester));

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.pop(ctx);
                        setState(() {
                          _selectedTerm = term;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.primaryColor.withOpacity(0.08)
                              : context.bgC,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? AppTheme.primaryColor
                                : context.crispBorder,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        term.displayString,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: isSelected
                                              ? AppTheme.primaryColor
                                              : context.textPri,
                                        ),
                                      ),
                                      if (isCurrentActive) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'ACTIVE',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF10B981),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    hasRecord
                                        ? 'Submission records on file'
                                        : (isCurrentActive
                                            ? 'Current school cycle • Awaiting submission (25%)'
                                            : 'No submission for this term'),
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: hasRecord
                                          ? const Color(0xFF10B981)
                                          : context.textSec,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(LucideIcons.checkCircle2, color: AppTheme.primaryColor, size: 20),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}

