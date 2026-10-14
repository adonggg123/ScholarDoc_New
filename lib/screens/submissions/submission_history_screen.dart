import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/academic_term_service.dart';
import 'upload_workflow_screen.dart';

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
  String _selectedFilter = 'All'; // 'All', 'Documents', 'Timeline', 'Verified', 'Pending'

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
    try {
      HapticFeedback.lightImpact();
    } catch (_) {}
    try {
      await AcademicTermService.syncFromSupabase();
    } catch (_) {}
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

  void _openUrl(String? urlString) async {
    if (urlString == null || urlString.trim().isEmpty) return;
    try {
      final uri = Uri.parse(urlString.trim());
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cannot open document URL.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to open document: $e')),
      );
    }
  }

  _FormattedDateTime _formatDateTime(dynamic rawTimestamp) {
    if (rawTimestamp == null) {
      return const _FormattedDateTime(
        date: 'Date N/A',
        time: 'Time N/A',
        fullDateTime: 'Not recorded',
        relative: 'N/A',
      );
    }
    try {
      DateTime dt;
      if (rawTimestamp is DateTime) {
        dt = rawTimestamp.toLocal();
      } else {
        dt = DateTime.parse(rawTimestamp.toString()).toLocal();
      }

      final now = DateTime.now();
      final diff = now.difference(dt);

      String rel;
      if (diff.inSeconds < 60) {
        rel = 'Just now';
      } else if (diff.inMinutes < 60) {
        rel = '${diff.inMinutes}m ago';
      } else if (diff.inHours < 24 && dt.day == now.day) {
        rel = 'Today';
      } else if (diff.inDays <= 1 || (diff.inHours < 48 && dt.day == now.subtract(const Duration(days: 1)).day)) {
        rel = 'Yesterday';
      } else if (diff.inDays < 7) {
        rel = '${diff.inDays}d ago';
      } else {
        rel = DateFormat('MMM d, y').format(dt);
      }

      return _FormattedDateTime(
        date: DateFormat('MMM d, y').format(dt),
        time: DateFormat('h:mm a').format(dt),
        fullDateTime: DateFormat('EEEE, MMMM d, y – h:mm a').format(dt),
        relative: rel,
        parsedDate: dt,
      );
    } catch (_) {
      return _FormattedDateTime(
        date: rawTimestamp.toString(),
        time: '',
        fullDateTime: rawTimestamp.toString(),
        relative: '',
      );
    }
  }

  bool _isFieldVerified(dynamic val) {
    if (val == null) return false;
    final s = val.toString().trim().toLowerCase();
    return s == 'verified' || s == 'approved' || s == 'complete' || s == 'completed' || s == 'true';
  }

  bool _isFieldRejected(dynamic val) {
    if (val == null) return false;
    final s = val.toString().trim().toLowerCase();
    return s == 'rejected' || s == 'missing' || s == 'invalid' || s == 'needs resubmission' || s == 'needs correction';
  }

  List<Map<String, dynamic>> _extractSubmissions() {
    final List<Map<String, dynamic>> list = [];
    if (_profileData == null) return list;

    final dynamic rawSubmittedAt = _profileData!['submittedAt'] ??
        _profileData!['submitted_at'] ??
        _profileData!['updatedAt'] ??
        _profileData!['updated_at'] ??
        _profileData!['createdAt'] ??
        _profileData!['created_at'];

    final overallStatus = (_profileData!['status'] ?? 'No Submission Yet').toString();
    final bool isOverallVerified = _isFieldVerified(overallStatus);

    Map<String, dynamic> docs = {};
    if (_profileData!['documents'] is Map) {
      docs = Map<String, dynamic>.from(_profileData!['documents']);
    } else if (_profileData!['documents'] is String && (_profileData!['documents'] as String).trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(_profileData!['documents'] as String);
        if (decoded is Map) docs = Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }

    // Academic Term
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

    // 1. ID Submission
    final bool isIdVerified = _isFieldVerified(docs['idValidationStatus']) ||
        _isFieldVerified(docs['id_validation_status']) ||
        _isFieldVerified(_profileData!['idValidationStatus']) ||
        _isFieldVerified(_profileData!['id_validation_status']) ||
        _isFieldVerified(_profileData!['pdfVerified']) ||
        _isFieldVerified(docs['pdfVerified']) ||
        isOverallVerified;

    final bool isIdRejected = _isFieldRejected(docs['idValidationStatus']) ||
        _isFieldRejected(docs['id_validation_status']) ||
        _isFieldRejected(_profileData!['idValidationStatus']) ||
        _isFieldRejected(_profileData!['id_validation_status']);

    final String idStatus = isIdVerified
        ? 'Verified'
        : (isIdRejected || _profileData!['requiresResubmission'] == true
            ? 'Needs Correction'
            : 'Pending');

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

    final idTimestamp = docs['idSubmittedAt'] ?? docs['submittedAt'] ?? rawSubmittedAt;
    final idFormattedTime = _formatDateTime(idTimestamp);

    if (hasIdFiles || isIdVerified) {
      final fullName = _profileData!['fullName'] ?? _profileData!['full_name'] ?? docs['frontExtractedName'];
      list.add({
        'id': 'id_submission',
        'type': 'ID Capture & Digital Signature',
        'category': 'id',
        'fileName': (pdfName ?? 'ID_Submission_Document.pdf').toString(),
        'fileUrl': pdfUrl,
        'status': idStatus,
        'term': submissionTerm,
        'dateTime': idFormattedTime,
        'detail': fullName != null ? 'Student Name: $fullName' : 'Identity Verification Document',
        'remarks': _profileData!['adminRemarks'] ?? docs['adminRemarks'],
      });
    }

    // 2. ATM Card Proof
    final bool isSaVerified = _isFieldVerified(docs['saVerificationStatus']) ||
        _isFieldVerified(docs['sa_verification_status']) ||
        _isFieldVerified(_profileData!['saVerificationStatus']) ||
        _isFieldVerified(_profileData!['sa_verification_status']) ||
        isOverallVerified;

    final bool isSaRejected = _isFieldRejected(docs['saVerificationStatus']) ||
        _isFieldRejected(docs['sa_verification_status']) ||
        _isFieldRejected(_profileData!['saVerificationStatus']) ||
        _isFieldRejected(_profileData!['sa_verification_status']);

    final String saStatus = isSaVerified
        ? 'Verified'
        : (isSaRejected || _profileData!['requiresResubmission'] == true
            ? 'Needs Correction'
            : 'Pending');

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

    final atmTimestamp = docs['saSubmittedAt'] ?? docs['submittedAt'] ?? rawSubmittedAt;
    final atmFormattedTime = _formatDateTime(atmTimestamp);

    if (hasAtmFiles || isSaVerified) {
      list.add({
        'id': 'atm_proof',
        'type': 'Landbank ATM Card Proof',
        'category': 'atm',
        'fileName': (atmCardFileName ?? (saNumber != null ? 'SA Number: $saNumber' : 'ATM Card Proof')).toString(),
        'fileUrl': atmCardUrl,
        'status': saStatus,
        'term': submissionTerm,
        'dateTime': atmFormattedTime,
        'detail': saNumber != null ? 'SA Number: $saNumber' : 'Payout Account Document',
        'remarks': _profileData!['adminRemarks'] ?? docs['adminRemarks'],
      });
    }

    // 3. Deposit Slip Proof
    final depositSlipFileName = _profileData!['depositSlipFileName'] ??
        docs['depositSlipFileName'] ??
        _profileData!['deposit_slip_file_name'] ??
        docs['deposit_slip_file_name'];
    final depositSlipUrl = _profileData!['depositSlipUrl'] ??
        docs['depositSlipUrl'] ??
        _profileData!['deposit_slip_url'] ??
        docs['deposit_slip_url'];
    final bool hasDepositFiles = depositSlipFileName != null || depositSlipUrl != null;

    if (hasDepositFiles) {
      list.add({
        'id': 'deposit_slip',
        'type': 'Deposit Slip Proof',
        'category': 'deposit',
        'fileName': (depositSlipFileName ?? 'Deposit Slip Proof').toString(),
        'fileUrl': depositSlipUrl,
        'status': saStatus,
        'term': submissionTerm,
        'dateTime': _formatDateTime(rawSubmittedAt),
        'detail': 'Bank Transaction Proof',
        'remarks': _profileData!['adminRemarks'] ?? docs['adminRemarks'],
      });
    }

    return list;
  }

  Widget _buildHeader(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final canPop = Navigator.canPop(context);

    return Container(
      padding: EdgeInsets.fromLTRB(20, topPadding + 10, 20, 22),
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
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(LucideIcons.chevronLeft, color: Colors.white, size: 20),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFBC02D).withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFFBC02D).withValues(alpha: 0.45),
                width: 1.2,
              ),
            ),
            child: const Icon(LucideIcons.history, color: Color(0xFFFBC02D), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Submission History',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Record of submission dates, times & status',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.78),
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, color: Colors.white, size: 20),
            onPressed: _loadProfile,
            tooltip: 'Refresh History',
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryMetrics(List<Map<String, dynamic>> submissions) {
    int verifiedCount = 0;
    int pendingCount = 0;
    int actionCount = 0;

    for (final s in submissions) {
      final st = s['status'] as String;
      if (st == 'Verified' || st == 'Approved') {
        verifiedCount++;
      } else if (st == 'Needs Correction' || st == 'Rejected') {
        actionCount++;
      } else {
        pendingCount++;
      }
    }

    return Row(
      children: [
        _buildMetricCard(
          context,
          label: 'Total Files',
          count: submissions.length.toString(),
          icon: LucideIcons.files,
          color: AppTheme.primaryColor,
        ),
        const SizedBox(width: 10),
        _buildMetricCard(
          context,
          label: 'Verified',
          count: verifiedCount.toString(),
          icon: LucideIcons.badgeCheck,
          color: const Color(0xFF10B981),
        ),
        const SizedBox(width: 10),
        _buildMetricCard(
          context,
          label: 'In Review',
          count: pendingCount.toString(),
          icon: LucideIcons.clock,
          color: const Color(0xFFF59E0B),
        ),
        if (actionCount > 0) ...[
          const SizedBox(width: 10),
          _buildMetricCard(
            context,
            label: 'Action Req.',
            count: actionCount.toString(),
            icon: LucideIcons.alertTriangle,
            color: const Color(0xFFEF4444),
          ),
        ],
      ],
    );
  }

  Widget _buildMetricCard(
    BuildContext context, {
    required String label,
    required String count,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: context.surfaceC,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.crispBorder, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 4),
                Text(
                  count,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: context.textSec,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTermBanner(BuildContext context, bool hasActiveTermSubmission) {
    final currentTerm = AcademicTermService.currentTerm;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: hasActiveTermSubmission
              ? const Color(0xFF10B981).withValues(alpha: 0.35)
              : const Color(0xFFF59E0B).withValues(alpha: 0.35),
          width: 1.5,
        ),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (hasActiveTermSubmission
                      ? const Color(0xFF10B981)
                      : const Color(0xFFF59E0B))
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              hasActiveTermSubmission ? LucideIcons.badgeCheck : LucideIcons.clock,
              color: hasActiveTermSubmission
                  ? const Color(0xFF10B981)
                  : const Color(0xFFF59E0B),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'ACTIVE SCHOOL PERIOD',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: context.textSec,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: const Text(
                        'CURRENT',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF10B981),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  currentTerm.displayString,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: context.textPri,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hasActiveTermSubmission
                      ? 'Documents submitted and logged for the current academic term.'
                      : 'Semester resets active. Awaiting your document upload.',
                  style: TextStyle(
                    fontSize: 11.5,
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
    );
  }

  Widget _buildFilterChips() {
    final filters = ['All', 'Documents', 'Timeline', 'Verified', 'Pending'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: filters.map((f) {
          final isSelected = _selectedFilter == f;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: GestureDetector(
              onTap: () {
                setState(() => _selectedFilter = f);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.primaryColor : context.surfaceC,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? AppTheme.primaryColor : context.crispBorder,
                    width: 1.2,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppTheme.primaryColor.withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : [],
                ),
                child: Text(
                  f,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    color: isSelected ? Colors.white : context.textSec,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSubmissionCard(BuildContext context, Map<String, dynamic> item) {
    final String type = item['type']!;
    final String fileName = item['fileName']!;
    final String? fileUrl = item['fileUrl'];
    final String status = item['status']!;
    final String? term = item['term'];
    final _FormattedDateTime dateTime = item['dateTime'] as _FormattedDateTime;
    final String? detail = item['detail'];
    final String? remarks = item['remarks'];

    Color statusColor = const Color(0xFFF59E0B);
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = const Color(0xFF10B981);
      statusIcon = LucideIcons.badgeCheck;
    } else if (status == 'Rejected' || status == 'Needs Correction' || status == 'Missing') {
      statusColor = const Color(0xFFEF4444);
      statusIcon = LucideIcons.alertTriangle;
    } else if (status == 'No Submission Yet') {
      statusColor = const Color(0xFF64748B);
      statusIcon = LucideIcons.fileClock;
    }

    final isIdDoc = type.contains('ID');
    final isAtmDoc = type.contains('ATM') || type.contains('Landbank');

    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Type & Status
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: isIdDoc
                      ? AppTheme.primaryColor.withValues(alpha: 0.1)
                      : (isAtmDoc
                          ? const Color(0xFF0D9488).withValues(alpha: 0.1)
                          : const Color(0xFF6366F1).withValues(alpha: 0.1)),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  isIdDoc
                      ? LucideIcons.fileText
                      : (isAtmDoc ? LucideIcons.creditCard : LucideIcons.receipt),
                  color: isIdDoc
                      ? AppTheme.primaryColor
                      : (isAtmDoc ? const Color(0xFF0D9488) : const Color(0xFF6366F1)),
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      type,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: context.textPri,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 3),
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
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusColor.withValues(alpha: 0.35), width: 1.2),
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
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          const Divider(height: 1, thickness: 1),
          const SizedBox(height: 14),

          // High-Visibility Date & Time Card (CORE REQUIREMENT)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: context.bgC,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: context.crispBorder.withValues(alpha: 0.7)),
            ),
            child: Row(
              children: [
                // Date Column
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          LucideIcons.calendar,
                          size: 15,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SUBMISSION DATE',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: context.textSec,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              dateTime.date,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: context.textPri,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                Container(
                  height: 28,
                  width: 1,
                  color: context.crispBorder,
                ),
                const SizedBox(width: 12),

                // Time Column
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFBC02D).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          LucideIcons.clock,
                          size: 15,
                          color: Color(0xFFB45309),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'TIME',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: context.textSec,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              dateTime.time,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: context.textPri,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                if (dateTime.relative.isNotEmpty && dateTime.relative != 'N/A') ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      dateTime.relative,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Academic Term & Details
          const SizedBox(height: 10),
          Row(
            children: [
              if (term != null && term.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(LucideIcons.graduationCap, size: 12, color: AppTheme.primaryColor),
                      const SizedBox(width: 5),
                      Text(
                        term,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
              ],
              if (detail != null && detail.isNotEmpty) ...[
                Expanded(
                  child: Text(
                    detail,
                    style: TextStyle(
                      fontSize: 11,
                      color: context.textSec,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),

          // Admin Remarks Callout if any
          if (remarks != null && remarks.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.25)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(LucideIcons.messageSquare, size: 14, color: Color(0xFFEF4444)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Admin Remarks: $remarks',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Action Buttons: View File & Resubmit
          const SizedBox(height: 12),
          Row(
            children: [
              if (fileUrl != null && fileUrl.trim().isNotEmpty) ...[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openUrl(fileUrl),
                    icon: const Icon(LucideIcons.externalLink, size: 14),
                    label: const Text('View Document', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.primaryColor,
                      side: const BorderSide(color: AppTheme.primaryColor, width: 1.2),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
              if (status == 'Needs Correction' || status == 'Rejected') ...[
                if (fileUrl != null) const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()),
                      ).then((_) => _loadProfile());
                    },
                    icon: const Icon(LucideIcons.uploadCloud, size: 14),
                    label: const Text('Resubmit Now', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: context.crispBorder, width: 1.5),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.fileClock, size: 42, color: AppTheme.primaryColor),
          ),
          const SizedBox(height: 16),
          Text(
            'No Submissions Recorded Yet',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: context.textPri,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'You haven\'t uploaded any scholarship documents yet. Submit your School ID and Landbank ATM Proof to begin verification.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              color: context.textSec,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()),
              ).then((_) => _loadProfile());
            },
            icon: const Icon(LucideIcons.uploadCloud, size: 16),
            label: const Text('Submit Documents Now', style: TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 2,
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
        backgroundColor: context.bgC,
        body: Column(
          children: [
            _buildHeader(context),
            const Expanded(
              child: Center(
                child: Text('Please log in to view submission history.'),
              ),
            ),
          ],
        ),
      );
    }

    if (_isLoadingProfile) {
      return Scaffold(
        backgroundColor: context.bgC,
        body: Column(
          children: [
            _buildHeader(context),
            const Expanded(
              child: Center(child: CircularProgressIndicator()),
            ),
          ],
        ),
      );
    }

    final submissions = _extractSubmissions();

    // Filter submissions based on _selectedFilter
    List<Map<String, dynamic>> filteredSubmissions = submissions;
    if (_selectedFilter == 'Verified') {
      filteredSubmissions = submissions.where((s) => s['status'] == 'Verified' || s['status'] == 'Approved').toList();
    } else if (_selectedFilter == 'Pending') {
      filteredSubmissions = submissions.where((s) => s['status'] != 'Verified' && s['status'] != 'Approved').toList();
    }

    final currentTerm = AcademicTermService.currentTerm;
    final studentAy = (_profileData?['academicYear'] ?? _profileData?['academic_year'] ?? '').toString();
    final studentSem = (_profileData?['semester'] ?? '').toString();
    final bool hasActiveTermSubmission = studentAy.isNotEmpty &&
        AcademicTermService.isYearMatching(studentAy, currentTerm.academicYear) &&
        (studentSem.isEmpty || AcademicTermService.isSemesterMatching(studentSem, currentTerm.semester));

    final studentNo = (_profileData?['studentId'] ?? _profileData?['student_no'] ?? '').toString().trim();
    final studentName = (_profileData?['fullName'] ?? _profileData?['full_name'] ?? '').toString().trim().toLowerCase();

    return Scaffold(
      backgroundColor: context.bgC,
      body: Column(
        children: [
          _buildHeader(context),
          Expanded(
            child: StreamBuilder<List<Map<String, dynamic>>>(
              stream: _authService.getAuditLogsStream(),
              builder: (context, snapshot) {
                List<Map<String, dynamic>> logs = [];
                if (snapshot.hasData) {
                  logs = snapshot.data!.where((data) {
                    final String logSid = (data['studentId'] ?? '').toString().trim();
                    final String logUser = (data['userName'] ?? '').toString().trim().toLowerCase();
                    final String action = (data['action'] ?? '').toString().toLowerCase();

                    final bool isStudentMatch = logSid == currentUser.id ||
                        (studentNo.isNotEmpty && logSid == studentNo) ||
                        (studentName.isNotEmpty && logUser == studentName);

                    final bool isSubmissionAction = action.contains('upload') ||
                        action.contains('submit') ||
                        action.contains('document') ||
                        action.contains('submission') ||
                        action.contains('sa number') ||
                        action.contains('id validation') ||
                        action.contains('verified') ||
                        action.contains('approved');

                    return isStudentMatch && isSubmissionAction;
                  }).toList();
                }

                final showDocuments = _selectedFilter != 'Timeline';
                final showTimeline = _selectedFilter == 'All' || _selectedFilter == 'Timeline';

                return RefreshIndicator(
                  onRefresh: _loadProfile,
                  color: AppTheme.primaryColor,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildTermBanner(context, hasActiveTermSubmission),
                              const SizedBox(height: 14),
                              if (submissions.isNotEmpty) ...[
                                _buildSummaryMetrics(submissions),
                                const SizedBox(height: 14),
                              ],
                              _buildFilterChips(),
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
                      ),

                      // Document Submissions Section
                      if (showDocuments) ...[
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Submitted Requirements',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F3260),
                                  ),
                                ),
                                if (filteredSubmissions.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryColor.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${filteredSubmissions.length} record${filteredSubmissions.length == 1 ? '' : 's'}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.primaryColor,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const SliverToBoxAdapter(child: SizedBox(height: 10)),
                        if (filteredSubmissions.isEmpty && submissions.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: _buildEmptyState(context),
                            ),
                          )
                        else if (filteredSubmissions.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: context.surfaceC,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: context.crispBorder),
                                ),
                                child: Center(
                                  child: Text(
                                    'No submissions matching filter "$_selectedFilter".',
                                    style: TextStyle(color: context.textSec, fontSize: 13),
                                  ),
                                ),
                              ),
                            ),
                          )
                        else
                          SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final item = filteredSubmissions[index];
                                return Padding(
                                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                                  child: _buildSubmissionCard(context, item),
                                );
                              },
                              childCount: filteredSubmissions.length,
                            ),
                          ),
                      ],

                      // Activity Timeline Section
                      if (showTimeline) ...[
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryColor.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(LucideIcons.gitCommit, size: 14, color: AppTheme.primaryColor),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Submission Activity Timeline',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F3260),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (snapshot.connectionState == ConnectionState.waiting && logs.isEmpty)
                          const SliverToBoxAdapter(
                            child: Center(
                              child: Padding(
                                padding: EdgeInsets.all(24),
                                child: CircularProgressIndicator(),
                              ),
                            ),
                          )
                        else if (logs.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: context.surfaceC,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: context.crispBorder),
                                ),
                                child: Center(
                                  child: Text(
                                    'No recent submission activity logs recorded.',
                                    style: TextStyle(color: context.textSec, fontSize: 13),
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
                                final String device = data['ipAddress'] ?? 'Mobile Device';
                                final formatted = _formatDateTime(data['timestamp']);

                                final isLast = index == logs.length - 1;

                                return Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 20),
                                  child: IntrinsicHeight(
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        // Vertical Timeline indicator
                                        SizedBox(
                                          width: 24,
                                          child: Column(
                                            children: [
                                              Container(
                                                width: 12,
                                                height: 12,
                                                decoration: BoxDecoration(
                                                  color: AppTheme.primaryColor,
                                                  shape: BoxShape.circle,
                                                  border: Border.all(color: Colors.white, width: 2),
                                                  boxShadow: [
                                                    BoxShadow(
                                                      color: AppTheme.primaryColor.withValues(alpha: 0.3),
                                                      blurRadius: 4,
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              if (!isLast)
                                                Expanded(
                                                  child: Container(
                                                    width: 2,
                                                    color: AppTheme.primaryColor.withValues(alpha: 0.25),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 8),

                                        // Timeline card
                                        Expanded(
                                          child: Container(
                                            margin: const EdgeInsets.only(bottom: 12),
                                            padding: const EdgeInsets.all(14),
                                            decoration: BoxDecoration(
                                              color: context.surfaceC,
                                              borderRadius: BorderRadius.circular(14),
                                              border: Border.all(color: context.crispBorder),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black.withValues(alpha: 0.02),
                                                  blurRadius: 6,
                                                  offset: const Offset(0, 2),
                                                ),
                                              ],
                                            ),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  action,
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 13,
                                                    color: context.textPri,
                                                  ),
                                                ),
                                                const SizedBox(height: 8),
                                                Row(
                                                  children: [
                                                    Icon(LucideIcons.calendar, size: 12, color: context.textSec),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      formatted.date,
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w600,
                                                        color: context.textPri,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 10),
                                                    Icon(LucideIcons.clock, size: 12, color: const Color(0xFFB45309)),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      formatted.time,
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w700,
                                                        color: Color(0xFFB45309),
                                                      ),
                                                    ),
                                                    const Spacer(),
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: context.bgC,
                                                        borderRadius: BorderRadius.circular(6),
                                                        border: Border.all(color: context.crispBorder),
                                                      ),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Icon(LucideIcons.smartphone, size: 10, color: context.textSec),
                                                          const SizedBox(width: 3),
                                                          Text(
                                                            device,
                                                            style: TextStyle(fontSize: 9.5, color: context.textSec),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                              childCount: logs.length,
                            ),
                          ),
                      ],

                      // Bottom spacing so content never gets covered by the bottom navigation bar
                      const SliverPadding(padding: EdgeInsets.only(bottom: 110)),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FormattedDateTime {
  final String date;
  final String time;
  final String fullDateTime;
  final String relative;
  final DateTime? parsedDate;

  const _FormattedDateTime({
    required this.date,
    required this.time,
    required this.fullDateTime,
    required this.relative,
    this.parsedDate,
  });
}
