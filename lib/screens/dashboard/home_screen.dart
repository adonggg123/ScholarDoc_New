import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../screens/submissions/submission_history_screen.dart';
import '../submissions/upload_workflow_screen.dart';
import '../notifications/notification_screen.dart';
import '../../services/auth_service.dart';
import '../../services/announcement_service.dart';
import '../../services/notification_service.dart';
import 'package:intl/intl.dart';
import 'widgets/system_banner_carousel.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthService _authService = AuthService();
  final AnnouncementService _announcementService = AnnouncementService();
  final NotificationService _notificationService = NotificationService();

  Map<String, dynamic>? _profileData;
  List<Announcement> _announcements = [];
  bool _isLoading = true;
  final Set<String> _expandedAnnouncementIds = {};

  DateTime _selectedDate = DateTime.now();
  late DateTime _startOfWeek;
  late List<DateTime> _weekDays;

  Stream<List<Map<String, dynamic>>>? _notificationStream;
  final Set<String> _shownNotificationIds = {};
  bool _isInitialLoad = true;
  OverlayEntry? _currentToastEntry;

  void _calculateWeek() {
    final today = DateTime.now();
    _startOfWeek = today.subtract(Duration(days: today.weekday % 7));
    _weekDays = List.generate(
      7,
      (index) => _startOfWeek.add(Duration(days: index)),
    );
  }

  @override
  void initState() {
    super.initState();
    _calculateWeek();
    _loadData();
    _setupNotificationListener();
  }

  @override
  void dispose() {
    if (_currentToastEntry != null) {
      _currentToastEntry!.remove();
      _currentToastEntry = null;
    }
    super.dispose();
  }

  void _setupNotificationListener() {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      _notificationStream = _notificationService.getNotificationsStream(uid).asBroadcastStream();
      _notificationStream?.listen((notifications) {
        if (!mounted) return;
        
        final unread = notifications.where((n) => !(n['isRead'] ?? true)).toList();
        
        if (_isInitialLoad) {
          // Initialize shown set with all current unread IDs to prevent startup spam
          for (var n in unread) {
            final String? id = n['id']?.toString();
            if (id != null) {
              _shownNotificationIds.add(id);
            }
          }
          _isInitialLoad = false;
          return;
        }

        // Detect new unread notifications
        for (var n in unread) {
          final String? id = n['id']?.toString();
          if (id != null && !_shownNotificationIds.contains(id)) {
            _shownNotificationIds.add(id);
            _showToastPopup(
              n['title'] ?? 'Notification',
              n['message'] ?? '',
              id,
            );
          }
        }
      });
    }
  }

  void _showToastPopup(String title, String message, String notificationId) {
    if (_currentToastEntry != null) {
      _currentToastEntry!.remove();
      _currentToastEntry = null;
    }

    _currentToastEntry = OverlayEntry(
      builder: (context) {
        return Positioned(
          top: MediaQuery.of(context).padding.top + 10,
          left: 16,
          right: 16,
          child: Material(
            color: Colors.transparent,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: -100.0, end: 0.0),
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset(0, value),
                  child: child,
                );
              },
              child: GestureDetector(
                onTap: () {
                  if (_currentToastEntry != null) {
                    _currentToastEntry!.remove();
                    _currentToastEntry = null;
                  }
                  // Mark as read immediately on click
                  _notificationService.markAsRead(notificationId);
                  // Redirect to Notifications screen
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const NotificationScreen(),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFD4AF37).withOpacity(0.3),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F3260).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          LucideIcons.bellRing,
                          color: Color(0xFF0F3260),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: Color(0xFF0F3260),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              message,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(
                        LucideIcons.chevronRight,
                        color: Color(0xFF0F3260),
                        size: 16,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );

    Overlay.of(context).insert(_currentToastEntry!);

    // Auto dismiss after 4 seconds
    Future.delayed(const Duration(seconds: 4), () {
      if (_currentToastEntry != null) {
        _currentToastEntry!.remove();
        _currentToastEntry = null;
      }
    });
  }

  Future<void> _loadData() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc != null && mounted) {
        setState(() {
          _profileData = doc;
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
    _setupNotificationListener();
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 52,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            SizedBox(
              width: 50,
              height: 50,
              child: Image.asset('assets/app_logo3.png', fit: BoxFit.contain),
            ),
            Transform.translate(
              offset: const Offset(-8, 0),
              child: ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Color(0xFF0F3260), Color(0xFFFBC02D)],
                ).createShader(bounds),
                blendMode: BlendMode.srcIn,
                child: const Text(
                  'ScholarDoc',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 21,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(50),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const NotificationScreen(),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: StreamBuilder<List<Map<String, dynamic>>>(
                    stream: _notificationStream,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        debugPrint('HomeScreen bell badge error: ${snapshot.error}');
                        return const Icon(
                          LucideIcons.bell,
                          color: Color(0xFF0F3260),
                          size: 20,
                        );
                      }
                      final notifications = snapshot.data ?? [];
                      final unreadCount = notifications.where((n) => !(n['isRead'] ?? true)).length;

                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          const Icon(
                            LucideIcons.bell,
                            color: Color(0xFF0F3260),
                            size: 20,
                          ),
                          if (unreadCount > 0)
                            Positioned(
                              right: -4,
                              top: -4,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFEF4444),
                                  shape: BoxShape.circle,
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 14,
                                  minHeight: 14,
                                ),
                                child: Center(
                                  child: Text(
                                    '$unreadCount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Container(
                height: 120.0,
                decoration: const BoxDecoration(
                  borderRadius: BorderRadius.all(Radius.circular(20)),
                  color: Color(0xFF0F3260),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.all(Radius.circular(20)),
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
                            colors: [Color(0xCC0F3260), Color(0x99FBC02D)],
                            stops: [0.3, 1.0],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 24,
                        right: 24,
                        bottom: 12,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _getGreeting().toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _profileData != null
                                      ? '${_profileData!['fullName']?.toString().split(' ').first}!'
                                      : 'Student!',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 26,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.5,
                                    height: 1.1,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                _buildVerificationBadge(),
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
                                const double r = 22.0;
                                final Widget avatar =
                                    (photoUrl != null && photoUrl.isNotEmpty)
                                    ? CircleAvatar(
                                        radius: r,
                                        backgroundColor: Colors.white24,
                                        backgroundImage: NetworkImage(
                                          photoUrl,
                                        ),
                                      )
                                    : const CircleAvatar(
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
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(
                                          0xFFFBC02D,
                                        ).withValues(alpha: 0.2),
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                      ),
                                    ],
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
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('Quick Actions'),
                  const SizedBox(height: 10),
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
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const SubmissionHistoryScreen(),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 8),
              child: const ScholarDocCarousel(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('Scholarship Status'),
                  const SizedBox(height: 10),
                  _buildStatusCard(context),
                  const SizedBox(height: 24),
                  _buildCalendarCard(context),
                  const SizedBox(height: 24),
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
                if (_isLoading) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(),
                    ),
                  );
                }
                if (_announcements.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'No recent updates.',
                        style: TextStyle(color: context.textSec),
                      ),
                    ),
                  );
                }

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
    final String submittedDate = (() {
      final ts = _profileData?['submittedAt'];
      if (ts != null) {
        try {
          return DateTime.parse(ts.toString()).toString().split(' ')[0];
        } catch (_) {}
      }
      return 'N/A';
    })();

    Color statusColor = const Color(
      0xFFF59E0B,
    ); // Vibrant Golden Yellow for Warning/Pending
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = const Color(0xFF10B981); // Vibrant Emerald Green
      statusIcon = LucideIcons.badgeCheck;
    }
    if (status == 'Rejected' || status == 'Needs Correction') {
      statusColor = const Color(0xFFEF4444); // Vibrant Crimson Red
      statusIcon = LucideIcons.alertTriangle;
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFF1F5F9), // Clean, light border
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          children: [
            // Top Section with status-themed background color accent
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    statusColor.withValues(alpha: 0.05),
                    statusColor.withValues(alpha: 0.01),
                  ],
                ),
                border: const Border(
                  bottom: BorderSide(
                    color: Color(0xFFF1F5F9), // Subtle light grey divider
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 36,
                    decoration: BoxDecoration(
                      color: statusColor,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SCHOLARSHIP ACCOUNT',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: context.textSec.withValues(alpha: 0.6),
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          scholarshipName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F3260),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: statusColor),
                        const SizedBox(width: 6),
                        Text(
                          status,
                          style: TextStyle(
                            color: statusColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Bottom Info Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9), // Slate 100
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      LucideIcons.calendarCheck,
                      size: 16,
                      color: context.textSec.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'LAST SYNCHRONIZED',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          color: context.textSec.withValues(alpha: 0.5),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        submittedDate,
                        style: const TextStyle(
                          color: Color(0xFF1E293B),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    size: 18,
                    color: context.textSec.withValues(alpha: 0.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerificationBadge() {
    final status = _profileData?['status'] ?? 'Pending';
    Color badgeColor;
    IconData badgeIcon;
    String badgeText;

    if (status == 'Approved' || status == 'Verified') {
      badgeColor = const Color(0xFF10B981); // Vibrant Emerald Green
      badgeIcon = LucideIcons.badgeCheck;
      badgeText = 'Verified Scholar';
    } else if (status == 'Rejected' || status == 'Needs Correction') {
      badgeColor = const Color(0xFFEF4444); // Vibrant Crimson Red
      badgeIcon = LucideIcons.alertTriangle;
      badgeText = 'Needs Correction';
    } else {
      badgeColor = const Color(0xFFF59E0B); // Vibrant Golden Yellow
      badgeIcon = LucideIcons.hourglass;
      badgeText = 'Pending Approval';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: badgeColor.withValues(alpha: 0.25), width: 1),
        boxShadow: [
          BoxShadow(
            color: badgeColor.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(badgeIcon, size: 13, color: badgeColor),
          const SizedBox(width: 6),
          Text(
            badgeText.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: badgeColor,
              letterSpacing: 0.8,
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFF1F5F9), // Very light gray border
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 16),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B), // Slate 800
                fontSize: 13,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnnouncementWidget(BuildContext context, Announcement a) {
    Color typeColor = const Color(0xFF64748B); // Slate Grey
    IconData typeIcon = LucideIcons.info;
    if (a.type == 'Deadline') {
      typeColor = const Color(0xFFEF4444); // Crimson
      typeIcon = LucideIcons.calendarRange;
    }
    if (a.type == 'Update') {
      typeColor = const Color(0xFF10B981); // Emerald
      typeIcon = LucideIcons.bellRing;
    }

    final bool isExpanded = _expandedAnnouncementIds.contains(a.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFE2E8F0), // Cool Grey border
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: typeColor.withValues(alpha: 0.02),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedAnnouncementIds.remove(a.id);
                } else {
                  _expandedAnnouncementIds.add(a.id);
                }
              });
            },
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Distinct side border vertical accent indicator
                  Container(
                    width: 6,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [typeColor, typeColor.withValues(alpha: 0.5)],
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
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: typeColor.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(typeIcon, size: 10, color: typeColor),
                                    const SizedBox(width: 4),
                                    Text(
                                      a.type.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 8.5,
                                        fontWeight: FontWeight.w800,
                                        color: typeColor,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                isExpanded
                                    ? LucideIcons.chevronUp
                                    : LucideIcons.chevronDown,
                                size: 16,
                                color: context.textSec.withValues(alpha: 0.4),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            a.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: Color(0xFF0F3260),
                              letterSpacing: -0.3,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 8),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeInOut,
                            child: Text(
                              a.content,
                              style: TextStyle(
                                color: context.textSec.withValues(alpha: 0.85),
                                fontSize: 13,
                                height: 1.5,
                              ),
                              maxLines: isExpanded ? null : 2,
                              overflow: isExpanded
                                  ? TextOverflow.clip
                                  : TextOverflow.ellipsis,
                            ),
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
      ),
    );
  }

  Widget _buildCalendarCard(BuildContext context) {
    final weekFormat = DateFormat('MMMM yyyy');
    final rangeFormat = DateFormat('MMM d');
    final dayLabelFormat = DateFormat('E');
    final dayNumFormat = DateFormat('d');

    final String monthYearLabel = weekFormat.format(_selectedDate);
    final String weekRangeLabel =
        'Week of ${rangeFormat.format(_weekDays.first)} – ${rangeFormat.format(_weekDays.last)}';

    final isTodaySelected = DateUtils.isSameDay(_selectedDate, DateTime.now());
    final String bottomPillLabel = isTodaySelected
        ? 'Today — ${DateFormat('EEEE, MMMM d').format(_selectedDate)}'
        : DateFormat('EEEE, MMMM d').format(_selectedDate);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    monthYearLabel,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F3260),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    weekRangeLabel,
                    style: TextStyle(
                      fontSize: 12,
                      color: context.textSec.withValues(alpha: 0.8),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.calendar,
                  color: Color(0xFF0F3260),
                  size: 20,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Days Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (index) {
              final date = _weekDays[index];
              final isSelected = DateUtils.isSameDay(date, _selectedDate);
              final isToday = DateUtils.isSameDay(date, DateTime.now());
              final dayLabel = dayLabelFormat.format(date); // Sun, Mon, etc.
              final dayNum = dayNumFormat.format(date); // 28, 29, etc.

              return Column(
                children: [
                  Text(
                    dayLabel,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected
                          ? FontWeight.bold
                          : FontWeight.w600,
                      color: isSelected
                          ? const Color(0xFF0F3260)
                          : context.textSec,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: isSelected
                            ? const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF0F3260), Color(0xFFFBC02D)],
                              )
                            : null,
                        color: isSelected
                            ? null
                            : (isToday
                                  ? const Color(
                                      0xFF0F3260,
                                    ).withValues(alpha: 0.08)
                                  : Colors.transparent),
                        border: !isSelected
                            ? Border.all(
                                color: const Color(0xFFE2E8F0),
                                width: 1,
                              )
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        dayNum,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: isSelected
                              ? Colors.white
                              : const Color(0xFF1F2937),
                        ),
                      ),
                    ),
                  const SizedBox(height: 6),
                  // Small selection dot below
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isSelected
                          ? const Color(0xFF0F3260)
                          : Colors.transparent,
                    ),
                  ),
                ],
              );
            }),
          ),
          const SizedBox(height: 16),
          // Bottom Today pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF0F3260).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF0F3260),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  bottomPillLabel,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F3260),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: AppTheme.primaryColor,
        letterSpacing: -0.5,
      ),
    );
  }
}
