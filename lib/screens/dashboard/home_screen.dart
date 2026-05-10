import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../submissions/upload_workflow_screen.dart';
import '../../services/auth_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../../services/announcement_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthService _authService = AuthService();
  final AnnouncementService _announcementService = AnnouncementService();

  Map<String, dynamic>? _profileData;
  List<Announcement> _announcements = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final uid = _authService.currentUser?.uid;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc.exists && mounted) {
        setState(() {
          _profileData = doc.data() as Map<String, dynamic>;
        });
      }
    }

    _announcementService.getActiveAnnouncements().listen(
      (list) {
        if (mounted) {
          setState(() {
            _announcements = list;
            _isLoading = false;
          });
        }
      },
      onError: (error) {
        debugPrint('Error loading announcements: $error');
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      },
    );

    // Fallback timer to disable loading after 5 seconds if no announcements emit
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted && _isLoading) {
        setState(() {
          _isLoading = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 180.0,
            pinned: true,
            elevation: 0,
            shadowColor: Colors.transparent,
            backgroundColor: const Color(0xFF0F3260),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(36),
                bottomRight: Radius.circular(36),
              ),
            ),
            flexibleSpace: LayoutBuilder(
              builder: (context, constraints) {
                final topPadding = MediaQuery.of(context).padding.top;
                final fullyExpandedHeight = 180.0;
                final fullyCollapsedHeight = topPadding + kToolbarHeight;

                // Calculate percentage of expansion (1.0 = fully expanded, 0.0 = collapsed)
                final double expandRatio =
                    ((constraints.maxHeight - fullyCollapsedHeight) /
                            (fullyExpandedHeight - fullyCollapsedHeight))
                        .clamp(0.0, 1.0);

                return ClipRRect(
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(32),
                    bottomRight: Radius.circular(32),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Transform.scale(
                        scale: 1.15,
                        child: Image.asset(
                          'assets/campus_bg.jpg',
                          fit: BoxFit.cover,
                        ),
                      ),
                      Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xCC0F3260), Color(0xDD1A4F9E)],
                          ),
                        ),
                      ),
                      // Top: Logo + app name bar
                      Positioned(
                        top: -5,
                        left: -10,
                        right: 0,
                        child: SafeArea(
                          bottom: false,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                            child: Opacity(
                              opacity: expandRatio < 0.3 ? 0.0 : expandRatio,
                              child: Row(
                                children: [
                                  Container(
                                    width: 45,
                                    height: 45,
                                    child: ClipOval(
                                      child: Image.asset(
                                        'assets/app_logo2.png',
                                        fit: BoxFit.contain,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 0),
                                  ShaderMask(
                                    shaderCallback: (bounds) =>
                                        const LinearGradient(
                                          colors: [
                                            Colors.white,
                                            Color(0xFFFBC02D),
                                          ],
                                        ).createShader(bounds),
                                    blendMode: BlendMode.srcIn,
                                    child: const Text(
                                      'ScholarDoc',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 24,
                        right: 24,
                        bottom:
                            16 +
                            (expandRatio *
                                0), // Moves up slightly when expanded
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _getGreeting(),
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize:
                                        12 + (expandRatio * 4), // 12 -> 16
                                  ),
                                ),
                                SizedBox(
                                  height: 2 + (expandRatio * 2),
                                ), // 2 -> 4
                                Text(
                                  _profileData != null
                                      ? '${_profileData!['fullName']?.toString().split(' ').first}!'
                                      : 'Student!',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize:
                                        20 + (expandRatio * 8), // 20 -> 28
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if (expandRatio > 0.5) ...[
                                  SizedBox(height: 8),
                                  _buildVerificationBadge(),
                                ],
                              ],
                            ),
                            GestureDetector(
                              onTap: () {
                                // Navigate to profile tab - handled by parent nav
                              },
                              child: () {
                                final String? photoUrl =
                                    _profileData?['profilePictureUrl']
                                        as String?;
                                final double r = 20 + (expandRatio * 8);
                                final Widget avatar =
                                    (photoUrl != null && photoUrl.isNotEmpty)
                                    ? CircleAvatar(
                                        radius: r,
                                        backgroundColor: Colors.white24,
                                        backgroundImage: NetworkImage(photoUrl),
                                      )
                                    : CircleAvatar(
                                        radius: r,
                                        backgroundColor: Colors.white24,
                                        child: Icon(
                                          LucideIcons.user,
                                          color: Colors.white,
                                          size: r,
                                        ),
                                      );
                                // Gold border ring
                                return Container(
                                  padding: const EdgeInsets.all(2.5),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFFFBC02D),
                                      width: 2.5,
                                    ),
                                  ),
                                  child: avatar,
                                );
                              }(),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildNotificationAlert(),
                  const SizedBox(height: 32),
                  _buildSectionHeader('Scholarship Status'),
                  const SizedBox(height: 16),
                  _buildStatusCard(context),
                  const SizedBox(height: 32),
                  _buildSectionHeader('Submission Progress'),
                  const SizedBox(height: 16),
                  _buildProgressTracker(),
                  const SizedBox(height: 32),
                  _buildSectionHeader('Quick Actions'),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildActionBtn(
                          context,
                          'Upload Docs',
                          LucideIcons.uploadCloud,
                          AppTheme.primaryColor,
                          () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const UploadWorkflowScreen(),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildActionBtn(
                          context,
                          'View History',
                          LucideIcons.history,
                          AppTheme.secondaryColor,
                          () {
                            // Navigate to history
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildSectionHeader('Recent Updates'),
                      TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(
                          foregroundColor: context.textSec.withValues(
                            alpha: 0.5,
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                            letterSpacing: 0.5,
                          ),
                        ),
                        child: const Text('SEE ALL'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                if (_isLoading)
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(),
                    ),
                  );
                if (_announcements.isEmpty)
                  return Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'No recent updates.',
                        style: TextStyle(color: context.textSec),
                      ),
                    ),
                  );

                final a = _announcements[index];
                return Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: 24.0,
                    vertical: 8.0,
                  ),
                  child: _buildAnnouncementWidget(context, a),
                );
              },
              childCount: _isLoading
                  ? 1
                  : (_announcements.isEmpty ? 1 : _announcements.length),
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 100)),
        ],
      ),
    );
  }

  Widget _buildStatusCard(BuildContext context) {
    final String scholarshipName =
        _profileData?['scholarshipName'] ?? 'No Scholarship Assigned';
    final String status = _profileData?['status'] ?? 'Pending';
    final String submittedDate =
        (_profileData?['submittedAt'] as Timestamp?)?.toDate().toString().split(
          ' ',
        )[0] ??
        'N/A';

    Color statusColor = AppTheme.warning;
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = AppTheme.success;
      statusIcon = LucideIcons.checkCircle2;
    }
    if (status == 'Rejected' || status == 'Needs Correction') {
      statusColor = AppTheme.error;
      statusIcon = LucideIcons.alertTriangle;
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: statusColor.withValues(alpha: 0.05),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(18.5),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: statusColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'SCHOLARSHIP ACCOUNT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: context.textSec.withValues(alpha: 0.5),
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        scholarshipName,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.primaryColor,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: statusColor.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Icon(statusIcon, size: 14, color: Colors.white),
                      const SizedBox(width: 8),
                      Text(
                        status.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Icon(
                  LucideIcons.calendarCheck,
                  size: 16,
                  color: context.textSec.withValues(alpha: 0.5),
                ),
                const SizedBox(width: 8),
                Text(
                  'Last record sync: $submittedDate',
                  style: TextStyle(
                    color: context.textSec,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                Icon(
                  LucideIcons.chevronRight,
                  size: 18,
                  color: context.textSec.withValues(alpha: 0.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationBadge() {
    final status = _profileData?['status'] ?? 'Pending';
    Color badgeColor;
    IconData badgeIcon;
    String badgeText;

    if (status == 'Approved' || status == 'Verified') {
      badgeColor = AppTheme.success;
      badgeIcon = LucideIcons.badgeCheck;
      badgeText = 'Verified Scholar';
    } else if (status == 'Rejected' || status == 'Needs Correction') {
      badgeColor = AppTheme.error;
      badgeIcon = LucideIcons.alertTriangle;
      badgeText = 'Needs Correction';
    } else {
      badgeColor = AppTheme.warning;
      badgeIcon = LucideIcons.hourglass;
      badgeText = 'Pending Approval';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(badgeIcon, size: 12, color: badgeColor),
          const SizedBox(width: 6),
          Text(
            badgeText,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: badgeColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressTracker() {
    bool hasProfile = _profileData != null;
    bool hasSA =
        (_profileData?['saNumber'] != null &&
        _profileData!['saNumber'].toString().isNotEmpty);
    bool hasID = _profileData?['idFrontUrl'] != null;

    String scholarshipType = _profileData?['scholarshipName'] ?? 'Unassigned';
    bool requiresIdOnly =
        scholarshipType == 'TES' || scholarshipType == 'STUFAP';
    bool hasBilling = _profileData?['billingUrl'] != null;

    List<Map<String, dynamic>> steps = [
      {'label': 'Profile', 'done': hasProfile},
      {'label': 'Disbursement', 'done': hasSA},
      {'label': 'Valid ID', 'done': hasID},
    ];

    if (!requiresIdOnly) {
      steps.add({'label': 'Billing', 'done': hasBilling});
    }

    const themeColor = Color(0xFF2196F3); // Processing Blue

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: themeColor.withValues(alpha: 0.1),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: themeColor.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: List.generate(steps.length * 2 - 1, (index) {
          if (index.isOdd) {
            bool isDone = steps[index ~/ 2]['done'];
            return Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(1),
                  color: isDone
                      ? themeColor
                      : themeColor.withValues(alpha: 0.1),
                ),
              ),
            );
          } else {
            int stepIdx = index ~/ 2;
            bool done = steps[stepIdx]['done'];
            return Column(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done ? themeColor : Colors.white,
                    border: Border.all(
                      color: done
                          ? themeColor
                          : themeColor.withValues(alpha: 0.2),
                      width: 2,
                    ),
                    boxShadow: done
                        ? [
                            BoxShadow(
                              color: themeColor.withValues(alpha: 0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : [],
                  ),
                  child: Icon(
                    done ? LucideIcons.check : LucideIcons.circle,
                    size: 14,
                    color: done
                        ? Colors.white
                        : themeColor.withValues(alpha: 0.3),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  steps[stepIdx]['label'],
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: done ? FontWeight.w800 : FontWeight.w600,
                    color: done
                        ? AppTheme.primaryColor
                        : themeColor.withValues(alpha: 0.4),
                  ),
                ),
              ],
            );
          }
        }),
      ),
    );
  }

  Widget _buildNotificationAlert() {
    final status = _profileData?['status'];
    if (status != 'Rejected' && status != 'Needs Correction') {
      if (_profileData != null && _profileData!['idFrontUrl'] == null) {
        return _buildAlertCard(
          'Incomplete Profile',
          'Please upload your Validation ID to continue.',
          AppTheme.warning,
        );
      }
      return const SizedBox.shrink();
    }

    return _buildAlertCard(
      'Revision Needed',
      _profileData?['adminRemarks'] ?? 'Review your document submission.',
      AppTheme.error,
    );
  }

  Widget _buildAlertCard(String title, String message, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2), width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(LucideIcons.bellRing, color: color, size: 18),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title.toUpperCase(),
                  style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: TextStyle(
                    color: color.withValues(alpha: 0.8),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Widget _buildActionBtn(
    BuildContext context,
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: color.withValues(alpha: 0.25),
                width: 2,
              ),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 26),
                ),
                const SizedBox(height: 16),
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryColor,
                    fontSize: 10,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnnouncementWidget(BuildContext context, Announcement a) {
    Color typeColor = Colors.grey;
    if (a.type == 'Deadline') typeColor = AppTheme.error;
    if (a.type == 'Update') typeColor = AppTheme.success;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: typeColor.withValues(alpha: 0.15),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: typeColor.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(2, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(16),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 5,
                  decoration: BoxDecoration(
                    color: typeColor,
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(16),
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: typeColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                a.type.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: typeColor,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                            const Spacer(),
                            Icon(
                              LucideIcons.arrowUpRight,
                              size: 14,
                              color: context.textSec.withValues(alpha: 0.3),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          a.title,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppTheme.primaryColor,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          a.content,
                          style: TextStyle(
                            color: context.textSec,
                            fontSize: 13,
                            height: 1.5,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 5,
          height: 18,
          decoration: BoxDecoration(
            color: AppTheme.accentColor,
            borderRadius: BorderRadius.circular(4),
            boxShadow: [
              BoxShadow(
                color: AppTheme.accentColor.withValues(alpha: 0.3),
                blurRadius: 4,
                offset: const Offset(1, 1),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppTheme.primaryColor,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}
