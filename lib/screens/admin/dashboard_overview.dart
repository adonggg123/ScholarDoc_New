import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/audit_service.dart';
import '../../services/report_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class DashboardOverview extends StatefulWidget {
  const DashboardOverview({super.key});

  @override
  State<DashboardOverview> createState() => _DashboardOverviewState();
}

class _DashboardOverviewState extends State<DashboardOverview> {
  final AuthService _authService = AuthService();
  final AuditService _auditService = AuditService();
  final ReportService _reportService = ReportService();

  late Stream<List<Map<String, dynamic>>> _studentsStream;
  late Stream<List<Map<String, dynamic>>> _auditLogsStream;
  late Stream<List<double>> _submissionTrendStream;

  @override
  void initState() {
    super.initState();
    _studentsStream = _authService.getStudentsStream();
    _auditLogsStream = _auditService.getAuditLogsStream(limit: 5);
    _submissionTrendStream = _reportService.getMonthlySubmissionTrend();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 900;

        if (isMobile) {
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(context, true),
                const SizedBox(height: 24),
                _buildCalendarWidget(context),
                const SizedBox(height: 24),
                _buildStatsSection(context, true),
                const SizedBox(height: 24),
                _buildSubmissionTrend(context),
                const SizedBox(height: 24),
                _buildStatusDistribution(context),
                const SizedBox(height: 24),
                _buildPendingVerifications(context),
                const SizedBox(height: 24),
                _buildRecentActivity(context),
                const SizedBox(height: 24),
              ],
            ),
          );
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Row 1: Welcome Card (full width)
              _buildHeader(context, false),
              const SizedBox(height: 16),

              // Row 2: Stats cards above Submission Trends (flex 5) | Calendar + Status Distribution (flex 3)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 5,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildStatsSection(context, false),
                        const SizedBox(height: 12),
                        _buildSubmissionTrend(context),
                      ],
                    ),
                  ),
                  const SizedBox(width: 32),
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildCalendarWidget(context),
                        const SizedBox(height: 24),
                        _buildStatusDistribution(context),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // Row 3: Pending Verifications (flex 1) & Recent Activity (flex 1) — full width
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 1,
                    child: _buildPendingVerifications(context),
                  ),
                  const SizedBox(width: 32),
                  Expanded(
                    flex: 1,
                    child: _buildRecentActivity(context),
                  ),
                ],
              ),
              const SizedBox(height: 48),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, bool isMobile) {
    final DateTime now = DateTime.now();
    final int hour = now.hour;
    final String greeting = hour < 12
        ? 'Good Morning'
        : hour < 17
            ? 'Good Afternoon'
            : 'Good Evening';
    final IconData greetingIcon = hour < 12
        ? LucideIcons.sunrise
        : hour < 17
            ? LucideIcons.sun
            : LucideIcons.moonStar;
    final String dateStr = DateFormat('EEEE, MMMM d, yyyy').format(now);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0A1E3F).withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Background Image
          Positioned.fill(
            child: Image.asset(
              'assets/campus_bg.jpg',
              fit: BoxFit.cover,
            ),
          ),
          // Gradient Overlay
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF0A1E3F).withValues(alpha: 0.95), // Deep Navy Blue
                    const Color(0xFF1E355A).withValues(alpha: 0.95), // Classic Navy Blue
                    const Color(0xFF7A6B43).withValues(alpha: 0.92), // Warm Bronze/Gold transition
                    const Color(0xFFD4AF37).withValues(alpha: 0.90), // Vibrant Yellow Gold
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          // Content
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 20 : 32,
              vertical: isMobile ? 24 : 28,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Greeting chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(greetingIcon,
                                size: 13, color: Colors.white.withValues(alpha: 0.9)),
                            const SizedBox(width: 6),
                            Text(
                              greeting,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'ScholarDoc Admin',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: isMobile ? 22 : 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Managing student scholarships and system records.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: isMobile ? 12 : 13,
                          fontWeight: FontWeight.w500,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Date pill
                      Row(
                        children: [
                          Icon(LucideIcons.calendarDays,
                              size: 13,
                              color: Colors.white.withValues(alpha: 0.7)),
                          const SizedBox(width: 6),
                          Text(
                            dateStr,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (!isMobile) ...[
                  const SizedBox(width: 24),
                  // Decorative icon badge
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                        width: 1.5,
                      ),
                    ),
                    child: const Icon(
                      LucideIcons.layoutDashboard,
                      size: 36,
                      color: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildStatsSection(BuildContext context, bool isMobile) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: _studentsStream,
      builder: (context, snapshot) {
        int total = 0;
        int pending = 0;
        int approved = 0;
        int rejected = 0;

        if (snapshot.hasData) {
          final docs = snapshot.data!;
          total = docs.length;
          for (var doc in docs) {
            final data = doc;
            final status = data['status'] ?? 'Pending';
            if (status == 'Pending') {
              pending++;
            } else if (status == 'Approved')
              approved++;
            else if (status == 'Rejected')
              rejected++;
          }
        }

        return isMobile
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      _buildStatCard(context, 'Total Students', total.toString(), LucideIcons.fileText, AppTheme.primaryColor),
                      const SizedBox(width: 16),
                      _buildStatCard(context, 'Pending Review', pending.toString(), LucideIcons.clock, AppTheme.warning),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _buildStatCard(context, 'Approved', approved.toString(), LucideIcons.checkCircle2, AppTheme.success),
                      const SizedBox(width: 16),
                      _buildStatCard(context, 'Rejected', rejected.toString(), LucideIcons.alertCircle, AppTheme.error),
                    ],
                  ),
                ],
              )
            : Row(
                children: [
                  _buildStatCard(context, 'Total Students', total.toString(), LucideIcons.fileText, AppTheme.primaryColor),
                  const SizedBox(width: 16),
                  _buildStatCard(context, 'Pending Review', pending.toString(), LucideIcons.clock, AppTheme.warning),
                  const SizedBox(width: 16),
                  _buildStatCard(context, 'Approved', approved.toString(), LucideIcons.checkCircle2, AppTheme.success),
                  const SizedBox(width: 16),
                  _buildStatCard(context, 'Rejected', rejected.toString(), LucideIcons.alertCircle, AppTheme.error),
                ],
              );
      },
    );
  }

  Widget _buildStatCard(
    BuildContext context,
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Expanded(
      child: Container(
        decoration: context.crispDecoration.copyWith(
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: color.withValues(alpha: 0.2),
                        width: 1.0,
                      ),
                    ),
                    child: Icon(icon, color: color, size: 14),
                  ),
                  Icon(
                    LucideIcons.moreHorizontal,
                    size: 12,
                    color: context.textSec.withValues(alpha: 0.3),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  height: 1.1,
                  color: context.textPri,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: context.textSec,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCalendarWidget(BuildContext context) {
    final DateTime now = DateTime.now();

    // Find the Sunday that starts the current week
    final int todayWeekday = now.weekday % 7; // Sun=0, Mon=1, … Sat=6
    final DateTime weekStart = now.subtract(Duration(days: todayWeekday));

    final List<String> dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final List<DateTime> weekDays = List.generate(7, (i) => weekStart.add(Duration(days: i)));

    final String monthLabel = DateFormat('MMMM yyyy').format(now);
    final String weekRange =
        '${DateFormat('MMM d').format(weekStart)} – ${DateFormat('MMM d').format(weekStart.add(const Duration(days: 6)))}';

    return Container(
      decoration: BoxDecoration(
        color: context.surfaceC,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Header ──────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    monthLabel,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: context.textPri,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Week of $weekRange',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: context.textSec,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  LucideIcons.calendarDays,
                  size: 18,
                  color: AppTheme.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Week Row ─────────────────────────────────────────────────
          Row(
            children: List.generate(7, (i) {
              final DateTime day = weekDays[i];
              final bool isToday = day.year == now.year &&
                  day.month == now.month &&
                  day.day == now.day;
              final bool isWeekend = i == 0 || i == 6;

              return Expanded(
                child: Column(
                  children: [
                    // Day label
                    Text(
                      dayLabels[i],
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                        color: isToday
                            ? AppTheme.primaryColor
                            : isWeekend
                                ? context.textSec.withValues(alpha: 0.5)
                                : context.textSec,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Date bubble
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: isToday
                            ? const LinearGradient(
                                colors: [
                                  Color(0xFF0A1E3F), // Deep Navy Blue
                                  Color(0xFF1E355A), // Classic Navy Blue
                                  Color(0xFF7A6B43), // Warm Bronze/Gold transition
                                  Color(0xFFD4AF37), // Vibrant Yellow Gold
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        color: isToday ? null : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: isToday
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF0A1E3F).withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ]
                            : null,
                        border: isToday
                            ? null
                            : Border.all(
                                color: context.textSec.withValues(
                                    alpha: isWeekend ? 0.08 : 0.12),
                                width: 1,
                              ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        day.day.toString(),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isToday ? FontWeight.w700 : FontWeight.w500,
                          color: isToday
                              ? Colors.white
                              : isWeekend
                                  ? context.textSec.withValues(alpha: 0.4)
                                  : context.textPri,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    // Today dot indicator
                    AnimatedOpacity(
                      opacity: isToday ? 1.0 : 0.0,
                      duration: const Duration(milliseconds: 200),
                      child: Container(
                        width: 4,
                        height: 4,
                        decoration: const BoxDecoration(
                          color: AppTheme.primaryColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),

          const SizedBox(height: 16),

          // ── Today label ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Today — ${DateFormat('EEEE, MMMM d').format(now)}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmissionTrend(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: context.crispDecoration.copyWith(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Submission Trends',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: context.textPri,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Last 6 Months',
                  style: TextStyle(
                    fontSize: 9,
                    color: AppTheme.primaryColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            'Weekly document submission counts',
            style: TextStyle(
              color: context.textSec,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 250,
            child: StreamBuilder<List<double>>(
              stream: _submissionTrendStream,
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppTheme.primaryColor.withValues(alpha: 0.3),
                    ),
                  );
                }

                final dataPoints = snapshot.data!;
                final List<FlSpot> spots = [];
                for (int i = 0; i < dataPoints.length; i++) {
                  spots.add(FlSpot(i.toDouble(), dataPoints[i]));
                }

                return LineChart(
                  LineChartData(
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      getDrawingHorizontalLine: (value) => FlLine(
                        color: Colors.grey.withValues(alpha: 0.1),
                        strokeWidth: 1,
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                      topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: 1,
                          reservedSize: 30,
                          getTitlesWidget: (value, meta) => Text(
                            value.toInt().toString(),
                            style: TextStyle(
                              color: context.textSec,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: 1,
                          getTitlesWidget: (value, meta) {
                            final now = DateTime.now();
                            final months = [];
                            for (int i = 5; i >= 0; i--) {
                              months.add(
                                DateFormat(
                                  'MMM',
                                ).format(DateTime(now.year, now.month - i, 1)),
                              );
                            }
                            if (value == value.toInt() &&
                                value >= 0 &&
                                value < months.length) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 6.0),
                                child: Text(
                                  months[value.toInt()],
                                  style: TextStyle(
                                    color: context.textSec,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              );
                            }
                            return const Text('');
                          },
                        ),
                      ),
                    ),
                    borderData: FlBorderData(show: false),
                    lineBarsData: [
                      LineChartBarData(
                        spots: spots.isEmpty ? [FlSpot(0, 0)] : spots,
                        isCurved: true,
                        gradient: const LinearGradient(
                          colors: [
                            AppTheme.primaryColor,
                            AppTheme.secondaryColor,
                          ],
                        ),
                        barWidth: 4,
                        isStrokeCapRound: true,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          gradient: LinearGradient(
                            colors: [
                              AppTheme.primaryColor.withValues(alpha: 0.2),
                              AppTheme.primaryColor.withValues(alpha: 0),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusDistribution(BuildContext context) {
    return StreamBuilder<List<Map<String, dynamic>>>(
      stream: _studentsStream,
      builder: (context, snapshot) {
        double pending = 0;
        double approved = 0;
        double rejected = 0;
        double total = 0;

        if (snapshot.hasData) {
          final docs = snapshot.data!;
          total = docs.length.toDouble();
          for (var doc in docs) {
            final data = doc;
            final status = data['status'] ?? 'Pending';
            if (status == 'Pending') {
              pending++;
            } else if (status == 'Approved')
              approved++;
            else if (status == 'Rejected')
              rejected++;
          }
        }

        bool hasData = total > 0;
        double pPer = hasData ? (pending / total) * 100 : 0;
        double aPer = hasData ? (approved / total) * 100 : 0;
        double rPer = hasData ? (rejected / total) * 100 : 0;

        return Container(
          decoration: context.glassDecoration.copyWith(
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Status Distribution',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: context.textPri,
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 130,
                  child: hasData
                      ? PieChart(
                          PieChartData(
                            sectionsSpace: 4,
                            centerSpaceRadius: 35,
                            sections: [
                              if (approved > 0)
                                PieChartSectionData(
                                  color: AppTheme.success,
                                  value: approved,
                                  title: '${aPer.toStringAsFixed(0)}%',
                                  radius: 40,
                                  titleStyle: TextStyle(
                                    color: context.surfaceC,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              if (pending > 0)
                                PieChartSectionData(
                                  color: AppTheme.warning,
                                  value: pending,
                                  title: '${pPer.toStringAsFixed(0)}%',
                                  radius: 40,
                                  titleStyle: TextStyle(
                                    color: context.surfaceC,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              if (rejected > 0)
                                PieChartSectionData(
                                  color: AppTheme.error,
                                  value: rejected,
                                  title: '${rPer.toStringAsFixed(0)}%',
                                  radius: 40,
                                  titleStyle: TextStyle(
                                    color: context.surfaceC,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                            ],
                          ),
                        )
                      : Center(child: Text('No data')),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    _buildLegendItem(context, 'Approved', AppTheme.success),
                    _buildLegendItem(context, 'Pending', AppTheme.warning),
                    _buildLegendItem(context, 'Rejected', AppTheme.error),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLegendItem(BuildContext context, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: context.textPri,
          ),
        ),
      ],
    );
  }

  Widget _buildRecentActivity(BuildContext context) {
    return Container(
      decoration: context.glassDecoration.copyWith(
        boxShadow: AppTheme.softShadow,
      ),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recent System Activity',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: _auditLogsStream,
              builder: (context, snapshot) {
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text(
                        'No system logs available.',
                        style: TextStyle(color: context.textSec, fontSize: 13),
                      ),
                    ),
                  );
                }

                final docs = snapshot.data!;

                return ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: docs.length,
                  separatorBuilder: (context, index) => Divider(),
                  itemBuilder: (context, index) {
                    final data = docs[index];
                    final String adminName = data['adminName'] ?? 'System';
                    final String action =
                        data['action'] ?? 'Performed an action';
                    final String role = data['role'] ?? 'System';
                    final String? tsStr = data['timestamp']?.toString() ?? data['createdAt']?.toString();
                    final DateTime? ts = tsStr != null ? DateTime.tryParse(tsStr) : null;
                    final String timeStr = ts != null
                        ? DateFormat('hh:mm a').format(ts.toLocal())
                        : 'Just now';

                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor:
                            (role == 'Admin'
                                    ? AppTheme.primaryColor
                                    : AppTheme.secondaryColor)
                                .withValues(alpha: 0.1),
                        child: Icon(
                          role == 'Admin'
                              ? LucideIcons.shieldCheck
                              : LucideIcons.user,
                          size: 18,
                          color: role == 'Admin'
                              ? AppTheme.primaryColor
                              : AppTheme.secondaryColor,
                        ),
                      ),
                      title: RichText(
                        text: TextSpan(
                          style: TextStyle(
                            color: context.textPri,
                            fontSize: 13,
                          ),
                          children: [
                            TextSpan(
                              text: adminName,
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            TextSpan(text: ' $action'),
                          ],
                        ),
                      ),
                      subtitle: Text(
                        timeStr,
                        style: TextStyle(fontSize: 11, color: context.textSec),
                      ),
                      trailing: role == 'Admin'
                          ? Icon(
                              LucideIcons.check,
                              size: 14,
                              color: AppTheme.success,
                            )
                          : null,
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingVerifications(BuildContext context) {
    return Container(
      decoration: context.glassDecoration.copyWith(
        boxShadow: AppTheme.softShadow,
      ),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  LucideIcons.fileCheck,
                  color: AppTheme.primaryColor,
                  size: 18,
                ),
                SizedBox(width: 8),
                Text(
                  'Pending Verification',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            SizedBox(height: 4),
            Text(
              'Students waiting for document review',
              style: TextStyle(fontSize: 12, color: context.textSec),
            ),
            SizedBox(height: 16),
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: _studentsStream,
              builder: (context, snapshot) {
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text(
                        'No pending data available.',
                        style: TextStyle(color: context.textSec, fontSize: 13),
                      ),
                    ),
                  );
                }

                // Filter for pending students
                final pendingStudents = snapshot.data!
                    .where((doc) {
                      final data = doc;
                      return data['status'] == 'Pending';
                    })
                    .take(4)
                    .toList();

                if (pendingStudents.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text(
                        'All documents verified.',
                        style: TextStyle(color: AppTheme.success, fontSize: 13),
                      ),
                    ),
                  );
                }

                return ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: pendingStudents.length,
                  separatorBuilder: (context, index) => Divider(),
                  itemBuilder: (context, index) {
                    final data = pendingStudents[index];
                    final String name = data['fullName'] ?? 'N/A';
                    final String id = data['studentId'] ?? 'N/A';
                    final String photoUrl = data['profilePictureUrl'] ?? '';

                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: photoUrl.isNotEmpty
                          ? CircleAvatar(
                              backgroundImage: NetworkImage(photoUrl),
                            )
                          : CircleAvatar(
                              backgroundColor: AppTheme.primaryColor.withValues(
                                alpha: 0.1,
                              ),
                              child: Icon(
                                LucideIcons.user,
                                size: 18,
                                color: AppTheme.primaryColor,
                              ),
                            ),
                      title: Text(
                        name,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      subtitle: Text('ID: $id', style: TextStyle(fontSize: 11)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.warning.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'PENDING',
                          style: TextStyle(
                            color: AppTheme.warning,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
