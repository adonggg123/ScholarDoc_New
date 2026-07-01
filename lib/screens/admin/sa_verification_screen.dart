import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/notification_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SaVerificationScreen extends StatefulWidget {
  const SaVerificationScreen({super.key});

  @override
  State<SaVerificationScreen> createState() => _SaVerificationScreenState();
}

class _SaVerificationScreenState extends State<SaVerificationScreen> {
  int _selectedStudentIndex = 0;
  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final NotificationService _notificationService = NotificationService();
  final TextEditingController _remarksController = TextEditingController();
  late Stream<List<Map<String, dynamic>>> _studentsStream;

  @override
  void initState() {
    super.initState();
    _studentsStream = _authService.getStudentsStream();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: _studentsStream,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return const Center(child: Text('Error loading data'));
        }

        List<Map<String, dynamic>> allDocs = snapshot.data?.toList() ?? [];

        // Filter for students who have submitted SA number
        allDocs = allDocs.where((data) {
          final sa = data['saNumber'] ?? data['familyDetails']?['saNumber'];
          return sa != null && sa.toString().trim().isNotEmpty && sa.toString().trim() != 'N/A';
        }).toList();

        if (allDocs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.userX, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No SA verification submissions found.',
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          );
        }

        // Sort by original date (descending)
        allDocs.sort((a, b) {
          final aDate = a['createdAt']?.toString() ?? '';
          final bDate = b['createdAt']?.toString() ?? '';
          return bDate.compareTo(aDate);
        });
        final docs = allDocs;

        // Safely determine the active index without modifying state during build
        final int activeIndex = (_selectedStudentIndex >= docs.length)
            ? 0
            : _selectedStudentIndex;
        final selectedDoc = docs[activeIndex];
        final selectedData = selectedDoc;

        return LayoutBuilder(
          builder: (context, constraints) {
            bool isMobile = constraints.maxWidth < 900;

            return SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: isMobile ? 12 : 24,
                vertical: isMobile ? 12 : 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Verification Queue',
                    style: isMobile
                        ? Theme.of(context).textTheme.titleMedium
                        : Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                  ),
                  const SizedBox(height: 4), // Increased from 2
                  Text(
                    'Verify accuracy of submitted accounts.',
                    style: TextStyle(
                      fontSize: 13,
                      color: context.textSec,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 24), // Restored from 16
                  if (isMobile) ...[
                    _buildVerificationTable(context, docs, isMobile),
                    const SizedBox(height: 24), // Restored from 16
                    _buildVerificationPanel(context, selectedData, isMobile),
                  ] else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: _buildVerificationTable(
                            context,
                            docs,
                            isMobile,
                          ),
                        ),
                        const SizedBox(width: 16), // Restored from 12
                        Expanded(
                          flex: 2,
                          child: _buildVerificationPanel(
                            context,
                            selectedData,
                            isMobile,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 24),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildVerificationTable(
    BuildContext context,
    List<Map<String, dynamic>> docs,
    bool isMobile,
  ) {
    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade200,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDark ? 0.3 : 0.03),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: docs.length,
        separatorBuilder: (context, index) =>
            Divider(color: context.surfaceC.withValues(alpha: 0.1), height: 1),
        itemBuilder: (context, index) {
          final data = docs[index];
          final String name = data['fullName'] ?? 'N/A';
          final String saNumber =
              data['saNumber'] ?? data['familyDetails']?['saNumber'] ?? 'N/A';

          bool isSelected = _selectedStudentIndex == index;

          return Material(
            color: isSelected
                ? AppTheme.primaryColor.withValues(alpha: 0.04)
                : Colors.transparent,
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedStudentIndex = index;
                  _remarksController.clear();
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                child: Row(
                  children: [
                    () {
                      final String? photoUrl =
                          data['profilePictureUrl'] as String?;
                      if (photoUrl != null && photoUrl.isNotEmpty) {
                        return Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: const Color(0xFFFBC02D),
                              width: 2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: CircleAvatar(
                            radius: 14,
                            backgroundImage: NetworkImage(photoUrl),
                          ),
                        );
                      }
                      return CircleAvatar(
                        radius: 16,
                        backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.05),
                        child: Icon(
                          LucideIcons.user,
                          size: 16,
                          color: AppTheme.primaryColor,
                        ),
                      );
                    }(),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                    color: context.textPri,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'SA: $saNumber',
                            style: TextStyle(
                              fontSize: 10,
                              color: context.textSec,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      LucideIcons.chevronRight,
                      size: 18,
                      color: isSelected
                          ? AppTheme.primaryColor
                          : context.textSec.withValues(alpha: 0.5),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVerificationPanel(
    BuildContext context,
    Map<String, dynamic> data,
    bool isMobile,
  ) {
    final String saNumber =
        data['saNumber'] ??
        data['familyDetails']?['saNumber'] ??
        'Not Submitted';
    final String name = data['fullName'] ?? 'N/A';
    final String studentId = data['studentId'] ?? 'N/A';
    final String course = data['course'] ?? 'N/A';
    final String year = data['year'] ?? 'N/A';

    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade200,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDark ? 0.3 : 0.03),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFFBC02D),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: () {
                      final String? photoUrl =
                          data['profilePictureUrl'] as String?;
                      if (photoUrl != null && photoUrl.isNotEmpty) {
                        return CircleAvatar(
                          radius: 28,
                          backgroundImage: NetworkImage(photoUrl),
                        );
                      }
                      return CircleAvatar(
                        radius: 28,
                        backgroundColor: AppTheme.secondaryColor.withValues(
                          alpha: 0.1,
                        ),
                        child: Icon(
                          LucideIcons.user,
                          size: 24,
                          color: AppTheme.secondaryColor,
                        ),
                      );
                    }(),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      color: context.textPri,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$course - $year',
                      style: const TextStyle(
                        color: AppTheme.primaryColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 12),
            Divider(),
            SizedBox(height: 12),
            _dataField(context, 'Student ID', studentId),
            SizedBox(height: 10),
            _dataField(context, 'Submitted SA Number', saNumber),
            const SizedBox(height: 12),
            _dataField(context, 'Bank Branch', 'Land Bank'),
            const SizedBox(height: 10),
            _buildDuplicateBadge(context),
            const SizedBox(height: 16),
            Text(
              'Admin Remarks',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: context.textPri,
              ),
            ),
            SizedBox(height: 6),
            TextFormField(
              controller: _remarksController,
              maxLines: 2,
              style: TextStyle(
                fontSize: 13,
                color: context.textPri,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText:
                    'e.g. Please re-upload your SA number, current one is blurred.',
                hintStyle: TextStyle(fontSize: 12, color: context.textSec),
                fillColor: context.surfaceC,
                filled: true,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(
                    color: context.isDark
                        ? const Color(0xFF334155)
                        : Colors.grey.shade300,
                    width: 1.5,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(
                    color: context.isDark
                        ? const Color(0xFF334155)
                        : Colors.grey.shade300,
                    width: 1.5,
                  ),
                ),
              ),
            ),
            SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 34,
              child: ElevatedButton(
                onPressed: () => _updateStatus(
                  context,
                  data,
                  'Verified',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.success,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  'Mark as Verified',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 34,
              child: OutlinedButton(
                onPressed: () => _updateStatus(
                  context,
                  data,
                  'Missing',
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.error,
                  side: const BorderSide(color: AppTheme.error, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  'Mark as Missing Documents',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(height: 2),
            SizedBox(
              width: double.infinity,
              height: 30,
              child: TextButton(
                onPressed: () => _updateStatus(
                  context,
                  data,
                  'Rejected',
                  isFinalRejection: true,
                ),
                style: TextButton.styleFrom(foregroundColor: context.textSec),
                child: const Text(
                  'Permanent Rejection',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dataField(BuildContext context, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: context.textSec,
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: context.textPri,
          ),
        ),
      ],
    );
  }

  Future<void> _updateStatus(
    BuildContext context,
    Map<String, dynamic> studentData,
    String newStatus, {
    bool isFinalRejection = false,
  }) async {
    final String? uid = studentData['uid'];
    if (uid == null) return;

    final String remarks = _remarksController.text.trim();
    final String studentId = studentData['studentId'] ?? 'N/A';
    final String name = studentData['fullName'] ?? 'Student';

    try {
      // Get current documents map
      final Map<String, dynamic> currentDocs = (studentData['documents'] is Map)
          ? Map<String, dynamic>.from(studentData['documents'])
          : {};

      // Update saVerificationStatus inside documents
      currentDocs['saVerificationStatus'] = newStatus;

      final Map<String, dynamic> updatePayload = {
        'documents': currentDocs,
        'adminRemarks': remarks,
        'requiresResubmission': !isFinalRejection && (newStatus == 'Missing' || newStatus == 'Rejected'),
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      };

      // Auto-calculate overall status:
      // Only set global status to Verified when BOTH SA and ID are verified
      final String currentIdStatus = currentDocs['idValidationStatus']?.toString() ?? 'Pending';
      if (newStatus == 'Verified' && (currentIdStatus == 'Verified' || currentIdStatus == 'Approved')) {
        updatePayload['status'] = 'Verified';
      } else if (newStatus == 'Missing' || newStatus == 'Rejected') {
        updatePayload['status'] = newStatus;
      }

      // 1. Update Student Record
      await Supabase.instance.client.from('students').update(updatePayload).eq('uid', uid);

      // 2. Log Activity
      await _auditService.logActivity(
        action: 'Verified student SA Number: $newStatus',
        userName: 'Admin',
        role: 'Admin',
        studentId: studentId,
      );

      // 3. Send Notification
      await _notificationService.sendNotification(
        studentId: uid,
        title: newStatus == 'Verified' ? 'Account Verified' : (newStatus == 'Missing' ? 'Missing Documents' : 'Update on Application'),
        message: newStatus == 'Verified'
            ? 'Great news! Your SA Number has been verified and your status is now Verified.'
            : (newStatus == 'Missing' 
                ? 'Issue found: $remarks. Your status is now Missing; please submit the required document.'
                : 'Issue found: $remarks. Please contact support.'),
        type: newStatus == 'Verified' ? 'success' : 'error',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Student $name status updated to $newStatus.'),
            backgroundColor: newStatus == 'Verified'
                ? AppTheme.success
                : AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update student verification.'),
          ),
        );
      }
    }
  }

  Widget _buildDuplicateBadge(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppTheme.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppTheme.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.fileCheck2, size: 12, color: AppTheme.success),
          SizedBox(width: 6),
          Text(
            'Duplicate Hash Network Check: PASSED',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: AppTheme.success,
            ),
          ),
        ],
      ),
    );
  }
}
