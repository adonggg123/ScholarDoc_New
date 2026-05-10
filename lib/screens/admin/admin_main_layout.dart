import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'dashboard_overview.dart';
import 'student_records_screen.dart';
import 'sa_verification_screen.dart';
import 'scholarship_management_screen.dart';
import 'announcement_management_screen.dart';
import 'audit_log_screen.dart';
import 'reports_screen.dart';
import 'admin_settings_screen.dart';

class AdminMainLayout extends StatefulWidget {
  const AdminMainLayout({super.key});

  @override
  State<AdminMainLayout> createState() => _AdminMainLayoutState();
}

class _AdminMainLayoutState extends State<AdminMainLayout> {
  int _selectedIndex = 0;
  Key _syncKey = UniqueKey();
  bool _isSyncing = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  final List<Widget> _screens = [
    const DashboardOverview(),
    const StudentRecordsScreen(),
    const ScholarshipManagementScreen(),
    const SaVerificationScreen(),
    const AnnouncementManagementScreen(),
    const AuditLogScreen(),
    const ReportsScreen(),
    const AdminSettingsScreen(),
  ];

  void _refreshSystem() async {
    setState(() => _isSyncing = true);

    // Simulate a brief delay to show the syncing animation and clear any local jitter
    await Future.delayed(const Duration(milliseconds: 600));

    if (mounted) {
      setState(() {
        _syncKey = UniqueKey(); // Force rebuild of all child streams
        _isSyncing = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(LucideIcons.checkCircle, color: Colors.white, size: 20),
              SizedBox(width: 12),
              Text('System synchronized with database.'),
            ],
          ),
          backgroundColor: AppTheme.success,
          behavior: SnackBarBehavior.floating,
          width: 320,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 1100;

        return Scaffold(
          key: _scaffoldKey,
          drawer: isMobile ? _buildDrawer() : null,
          body: KeyedSubtree(
            key: _syncKey,
            child: Row(
              children: [
                // Sidebar (Persistent on desktop)
                if (!isMobile)
                  ClipRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        width: 210,
                        decoration: BoxDecoration(
                          color: context.surfaceC.withValues(alpha: 0.7),
                          border: Border(
                            right: BorderSide(
                              color: context.surfaceC.withValues(alpha: 0.2),
                            ),
                          ),
                          boxShadow: AppTheme.softShadow,
                        ),
                        child: _buildSidebarContent(),
                      ),
                    ),
                  ),
                // Main Content
                Expanded(
                  child: Column(
                    children: [
                      _buildTopBar(isMobile),
                      Expanded(
                        child: Container(
                          color: context.bgC,
                          child: _selectedIndex < _screens.length
                              ? _screens[_selectedIndex]
                              : _screens[0],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDrawer() {
    return Drawer(child: _buildSidebarContent());
  }

  Widget _buildSidebarContent() {
    return Column(
      children: [
        _buildSidebarHeader(),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                _buildNavItem(0, 'Dashboard', LucideIcons.layoutDashboard),
                _buildNavItem(1, 'Student Records', LucideIcons.users),
                _buildNavItem(2, 'Scholarships', LucideIcons.graduationCap),
                _buildNavItem(3, 'SA Verification', LucideIcons.landmark),
                _buildNavItem(4, 'Announcements', LucideIcons.megaphone),
                _buildNavItem(5, 'Activity Logs', LucideIcons.history),
                _buildNavItem(6, 'Reports', LucideIcons.barChart4),
                SizedBox(height: 24),
                Divider(),
                SizedBox(height: 24),
                _buildNavItem(7, 'Settings', LucideIcons.settings),
                SizedBox(height: 8),
                _buildLogoutItem(),
                SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSidebarHeader() {
    return Padding(
      padding: EdgeInsets.only(top: 25, bottom: 15, left: 0, right: 27),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/app_logo2.png',
            width: 60,
            height: 60,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 0),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [AppTheme.primaryColor, Color(0xFFFBC02D)],
                ).createShader(bounds),
                blendMode: BlendMode.srcIn,
                child: const Text(
                  'ScholarDoc',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Text(
                'Admin Panel',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: context.textSec,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, String label, IconData icon) {
    bool isSelected = _selectedIndex == index;
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: InkWell(
          onTap: () {
            setState(() {
              _selectedIndex = index;
            });
            if (_scaffoldKey.currentState?.isDrawerOpen ?? false) {
              Navigator.pop(context);
            }
          },
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppTheme.primaryColor.withValues(alpha: 0.1)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: AppTheme.primaryColor.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppTheme.primaryColor
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    icon,
                    color: isSelected ? Colors.white : context.textSec,
                    size: 18,
                  ),
                ),
                SizedBox(width: 12),
                Flexible(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      color: isSelected ? context.textPri : context.textSec,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogoutItem() {
    return InkWell(
      onTap: () {
        Navigator.pop(context);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(LucideIcons.logOut, color: AppTheme.error, size: 20),
            SizedBox(width: 16),
            Flexible(
              child: Text(
                'Logout',
                style: TextStyle(
                  color: AppTheme.error,
                  fontWeight: FontWeight.w500,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar(bool isMobile) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          decoration: BoxDecoration(
            color: context.surfaceC.withValues(alpha: 0.8),
            border: Border(
              bottom: BorderSide(
                color: context.surfaceC.withValues(alpha: 0.2),
              ),
            ),
            boxShadow: AppTheme.softShadow,
          ),
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            children: [
              if (isMobile)
                IconButton(
                  icon: Icon(LucideIcons.menu, size: 20),
                  onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                ),
              SizedBox(width: 8),
              Expanded(
                child: Row(
                  children: [
                    const Text(
                      'Admin Dashboard',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (_isSyncing) ...[
                      SizedBox(width: 12),
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Syncing...',
                        style: TextStyle(
                          fontSize: 12,
                          color: context.textSec,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              SizedBox(width: 8),
              // Sync Button
              Tooltip(
                message: 'Sync with Database',
                child: IconButton(
                  onPressed: _isSyncing ? null : _refreshSystem,
                  icon: Icon(
                    LucideIcons.refreshCw,
                    size: 18,
                    color: _isSyncing ? context.textSec : AppTheme.primaryColor,
                  ),
                ),
              ),
              SizedBox(width: 4),
              // Notifications
              IconButton(
                onPressed: () {},
                icon: Icon(LucideIcons.bell, size: 20),
              ),
              if (!isMobile) ...[
                SizedBox(width: 8),
                // Admin Profile
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.grey.withValues(alpha: 0.2),
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: AppTheme.secondaryColor,
                        child: Icon(
                          Icons.person,
                          size: 16,
                          color: context.surfaceC,
                        ),
                      ),
                      SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Admin User',
                          style: TextStyle(fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Icon(Icons.arrow_drop_down),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
