import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/scholarship_service.dart';

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  bool _emailNotifications = true;
  bool _smsAlerts = false;
  bool _autoAssign = true;
  bool _requireMfa = false;
  bool _fixingTypo = false;
  bool _migratingData = false;
  bool _clearingSubmission = false;
  bool _deduplicating = false;
  bool _resettingRequirements = false;

  Future<void> _clearSubmission(String uid, String name) async {
    setState(() => _clearingSubmission = true);
    try {
      await FirebaseFirestore.instance.collection('students').doc(uid).update({
        'saNumber': null,
        'submissionPdfUrl': null,
        'submissionPdfName': null,
        'pdfVerified': false,
        'submittedAt': null,
        'status': 'Missing',
        'requiresResubmission': true,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cleared requirements submission for $name.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reset submission: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _clearingSubmission = false);
    }
  }

  Future<void> _autoDeduplicate(List<QueryDocumentSnapshot> docs, String? krishaSa, String? krishaPdf) async {
    setState(() => _deduplicating = true);
    int count = 0;
    try {
      final batch = FirebaseFirestore.instance.batch();
      for (var doc in docs) {
        final data = doc.data() as Map<String, dynamic>;
        final String name = data['fullName'] ?? 'N/A';
        final String? sa = (data['saNumber'] ?? data['familyDetails']?['saNumber'])?.toString().trim();
        final String? pdf = data['submissionPdfUrl']?.toString().trim();
        
        bool isKrisha = name.toLowerCase().contains('krisha');
        if (!isKrisha) {
          bool isDuplicate = false;
          if (krishaSa != null && krishaSa.isNotEmpty && sa == krishaSa) isDuplicate = true;
          if (krishaPdf != null && krishaPdf.isNotEmpty && pdf == krishaPdf) isDuplicate = true;

          if (isDuplicate) {
            batch.update(doc.reference, {
              'saNumber': null,
              'submissionPdfUrl': null,
              'submissionPdfName': null,
              'pdfVerified': false,
              'submittedAt': null,
              'status': 'Missing',
              'requiresResubmission': true,
            });
            count++;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Successfully deduplicated database! Reset $count duplicate records.'),
              backgroundColor: AppTheme.success,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No duplicate records detected.'),
              backgroundColor: Colors.blue,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Deduplication failed: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deduplicating = false);
    }
  }

  void _runSpellingRepair() async {
    setState(() => _fixingTypo = true);
    try {
      final sCount = await ScholarshipService().fixScholarshipTypo();
      final aCount = await AuthService().fixStudentScholarshipTypo();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Repair Complete: Fixed $sCount scholarship and $aCount student records.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Repair Failed: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _fixingTypo = false);
    }
  }

  void _runDataMigration() async {
    setState(() => _migratingData = true);
    try {
      final count = await AuthService().migrateRegistrationFields();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Migration Complete: Updated $count student records with default values.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Migration Failed: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _migratingData = false);
    }
  }

  void _runResetRequirements() async {
    setState(() => _resettingRequirements = true);
    try {
      final count = await ScholarshipService().resetAllScholarshipRequirements();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Reset Complete: Overwrote requirements for $count scholarship programs.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reset Failed: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _resettingRequirements = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 900;
        
        return SingleChildScrollView(
          padding: EdgeInsets.all(isMobile ? 12 : 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'System Settings', 
                style: isMobile 
                  ? Theme.of(context).textTheme.titleLarge 
                  : Theme.of(context).textTheme.headlineMedium
              ),
              SizedBox(height: 4),
              Text('Manage platform preferences and security configurations.', style: TextStyle(color: context.textSec)),
              SizedBox(height: 32),
              
              if (isMobile) ...[
                _buildSection('Security & Access', _buildSecuritySettings()),
                SizedBox(height: 24),
                _buildSection('Notifications', _buildNotificationSettings()),
                SizedBox(height: 24),
                _buildSection('Workflow Automations', _buildWorkflowSettings()),
                SizedBox(height: 24),
                _buildSection('System Diagnostics & Maintenance', _buildDiagnosticSettings()),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 1, 
                      child: Column(
                        children: [
                          _buildSection('Security & Access', _buildSecuritySettings()),
                          SizedBox(height: 32),
                          _buildSection('Workflow Automations', _buildWorkflowSettings()),
                          SizedBox(height: 32),
                          _buildSection('System Diagnostics & Maintenance', _buildDiagnosticSettings()),
                        ],
                      ),
                    ),
                    SizedBox(width: 32),
                    Expanded(
                      flex: 1, 
                      child: _buildSection('Notifications', _buildNotificationSettings()),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSection(String title, Widget content) {
    return Container(
      decoration: context.glassDecoration.copyWith(
        boxShadow: AppTheme.softShadow,
      ),
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            SizedBox(height: 24),
            content,
          ],
        ),
      ),
    );
  }

  Widget _buildSecuritySettings() {
    return Column(
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Require Multi-Factor Auth (MFA)', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Enforce 2FA for all administrative accounts.', style: TextStyle(fontSize: 12, color: context.textSec)),
          value: _requireMfa,
          activeTrackColor: AppTheme.primaryColor,
          onChanged: (val) => setState(() => _requireMfa = val),
        ),
        Divider(height: 32),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Change Password', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Last changed 45 days ago.', style: TextStyle(fontSize: 12, color: context.textSec)),
          trailing: Icon(LucideIcons.chevronRight, size: 18),
          onTap: () {},
        ),
        Divider(height: 32),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Active Sessions', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Manage devices currently logged into this account.', style: TextStyle(fontSize: 12, color: context.textSec)),
          trailing: Icon(LucideIcons.chevronRight, size: 18),
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildNotificationSettings() {
    return Column(
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Email Notifications', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Receive daily summaries of pending applications.', style: TextStyle(fontSize: 12, color: context.textSec)),
          value: _emailNotifications,
          activeTrackColor: AppTheme.primaryColor,
          onChanged: (val) => setState(() => _emailNotifications = val),
        ),
        Divider(height: 32),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('SMS Critical Alerts', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Get texted immediately if AI detects high-risk fraud.', style: TextStyle(fontSize: 12, color: context.textSec)),
          value: _smsAlerts,
          activeTrackColor: AppTheme.primaryColor,
          onChanged: (val) => setState(() => _smsAlerts = val),
        ),
      ],
    );
  }

  Widget _buildWorkflowSettings() {
    return Column(
      children: [
        ValueListenableBuilder<ThemeMode>(
          valueListenable: ThemeProvider().themeNotifier,
          builder: (context, theme, _) {
            return SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Dark Mode Interface', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
              subtitle: Text('Switch between Light and Slate Dark mode.', style: TextStyle(fontSize: 12, color: context.textSec)),
              value: theme == ThemeMode.dark,
              activeTrackColor: AppTheme.primaryColor,
              onChanged: (val) => ThemeProvider().toggleTheme(),
            );
          },
        ),
        Divider(height: 32),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Auto-Assign Reviewers', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Automatically round-robin incoming tasks to available admins.', style: TextStyle(fontSize: 12, color: context.textSec)),
          value: _autoAssign,
          activeTrackColor: AppTheme.primaryColor,
          onChanged: (val) => setState(() => _autoAssign = val),
        ),
        Divider(height: 32),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Machine Learning Thresholds', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          subtitle: Text('Adjust confidence limits for automatic AI rejection.', style: TextStyle(fontSize: 12, color: context.textSec)),
          trailing: Icon(LucideIcons.sliders, size: 18, color: AppTheme.primaryColor),
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildDiagnosticSettings() {
    final user = FirebaseAuth.instance.currentUser;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Security Identifiers',
          style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: context.textSec),
        ),
        SizedBox(height: 12),
        Container(
          padding: EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: context.surfaceC.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Theme.of(context).dividerColor),
          ),
          child: Column(
            children: [
              _buildDiagRow('Auth UID', user?.uid ?? 'Not Logged In'),
              Divider(height: 20),
              _buildDiagRow('Auth Email', user?.email ?? 'N/A'),
              Divider(height: 20),
              _buildDiagRow('Provider', user?.providerData.firstOrNull?.providerId ?? 'firebase'),
            ],
          ),
        ),
        SizedBox(height: 32),
        Text(
          'System Maintenance',
          style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: context.textSec),
        ),
        SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.error.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.error.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.database, size: 18, color: AppTheme.error),
                  SizedBox(width: 12),
                  Text(
                    'Deep Repair: Spelling Correction',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.error),
                  ),
                ],
              ),
              SizedBox(height: 8),
              Text(
                'This will scan your entire cloud database for the "STUFAH" typo and update all affected scholarship and student records to "STUFAP".',
                style: TextStyle(fontSize: 12, color: context.textSec),
              ),
              SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _fixingTypo ? null : _runSpellingRepair,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.error,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  minimumSize: Size(double.infinity, 45),
                ),
                icon: _fixingTypo 
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(LucideIcons.wrench, size: 16),
                label: Text(_fixingTypo ? 'Processing...' : 'Run spelling repair'),
              ),
            ],
          ),
        ),
        SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.primaryColor.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.databaseBackup, size: 18, color: AppTheme.primaryColor),
                  SizedBox(width: 12),
                  Text(
                    'Data Migration: New Registration Fields',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryColor),
                  ),
                ],
              ),
              SizedBox(height: 8),
              Text(
                'Populates missing fields (Gender, Scholar Year, Payouts, Parent Edu) for existing students. Gender is guessed based on name.',
                style: TextStyle(fontSize: 12, color: context.textSec),
              ),
              SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _migratingData ? null : _runDataMigration,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  minimumSize: Size(double.infinity, 45),
                ),
                icon: _migratingData 
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(LucideIcons.playCircle, size: 16),
                label: Text(_migratingData ? 'Migrating...' : 'Run data migration'),
              ),
            ],
          ),
        ),
        SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.secondaryColor.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.secondaryColor.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.fileSignature, size: 18, color: AppTheme.secondaryColor),
                  SizedBox(width: 12),
                  Text(
                    'Data Alignment: Reset Scholarship Requirements',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.secondaryColor),
                  ),
                ],
              ),
              SizedBox(height: 8),
              Text(
                'Overwrites the required documents list for all existing scholarship programs in Firestore to unified ["SA Number", "ID Front & Back + Signatures (PDF)"].',
                style: TextStyle(fontSize: 12, color: context.textSec),
              ),
              SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _resettingRequirements ? null : _runResetRequirements,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.secondaryColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  minimumSize: Size(double.infinity, 45),
                ),
                icon: _resettingRequirements 
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(LucideIcons.refreshCw, size: 16),
                label: Text(_resettingRequirements ? 'Resetting...' : 'Reset all programs requirements'),
              ),
            ],
          ),
        ),
        SizedBox(height: 24),
        _buildSubmissionsDiagnostics(),
        SizedBox(height: 16),
        Text(
          'Use the UID above to verify your Firestore Security Rules in the Firebase Console.',
          style: TextStyle(fontSize: 11, color: context.textSec, fontStyle: FontStyle.italic),
        ),
      ],
    );
  }

  Widget _buildSubmissionsDiagnostics() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('students').snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16.0),
              child: CircularProgressIndicator(),
            ),
          );
        }
        if (snapshot.hasError) {
          return Text('Error loading submissions: ${snapshot.error}');
        }
        
        final docs = snapshot.data?.docs ?? [];
        // Filter students who have saNumber or submissionPdfUrl
        final submittedDocs = docs.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final sa = data['saNumber'] ?? data['familyDetails']?['saNumber'];
          final hasSa = sa != null && sa.toString().trim().isNotEmpty && sa.toString().trim() != 'N/A';
          final hasPdf = data['submissionPdfUrl'] != null && data['submissionPdfUrl'].toString().isNotEmpty;
          return hasSa || hasPdf;
        }).toList();

        if (submittedDocs.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: context.surfaceC.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Theme.of(context).dividerColor),
            ),
            child: Text(
              'No active student submissions found in the database.',
              style: TextStyle(fontStyle: FontStyle.italic, color: context.textSec),
            ),
          );
        }

        // Find Krisha's submissions to identify duplicates
        String? krishaSa;
        String? krishaPdf;
        for (var doc in submittedDocs) {
          final data = doc.data() as Map<String, dynamic>;
          final name = (data['fullName'] ?? '').toString().toLowerCase();
          if (name.contains('krisha')) {
            krishaSa = (data['saNumber'] ?? data['familyDetails']?['saNumber'])?.toString().trim();
            krishaPdf = data['submissionPdfUrl']?.toString().trim();
            break;
          }
        }

        // Check if there are duplicates of Krisha's submission
        bool hasDuplicates = false;
        if (krishaSa != null || krishaPdf != null) {
          for (var doc in submittedDocs) {
            final data = doc.data() as Map<String, dynamic>;
            final String name = data['fullName'] ?? '';
            if (!name.toLowerCase().contains('krisha')) {
              final String? sa = (data['saNumber'] ?? data['familyDetails']?['saNumber'])?.toString().trim();
              final String? pdf = data['submissionPdfUrl']?.toString().trim();
              if (krishaSa != null && krishaSa.isNotEmpty && sa == krishaSa) hasDuplicates = true;
              if (krishaPdf != null && krishaPdf.isNotEmpty && pdf == krishaPdf) hasDuplicates = true;
            }
          }
        }

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.surfaceC.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Theme.of(context).dividerColor, width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Requirements Submission Diagnostics',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Real-time overview of active submissions to detect and clean duplicates.',
                          style: TextStyle(fontSize: 12, color: context.textSec),
                        ),
                      ],
                    ),
                  ),
                  if (hasDuplicates && (krishaSa != null || krishaPdf != null))
                    ElevatedButton.icon(
                      onPressed: _deduplicating ? null : () => _autoDeduplicate(submittedDocs, krishaSa, krishaPdf),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.warning,
                        foregroundColor: Colors.black,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      icon: _deduplicating 
                        ? const SizedBox(width: 10, height: 10, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : const Icon(LucideIcons.sparkles, size: 12),
                      label: Text(_deduplicating ? 'Cleaning...' : 'Auto-Deduplicate'),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: submittedDocs.length,
                separatorBuilder: (context, index) => const Divider(height: 16),
                itemBuilder: (context, index) {
                  final doc = submittedDocs[index];
                  final data = doc.data() as Map<String, dynamic>;
                  final uid = doc.id;
                  final String name = data['fullName'] ?? 'N/A';
                  final String email = data['email'] ?? 'N/A';
                  final String? sa = (data['saNumber'] ?? data['familyDetails']?['saNumber'])?.toString().trim();
                  final String? pdf = data['submissionPdfUrl']?.toString().trim();
                  final String status = data['status'] ?? 'Pending';

                  bool isKrisha = name.toLowerCase().contains('krisha');
                  bool isDuplicate = false;
                  if (!isKrisha) {
                    if (krishaSa != null && krishaSa.isNotEmpty && sa == krishaSa) isDuplicate = true;
                    if (krishaPdf != null && krishaPdf.isNotEmpty && pdf == krishaPdf) isDuplicate = true;
                  }

                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDuplicate 
                          ? AppTheme.error.withValues(alpha: 0.05) 
                          : (isKrisha ? AppTheme.success.withValues(alpha: 0.05) : Colors.transparent),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isDuplicate 
                            ? AppTheme.error.withValues(alpha: 0.2) 
                            : (isKrisha ? AppTheme.success.withValues(alpha: 0.2) : Colors.transparent)
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        name,
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: context.textPri),
                                      ),
                                      const SizedBox(width: 8),
                                      if (isKrisha)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.success,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'TARGET USER',
                                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      if (isDuplicate)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.error,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'DUPLICATE DATA',
                                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                    ],
                                  ),
                                  Text(
                                    email,
                                    style: TextStyle(fontSize: 11, color: context.textSec),
                                  ),
                                ],
                              ),
                            ),
                            if (!isKrisha)
                              TextButton.icon(
                                onPressed: _clearingSubmission ? null : () => _clearSubmission(uid, name),
                                style: TextButton.styleFrom(
                                  foregroundColor: AppTheme.error,
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                icon: const Icon(LucideIcons.trash2, size: 12),
                                label: const Text('Reset Submission'),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _diagDetailRow(context, 'SA Number', sa ?? 'None'),
                        const SizedBox(height: 4),
                        _diagDetailRow(context, 'PDF URL', pdf != null ? pdf.split('/').last.split('?').first : 'None'),
                        const SizedBox(height: 4),
                        _diagDetailRow(context, 'Status', status),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _diagDetailRow(BuildContext context, String label, String value) {
    return Row(
      children: [
        Text('$label: ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.textPri)),
        Expanded(
          child: Text(
            value,
            style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: context.textSec),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildDiagRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        SelectableText(
          value,
          style: TextStyle(fontSize: 12, fontFamily: 'monospace', color: AppTheme.primaryColor),
        ),
      ],
    );
  }
}
