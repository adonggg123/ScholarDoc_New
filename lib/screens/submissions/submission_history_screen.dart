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
  late Stream<List<Map<String, dynamic>>> _auditStream;

  @override
  void initState() {
    super.initState();
    _auditStream = _authService.getAuditLogsStream();
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = _authService.currentUser;
    if (currentUser == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Submission History')),
        body: const Center(child: Text('Please log in.')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Submission History')),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: _auditStream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Error loading logs'));
          }
          // Filter logs for this student and submission related actions
          List<Map<String, dynamic>> docs = snapshot.data ?? [];
          docs = docs.where((data) {
            final String studentId = data['studentId'] ?? '';
            final String action = (data['action'] ?? '').toString().toLowerCase();
            // Basic filter heuristics for submission related activity
            final bool isSubmission = action.contains('upload') ||
                action.contains('submit') ||
                action.contains('document') ||
                action.contains('submission');
            return studentId == currentUser.id && isSubmission;
          }).toList();
          if (docs.isEmpty) {
            return const Center(child: Text('No submission activity yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            separatorBuilder: (_, __) => Divider(color: context.surfaceC.withValues(alpha: 0.1)),
            itemBuilder: (context, index) {
              final data = docs[index];
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
              return ListTile(
                leading: const Icon(LucideIcons.uploadCloud, size: 20, color: AppTheme.primaryColor),
                title: Text(action, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Row(
                  children: [
                    Icon(LucideIcons.clock, size: 12, color: context.textSec),
                    const SizedBox(width: 4),
                    Text(timeLabel, style: const TextStyle(fontSize: 11)),
                    const SizedBox(width: 12),
                    Icon(LucideIcons.monitor, size: 12, color: context.textSec),
                    const SizedBox(width: 4),
                    Text(device, style: const TextStyle(fontSize: 11)),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
