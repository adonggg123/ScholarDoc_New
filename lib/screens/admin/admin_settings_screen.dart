import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lucide_icons/lucide_icons.dart';
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
        Text(
          'Use the UID above to verify your Firestore Security Rules in the Firebase Console.',
          style: TextStyle(fontSize: 11, color: context.textSec, fontStyle: FontStyle.italic),
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
