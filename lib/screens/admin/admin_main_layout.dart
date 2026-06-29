import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import 'admin_login_screen.dart';
import 'dashboard_overview.dart';
import 'student_records_screen.dart';
import 'sa_verification_screen.dart';
import 'scholarship_management_screen.dart';
import 'announcement_management_screen.dart';
import 'audit_log_screen.dart';
import 'reports_screen.dart';
import 'admin_settings_screen.dart';
import 'id_validation_screen.dart';

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
    const IdValidationScreen(),
  ];

  bool _isValidationExpanded = false;

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
                Divider(),
                _buildNavItem(0, 'Dashboard', LucideIcons.layoutDashboard),
                _buildNavItem(1, 'Student Records', LucideIcons.users),
                _buildNavItem(2, 'Scholarships', LucideIcons.graduationCap),
                _buildExpandableNavItem(
                  label: 'Validation',
                  icon: LucideIcons.shieldCheck,
                  isExpanded: _isValidationExpanded,
                  onExpand: (val) =>
                      setState(() => _isValidationExpanded = val),
                  children: [
                    _buildSubNavItem(
                      3,
                      'SA Verification',
                      LucideIcons.landmark,
                    ),
                    _buildSubNavItem(
                      8,
                      'ID Validation',
                      LucideIcons.badgeCheck,
                    ),
                  ],
                ),
                _buildNavItem(4, 'Announcements', LucideIcons.megaphone),
                _buildNavItem(5, 'Activity Logs', LucideIcons.history),
                _buildNavItem(6, 'Reports', LucideIcons.barChart4),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 24),
                _buildNavItem(7, 'Settings', LucideIcons.settings),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSidebarHeader() {
    return Padding(
      padding: EdgeInsets.only(top: 15, bottom: 5, left: 0, right: 27),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/app_logo3.png',
            width: 58,
            height: 58,
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

  Widget _buildExpandableNavItem({
    required String label,
    required IconData icon,
    required bool isExpanded,
    required Function(bool) onExpand,
    required List<Widget> children,
  }) {
    // Determine if any child is selected to highlight the parent
    bool hasSelectedChild = _selectedIndex == 3 || _selectedIndex == 8;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: InkWell(
              onTap: () => onExpand(!isExpanded),
              borderRadius: BorderRadius.circular(12),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: hasSelectedChild && !isExpanded
                      ? AppTheme.primaryColor.withValues(alpha: 0.1)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: hasSelectedChild
                            ? AppTheme.primaryColor
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        icon,
                        color: hasSelectedChild
                            ? Colors.white
                            : context.textSec,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 13,
                          color: hasSelectedChild
                              ? context.textPri
                              : context.textSec,
                          fontWeight: hasSelectedChild
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                    Icon(
                      isExpanded
                          ? LucideIcons.chevronDown
                          : LucideIcons.chevronRight,
                      size: 14,
                      color: context.textSec.withValues(alpha: 0.5),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 16),
              child: Column(children: children),
            ),
        ],
      ),
    );
  }

  Widget _buildSubNavItem(int index, String label, IconData icon) {
    bool isSelected = _selectedIndex == index;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
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
          borderRadius: BorderRadius.circular(10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppTheme.primaryColor.withValues(alpha: 0.05)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: isSelected ? AppTheme.primaryColor : context.textSec,
                  size: 14,
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: isSelected
                          ? AppTheme.primaryColor
                          : context.textSec,
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

  String _getPageTitle() {
    switch (_selectedIndex) {
      case 0:
        return 'Dashboard';
      case 1:
        return 'Student Records';
      case 2:
        return 'Scholarships';
      case 3:
        return 'SA Verification';
      case 4:
        return 'Announcements';
      case 5:
        return 'Activity Logs';
      case 6:
        return 'Reports';
      case 7:
        return 'Settings';
      case 8:
        return 'ID Validation';
      default:
        return 'Dashboard';
    }
  }

  IconData _getPageIcon() {
    switch (_selectedIndex) {
      case 0:
        return LucideIcons.layoutDashboard;
      case 1:
        return LucideIcons.users;
      case 2:
        return LucideIcons.graduationCap;
      case 3:
        return LucideIcons.landmark;
      case 4:
        return LucideIcons.megaphone;
      case 5:
        return LucideIcons.history;
      case 6:
        return LucideIcons.barChart4;
      case 7:
        return LucideIcons.settings;
      case 8:
        return LucideIcons.badgeCheck;
      default:
        return LucideIcons.layoutDashboard;
    }
  }

  Widget _buildTopBar(bool isMobile) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 60),
          decoration: BoxDecoration(
            color: context.surfaceC.withValues(alpha: 0.85),
            border: Border(
              bottom: BorderSide(
                color: context.isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.black.withValues(alpha: 0.06),
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              if (isMobile)
                _buildTopBarIconButton(
                  icon: LucideIcons.menu,
                  onTap: () => _scaffoldKey.currentState?.openDrawer(),
                  tooltip: 'Menu',
                ),
              if (isMobile) const SizedBox(width: 12),

              // Page context indicator
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFF0A1E3F), // Deep Navy Blue
                            Color(0xFF1E355A), // Classic Navy Blue
                            Color(0xFF7A6B43), // Warm Bronze/Gold transition
                            Color(0xFFD4AF37), // Vibrant Yellow Gold
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFF0A1E3F,
                            ).withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Icon(
                        _getPageIcon(),
                        size: 16,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _getPageTitle(),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: context.textPri,
                              letterSpacing: -0.3,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (_isSyncing)
                            Row(
                              children: [
                                SizedBox(
                                  width: 10,
                                  height: 10,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: AppTheme.primaryColor,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Syncing...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // Sync Button
              _buildTopBarIconButton(
                icon: LucideIcons.refreshCw,
                onTap: _isSyncing ? null : _refreshSystem,
                tooltip: 'Sync with Database',
                isActive: _isSyncing,
              ),
              const SizedBox(width: 6),

              // Notifications
              Stack(
                children: [
                  _buildTopBarIconButton(
                    icon: LucideIcons.bell,
                    onTap: () {},
                    tooltip: 'Notifications',
                  ),
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppTheme.error,
                        shape: BoxShape.circle,
                        border: Border.all(color: context.surfaceC, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),

              if (!isMobile) ...[
                const SizedBox(width: 12),
                // Divider
                Container(
                  height: 28,
                  width: 1,
                  color: context.textSec.withValues(alpha: 0.12),
                ),
                const SizedBox(width: 12),
                // Admin Profile Pill (clickable dropdown)
                PopupMenuButton<String>(
                  onSelected: (value) async {
                    if (value == 'logout') {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          title: const Row(
                            children: [
                              Icon(
                                LucideIcons.logOut,
                                color: AppTheme.error,
                                size: 22,
                              ),
                              SizedBox(width: 12),
                              Text('Confirm Logout'),
                            ],
                          ),
                          content: const Text(
                            'Are you sure you want to log out of the Admin Panel?',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Cancel'),
                            ),
                            ElevatedButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.error,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: const Text('Logout'),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true && mounted) {
                        await AuthService().logout();
                        if (mounted) {
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(
                              builder: (_) => const AdminLoginScreen(),
                            ),
                            (route) => false,
                          );
                        }
                      }
                    }
                  },
                  offset: const Offset(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 6,
                  itemBuilder: (_) => [
                    PopupMenuItem<String>(
                      enabled: false,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Signed in as',
                            style: TextStyle(
                              fontSize: 11,
                              color: context.textSec,
                            ),
                          ),
                          const Text(
                            'Administrator',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Divider(height: 1),
                        ],
                      ),
                    ),
                    const PopupMenuItem<String>(
                      value: 'logout',
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.logOut,
                            color: AppTheme.error,
                            size: 16,
                          ),
                          SizedBox(width: 10),
                          Text(
                            'Logout',
                            style: TextStyle(
                              color: AppTheme.error,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? Colors.white.withValues(alpha: 0.06)
                          : Colors.grey.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: context.textSec.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppTheme.primaryColor,
                                AppTheme.secondaryColor,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const CircleAvatar(
                            radius: 13,
                            backgroundColor: Colors.white,
                            child: Icon(
                              LucideIcons.user,
                              size: 14,
                              color: AppTheme.primaryColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Admin',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: context.textPri,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          LucideIcons.chevronDown,
                          size: 14,
                          color: context.textSec,
                        ),
                        const SizedBox(width: 4),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBarIconButton({
    required IconData icon,
    VoidCallback? onTap,
    String? tooltip,
    bool isActive = false,
  }) {
    final button = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isActive
                ? AppTheme.primaryColor.withValues(alpha: 0.08)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isActive ? AppTheme.primaryColor : context.textSec,
          ),
        ),
      ),
    );

    if (tooltip != null) {
      return Tooltip(message: tooltip, child: button);
    }
    return button;
  }
}
