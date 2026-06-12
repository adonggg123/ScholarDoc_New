import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/notification_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class IdValidationScreen extends StatefulWidget {
  const IdValidationScreen({super.key});

  @override
  State<IdValidationScreen> createState() => _IdValidationScreenState();
}

class _IdValidationScreenState extends State<IdValidationScreen> {
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

        List<Map<String, dynamic>> docs = snapshot.data?.toList() ?? [];

        // Filter for students who have submitted documents
        docs = docs.where((data) {
          return data['submissionPdfUrl'] != null || 
                 data['idFrontUrl'] != null || 
                 data['idBackUrl'] != null;
        }).toList();

        if (docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.userX, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No ID submissions found.',
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          );
        }

        // Sort by date
        docs.sort((a, b) {
          final aDate = a['createdAt']?.toString() ?? '';
          final bDate = b['createdAt']?.toString() ?? '';
          return bDate.compareTo(aDate);
        });

        final int activeIndex = (_selectedStudentIndex >= docs.length) ? 0 : _selectedStudentIndex;
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
                    'ID Validation Queue',
                    style: isMobile
                        ? Theme.of(context).textTheme.titleMedium
                        : Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Validate student IDs and signatures for application finalization.',
                    style: TextStyle(
                      fontSize: 13,
                      color: context.textSec,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (isMobile) ...[
                    _buildStudentTable(context, docs, isMobile),
                    const SizedBox(height: 24),
                    _buildValidationPanel(context, selectedData, isMobile),
                  ] else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: _buildStudentTable(context, docs, isMobile),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          flex: 2,
                          child: _buildValidationPanel(context, selectedData, isMobile),
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

  Widget _buildStudentTable(BuildContext context, List<Map<String, dynamic>> docs, bool isMobile) {
    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
          width: 1.5,
        ),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: docs.length,
        separatorBuilder: (context, index) => Divider(color: context.surfaceC.withValues(alpha: 0.1), height: 1),
        itemBuilder: (context, index) {
          final data = docs[index];
          final String name = data['fullName'] ?? 'N/A';
          final String studentId = data['studentId'] ?? 'N/A';
          bool isSelected = _selectedStudentIndex == index;

          return Material(
            color: isSelected ? AppTheme.primaryColor.withValues(alpha: 0.04) : Colors.transparent,
            child: InkWell(
              onTap: () => setState(() {
                _selectedStudentIndex = index;
                _remarksController.clear();
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundImage: data['profilePictureUrl'] != null 
                          ? NetworkImage(data['profilePictureUrl']) 
                          : null,
                      child: data['profilePictureUrl'] == null ? const Icon(LucideIcons.user, size: 16) : null,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text('ID: $studentId', style: TextStyle(fontSize: 11, color: context.textSec)),
                        ],
                      ),
                    ),
                    Icon(LucideIcons.chevronRight, size: 18, color: isSelected ? AppTheme.primaryColor : Colors.grey),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildValidationPanel(BuildContext context, Map<String, dynamic> data, bool isMobile) {
    final String name = data['fullName'] ?? 'N/A';
    final String studentId = data['studentId'] ?? 'N/A';
    final String? pdfUrl = data['submissionPdfUrl'];
    final String? idFrontUrl = data['idFrontUrl'];
    final String? idBackUrl = data['idBackUrl'];

    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Submission Details', style: TextStyle(fontWeight: FontWeight.bold, color: context.textPri)),
            const SizedBox(height: 16),
            _infoRow('Student Name', name),
            _infoRow('Student ID', studentId),
            const Divider(height: 32),
            Text('ID Documents', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 12),
            if (idFrontUrl != null) _documentTile('Front ID Image', 'ID_Front.jpg', idFrontUrl, LucideIcons.image),
            if (idBackUrl != null) _documentTile('Back ID Image', 'ID_Back.jpg', idBackUrl, LucideIcons.image),
            if (pdfUrl != null) _documentTile('ID Front & Back + Signatures (PDF)', data['submissionPdfName'] ?? 'Submission.pdf', pdfUrl, LucideIcons.fileText),
            if (idFrontUrl == null && idBackUrl == null && pdfUrl == null)
              const Text('No documents uploaded', style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 24),
            Text('Admin Remarks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            TextField(
              controller: _remarksController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Enter feedback for student...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                fillColor: context.surfaceC,
                filled: true,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _updateStatus(context, data['uid'], 'Verified'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success, foregroundColor: Colors.white),
                    child: const Text('Accepted'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _updateStatus(context, data['uid'], 'Missing'),
                    style: OutlinedButton.styleFrom(foregroundColor: AppTheme.error, side: const BorderSide(color: AppTheme.error)),
                    child: const Text('Invalid/Missing'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: context.textSec)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _documentTile(String label, String fileName, String url, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: context.surfaceC.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.crispBorder),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppTheme.primaryColor),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  Text(fileName, style: TextStyle(fontSize: 10, color: context.textSec)),
                ],
              ),
            ),
            TextButton(
              onPressed: () async {
                final uri = Uri.parse(url);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              child: const Text(
                'View',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _updateStatus(BuildContext context, String? uid, String newStatus) async {
    if (uid == null) return;
    try {
      await Supabase.instance.client.from('students').update({
        'idValidationStatus': newStatus,
        'adminRemarks': _remarksController.text.trim(),
      }).eq('uid', uid);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('ID status updated to $newStatus')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Update failed')));
    }
  }
}
