// lib/screens/submissions/submission_history_screen.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/academic_term_service.dart';
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
  StreamSubscription<List<Map<String, dynamic>>>? _profileSub;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _profileSub?.cancel();
    super.dispose();
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
      try {
        _profileSub?.cancel();
        _profileSub = _authService.getStudentStream(uid).listen((list) {
          if (!mounted) return;
          if (list.isNotEmpty) {
            setState(() {
              _profileData = list.first;
              _isLoadingProfile = false;
            });
          }
        });
      } catch (_) {}
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
    final term = item['term'];

    Color statusColor = const Color(0xFFF59E0B);
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = const Color(0xFF10B981);
      statusIcon = LucideIcons.badgeCheck;
    } else if (status == 'Rejected' || status == 'Needs Correction' || status == 'Missing') {
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
              type.contains('Deposit') || type.contains('ID')
                  ? LucideIcons.fileText
                  : LucideIcons.creditCard,
              color: AppTheme.primaryColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        type,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: Color(0xFF0F3260),
                        ),
                      ),
                    ),
                    if (term != null && term.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          term,
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.primaryColor,
                          ),
                        ),
                      ),
                    ],
                  ],
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
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: statusColor.withOpacity(0.3), width: 1.0),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 14, color: statusColor),
                const SizedBox(width: 5),
                Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
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
    if (_profileData != null) {
      final String submittedAt = (() {
        final ts = _profileData!['submittedAt'] ??
            _profileData!['submitted_at'] ??
            _profileData!['createdAt'] ??
            _profileData!['created_at'];
        if (ts != null) {
          try {
            final parsed = DateTime.parse(ts.toString());
            return DateFormat('MMM d, y – h:mm a').format(parsed);
          } catch (_) {}
        }
        return 'N/A';
      })();

      bool isFieldVerified(dynamic val) {
        if (val == null) return false;
        final s = val.toString().trim().toLowerCase();
        return s == 'verified' || s == 'approved' || s == 'complete' || s == 'completed' || s == 'true';
      }

      bool isFieldRejected(dynamic val) {
        if (val == null) return false;
        final s = val.toString().trim().toLowerCase();
        return s == 'rejected' || s == 'missing' || s == 'invalid';
      }

      final String overallStatus = (_profileData!['status'] ?? 'Pending').toString();
      final bool isOverallVerified = isFieldVerified(overallStatus);

      Map<String, dynamic> docs = {};
      if (_profileData!['documents'] is Map) {
        docs = Map<String, dynamic>.from(_profileData!['documents']);
      } else if (_profileData!['documents'] is String && (_profileData!['documents'] as String).trim().isNotEmpty) {
        try {
          final decoded = jsonDecode(_profileData!['documents'] as String);
          if (decoded is Map) docs = Map<String, dynamic>.from(decoded);
        } catch (_) {}
      }

      // 1. Resolve ID Validation status
      final bool isIdVerified = isFieldVerified(docs['idValidationStatus']) ||
          isFieldVerified(docs['id_validation_status']) ||
          isFieldVerified(_profileData!['idValidationStatus']) ||
          isFieldVerified(_profileData!['id_validation_status']) ||
          isFieldVerified(_profileData!['pdfVerified']) ||
          isFieldVerified(docs['pdfVerified']) ||
          isOverallVerified;

      final bool isIdRejected = isFieldRejected(docs['idValidationStatus']) ||
          isFieldRejected(docs['id_validation_status']) ||
          isFieldRejected(_profileData!['idValidationStatus']) ||
          isFieldRejected(_profileData!['id_validation_status']);

      final String idItemStatus = isIdVerified
          ? 'Verified'
          : (isIdRejected || _profileData!['requiresResubmission'] == true
              ? 'Needs Correction'
              : 'Pending');

      // 2. Resolve SA / Payout verification status
      final bool isSaVerified = isFieldVerified(docs['saVerificationStatus']) ||
          isFieldVerified(docs['sa_verification_status']) ||
          isFieldVerified(_profileData!['saVerificationStatus']) ||
          isFieldVerified(_profileData!['sa_verification_status']) ||
          isOverallVerified;

      final bool isSaRejected = isFieldRejected(docs['saVerificationStatus']) ||
          isFieldRejected(docs['sa_verification_status']) ||
          isFieldRejected(_profileData!['saVerificationStatus']) ||
          isFieldRejected(_profileData!['sa_verification_status']);

      final String saItemStatus = isSaVerified
          ? 'Verified'
          : (isSaRejected || _profileData!['requiresResubmission'] == true
              ? 'Needs Correction'
              : 'Pending');

      // Check ID submission presence
      final String? pdfName = _profileData!['submissionPdfName'] ??
          docs['submissionPdfName'] ??
          _profileData!['submission_pdf_name'] ??
          docs['submission_pdf_name'];
      final String? pdfUrl = _profileData!['submissionPdfUrl'] ??
          docs['submissionPdfUrl'] ??
          _profileData!['submission_pdf_url'] ??
          docs['submission_pdf_url'];
      final bool hasIdFiles = pdfName != null ||
          pdfUrl != null ||
          docs['idFrontUrl'] != null ||
          _profileData!['idFrontUrl'] != null ||
          docs['id_front_url'] != null;

      // Academic Term detection for submission items
      final String submissionTerm = (() {
        final ay = _profileData!['academicYear'] ??
            _profileData!['academic_year'] ??
            docs['academicYear'] ??
            docs['academic_year'];
        final sem = _profileData!['semester'] ?? docs['semester'];
        if (ay != null && sem != null) return 'AY $ay • $sem';
        if (ay != null) return 'AY $ay';
        return 'AY 2024-2025 • 1st Semester';
      })();

      if (hasIdFiles || isIdVerified) {
        submissions.add({
          'type': 'ID Capture & Digital Signature',
          'fileName': (pdfName ?? 'ID_Submission_Document.pdf').toString(),
          'date': submittedAt,
          'status': idItemStatus,
          'term': submissionTerm,
        });
      }

      // Check ATM/Deposit Slip submission presence
      final atmCardFileName = _profileData!['atmCardFileName'] ??
          docs['atmCardFileName'] ??
          _profileData!['atm_card_file_name'] ??
          docs['atm_card_file_name'];
      final atmCardUrl = _profileData!['atmCardUrl'] ??
          docs['atmCardUrl'] ??
          _profileData!['atm_card_url'] ??
          docs['atm_card_url'];
      final saNumber = _profileData!['saNumber'] ??
          _profileData!['sa_number'] ??
          docs['saNumber'] ??
          docs['sa_number'];
      final bool hasAtmFiles = atmCardFileName != null ||
          atmCardUrl != null ||
          (saNumber != null && saNumber.toString().trim().isNotEmpty && saNumber.toString().trim().toUpperCase() != 'N/A');

      if (hasAtmFiles || isSaVerified) {
        final proofType = _profileData!['atmProofType'] ??
            docs['atmProofType'] ??
            _profileData!['atm_proof_type'] ??
            docs['atm_proof_type'] ??
            'ATM Card / Deposit Slip';
        submissions.add({
          'type': '$proofType Proof',
          'fileName': (atmCardFileName ?? (saNumber != null ? 'SA: $saNumber' : '$proofType File')).toString(),
          'date': submittedAt,
          'status': saItemStatus,
          'term': submissionTerm,
        });
      }
    }

    final currentTerm = AcademicTermService.currentTerm;
    final studentAy = (_profileData?['academicYear'] ?? _profileData?['academic_year'] ?? '').toString();
    final studentSem = (_profileData?['semester'] ?? '').toString();
    final bool hasActiveTermSubmission = studentAy.isNotEmpty &&
        AcademicTermService.isYearMatching(studentAy, currentTerm.academicYear) &&
        (studentSem.isEmpty || AcademicTermService.isSemesterMatching(studentSem, currentTerm.semester));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submission History', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 18),
            onPressed: _loadProfile,
            tooltip: 'Refresh',
          ),
        ],
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

          return RefreshIndicator(
            onRefresh: _loadProfile,
            color: AppTheme.primaryColor,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Active Period Reset Notice Banner
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: context.surfaceC,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: hasActiveTermSubmission
                                  ? const Color(0xFF10B981).withOpacity(0.3)
                                  : const Color(0xFFF59E0B).withOpacity(0.3),
                              width: 1.5,
                            ),
                            boxShadow: AppTheme.softShadow,
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: (hasActiveTermSubmission
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFFF59E0B))
                                      .withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  hasActiveTermSubmission ? LucideIcons.checkCircle : LucideIcons.clock,
                                  color: hasActiveTermSubmission
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFFF59E0B),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'ACTIVE SCHOOL PERIOD',
                                          style: TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            color: context.textSec,
                                            letterSpacing: 0.8,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'CURRENT',
                                            style: TextStyle(
                                              fontSize: 8.5,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF10B981),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      currentTerm.displayString,
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w800,
                                        color: context.textPri,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      hasActiveTermSubmission
                                          ? 'Submitted and recorded for current term.'
                                          : 'Progress resets per semester. Awaiting upload for this period.',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                        color: hasActiveTermSubmission
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFFF59E0B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
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
            ),
          );
        },
      ),
    );
  }
}
