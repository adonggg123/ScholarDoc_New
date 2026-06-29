import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../screens/submissions/submission_history_screen.dart';
import '../submissions/upload_workflow_screen.dart';
import '../notifications/notification_screen.dart';
import '../../services/auth_service.dart';
import 'package:intl/intl.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthService _authService = AuthService();

  Map<String, dynamic>? _profileData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final uid = _authService.currentUser?.id;
    if (uid != null) {
      final doc = await _authService.getStudentProfile(uid);
      if (doc != null && mounted) {
        setState(() {
          _profileData = doc;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> submissions = [];
    if (_profileData != null && _profileData!['submittedAt'] != null) {
      final String submittedAt = (() {
        final ts = _profileData!['submittedAt'];
        if (ts != null) {
          try {
            final parsed = DateTime.parse(ts.toString());
            return DateFormat('MMM d, y – h:mm a').format(parsed);
          } catch (_) {}
        }
        return 'N/A';
      })();

      final String status = _profileData!['status'] ?? 'Pending';

      if (_profileData!['submissionPdfName'] != null) {
        submissions.add({
          'type': 'ID Capture & Digital Signature',
          'fileName': _profileData!['submissionPdfName'].toString(),
          'date': submittedAt,
          'status': status,
        });
      }

      final atmCardFileName = _profileData!['atmCardFileName'] ?? 
                              (_profileData!['documents'] is Map ? _profileData!['documents']['atmCardFileName'] : null);
      if (atmCardFileName != null) {
        submissions.add({
          'type': 'ATM Card Proof',
          'fileName': atmCardFileName.toString(),
          'date': submittedAt,
          'status': status,
        });
      }
    }

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
              width: 45,
              height: 45,
              child: ClipOval(
                child: Image.asset('assets/app_logo2.png', fit: BoxFit.contain),
              ),
            ),
            const SizedBox(width: 0),
            ShaderMask(
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
                  child: Stack(
                    children: [
                      const Icon(
                        LucideIcons.bell,
                        color: Color(0xFF0F3260),
                        size: 20,
                      ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444), // Red alert dot
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            sliver: SliverAppBar(
              expandedHeight: 150.0,
              pinned: true,
              elevation: 0,
              shadowColor: Colors.transparent,
              backgroundColor: const Color(0xFF0F3260),
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.all(Radius.circular(20)),
              ),
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  final topPadding = MediaQuery.of(context).padding.top;
                  final fullyExpandedHeight = 135.0;
                  final fullyCollapsedHeight = topPadding + kToolbarHeight;

                  // Calculate percentage of expansion (1.0 = fully expanded, 0.0 = collapsed)
                  final double expandRatio =
                      ((constraints.maxHeight - fullyCollapsedHeight) /
                              (fullyExpandedHeight - fullyCollapsedHeight))
                          .clamp(0.0, 1.0);

                  return ClipRRect(
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
                              colors: [Color(0x990F3260), Color(0x881E3A8A)],
                            ),
                          ),
                        ),
                        // Greeting section only — logo moved to top AppBar
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
                                    _getGreeting().toUpperCase(),
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize:
                                          10 + (expandRatio * 2), // 10 -> 12
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 1.2,
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
                                          24 + (expandRatio * 6), // 24 -> 30
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5,
                                      height: 1.1,
                                    ),
                                  ),
                                  if (expandRatio > 0.5) ...[
                                    const SizedBox(height: 8),
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
                                          backgroundImage: NetworkImage(
                                            photoUrl,
                                          ),
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
                  );
                },
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('Scholarship Status'),
                  const SizedBox(height: 10),
                  _buildStatusCard(context),
                  const SizedBox(height: 20),
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
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildSectionHeader('Submission History'),
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const SubmissionHistoryScreen(),
                            ),
                          );
                        },
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
                if (submissions.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Text(
                        'No submission history found.',
                        style: TextStyle(color: context.textSec),
                      ),
                    ),
                  );
                }

                final item = submissions[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24.0,
                    vertical: 8.0,
                  ),
                  child: _buildSubmissionHistoryItem(context, item),
                );
              },
              childCount: _isLoading
                  ? 1
                  : (submissions.isEmpty ? 1 : submissions.length),
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



  Widget _buildSubmissionHistoryItem(BuildContext context, Map<String, String> item) {
    final type = item['type']!;
    final fileName = item['fileName']!;
    final date = item['date']!;
    final status = item['status']!;

    Color statusColor = const Color(0xFFF59E0B);
    IconData statusIcon = LucideIcons.hourglass;
    if (status == 'Approved' || status == 'Verified') {
      statusColor = const Color(0xFF10B981);
      statusIcon = LucideIcons.badgeCheck;
    } else if (status == 'Rejected' || status == 'Needs Correction') {
      statusColor = const Color(0xFFEF4444);
      statusIcon = LucideIcons.alertTriangle;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.01),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              type.contains('ID') ? LucideIcons.fileText : LucideIcons.creditCard,
              color: AppTheme.primaryColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: Color(0xFF0F3260),
                  ),
                ),
                const SizedBox(height: 4),
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
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(LucideIcons.calendar, size: 12, color: context.textSec.withValues(alpha: 0.7)),
                    const SizedBox(width: 4),
                    Text(
                      date,
                      style: TextStyle(
                        fontSize: 11,
                        color: context.textSec.withValues(alpha: 0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 10, color: statusColor),
                const SizedBox(width: 4),
                Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
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
