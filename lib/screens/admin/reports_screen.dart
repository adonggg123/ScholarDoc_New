import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../services/auth_service.dart';
import '../../services/report_service.dart';
import '../../utils/pdf_generator.dart';
import '../../utils/excel_generator.dart';
import 'package:intl/intl.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final AuthService _authService = AuthService();
  final ReportService _reportService = ReportService();
  late Stream<QuerySnapshot> _studentsStream;
  late Stream<QuerySnapshot> _reportsHistoryStream;
  final ScrollController _horizontalScrollController = ScrollController();
  final Set<String> _selectedStudentIds = {};
  
  String _throughputTimeframe = 'This Year';
  bool _isGeneratingPdf = false;
  bool _isGeneratingExcel = false;

  @override
  void initState() {
    super.initState();
    _studentsStream = _authService.getStudentsStream();
    _reportsHistoryStream = _reportService.getReportsStream();
  }

  @override
  void dispose() {
    _horizontalScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 900;
        return SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            horizontal: isMobile ? 16 : 48,
            vertical: isMobile ? 12 : 32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(context, isMobile),
              const SizedBox(height: 48), // Increased from 32
              if (isMobile) ...[
                _buildSystemPerformance(context),
                const SizedBox(height: 32), // Increased from 24
                _buildDemographicBreakdown(context),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: _buildSystemPerformance(context)),
                    const SizedBox(width: 32),
                    Expanded(flex: 2, child: _buildDemographicBreakdown(context)),
                  ],
                ),
              const SizedBox(height: 48), // Increased from 32
              SizedBox(height: 32),
              Text('Student Master List', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: _buildExportExcelButton(context),
              ),
              SizedBox(height: 16),
              _buildStudentsTable(context),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, bool isMobile) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Analytics & Reports', 
                style: isMobile 
                  ? Theme.of(context).textTheme.titleLarge 
                  : Theme.of(context).textTheme.headlineMedium),
              SizedBox(height: 4),
              Text('Deep-dive institutional metrics and printable exports.', style: TextStyle(color: context.textSec)),
            ],
          ),
        ),
        if (!isMobile)
          _buildExportButtons(context),
      ],
    );
  }

  Widget _buildExportExcelButton(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: _isGeneratingExcel ? null : _handleExportExcel,
      icon: _isGeneratingExcel 
        ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
        : Icon(LucideIcons.fileSpreadsheet),
      label: Text(_isGeneratingExcel ? 'Excel...' : (_selectedStudentIds.isNotEmpty ? 'Export Selected' : 'Export Excel')),
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.success,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _buildExportButtons(BuildContext context) {
    return Row(
      children: [
        ElevatedButton.icon(
          onPressed: _isGeneratingPdf ? null : _handleExportPdf,
          icon: _isGeneratingPdf 
            ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Icon(LucideIcons.printer),
          label: Text(_isGeneratingPdf ? 'PDF...' : 'Export PDF'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.primaryColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Future<void> _handleExportPdf() async {
    setState(() => _isGeneratingPdf = true);
    try {
      // 1. Get Institutional Stats
      final stats = await _reportService.getInstitutionalStats();
      
      // 2. Get Department Counts (from students collection directly for simplicity here)
      final studentSnap = await FirebaseFirestore.instance.collection('students').get();
      Map<String, int> deptCounts = {'BSIT': 0, 'BTLED': 0, 'BFPT': 0};
      for (var doc in studentSnap.docs) {
        final course = doc['course'] ?? '';
        if (course.contains('BSIT')) {
          deptCounts['BSIT'] = (deptCounts['BSIT'] ?? 0) + 1;
        } else if (course.contains('BTLED')) deptCounts['BTLED'] = (deptCounts['BTLED'] ?? 0) + 1;
        else if (course.contains('BFPT')) deptCounts['BFPT'] = (deptCounts['BFPT'] ?? 0) + 1;
      }

      final title = 'Full Institutional Analysis Report';
      
      // 3. Generate PDF
      await PdfGenerator.generateInstitutionalReport(
        stats: stats,
        deptCounts: deptCounts,
        title: title,
      );

      // 4. Save to History
      await _reportService.addReportRecord(
        title: title,
        fileName: 'Institutional_Report_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report generated successfully!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate report: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isGeneratingPdf = false);
    }
  }

  Future<void> _handleExportExcel() async {
    setState(() => _isGeneratingExcel = true);
    try {
      final studentSnap = await FirebaseFirestore.instance.collection('students').get();
      List<Map<String, dynamic>> studentsList = studentSnap.docs
          .where((doc) => _selectedStudentIds.isEmpty || _selectedStudentIds.contains(doc.id))
          .map((doc) => doc.data()).toList();
      
      final title = 'Students_Data';
      
      await ExcelGenerator.exportStudentsData(
        students: studentsList,
        title: title,
      );

      await _reportService.addReportRecord(
        title: 'Students Data Excel Export',
        fileName: '${title}_${DateTime.now().millisecondsSinceEpoch}.xlsx',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Excel Report generated successfully!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate Excel report: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isGeneratingExcel = false);
    }
  }

  Widget _buildSystemPerformance(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(24),
      decoration: context.glassDecoration.copyWith(
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Application Throughput', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              DropdownButton<String>(
                value: _throughputTimeframe,
                underline: SizedBox(),
                items: ['This Week', 'This Month', 'This Year'].map((e) => DropdownMenuItem(value: e, child: Text(e, style: TextStyle(fontSize: 12)))).toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _throughputTimeframe = v);
                },
              ),
            ],
          ),
          SizedBox(height: 4),
          Text('Total documents scanned vs. approved over time.', style: TextStyle(fontSize: 12, color: context.textSec)),
          SizedBox(height: 32),
          SizedBox(
            height: 250,
            child: StreamBuilder<Map<String, List<int>>>(
              stream: _reportService.getThroughputData(_throughputTimeframe),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text('Chart error: ${snapshot.error}', style: TextStyle(fontSize: 10, color: AppTheme.error)));
                }
                
                if (!snapshot.hasData) {
                  return Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryColor.withValues(alpha: 0.5)));
                }

                final submissions = snapshot.data!['submissions']!;
                final approved = snapshot.data!['approved']!;

                // Calculate dynamic Max Y for better visibility
                double maxVal = 0;
                for (var v in [...submissions, ...approved]) {
                  if (v.toDouble() > maxVal) maxVal = v.toDouble();
                }
                double dynamicMaxY = (maxVal < 10) ? 10 : (maxVal * 1.2).ceilToDouble();

                return BarChart(
                  BarChartData(
                    alignment: BarChartAlignment.spaceAround,
                    maxY: dynamicMaxY,
                    barTouchData: BarTouchData(
                      enabled: true,
                      touchTooltipData: BarTouchTooltipData(
                        getTooltipColor: (_) => AppTheme.primaryColor.withValues(alpha: 0.8),
                        getTooltipItem: (group, groupIndex, rod, rodIndex) {
                          String label = rodIndex == 0 ? 'Submissions' : 'Approved';
                          return BarTooltipItem(
                            '$label\n',
                            const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                            children: [
                              TextSpan(
                                text: rod.toY.toInt().toString(),
                                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 30,
                          getTitlesWidget: (value, meta) => Text(value.toInt().toString(), style: TextStyle(color: context.textSec, fontSize: 10)),
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (value, meta) {
                            TextStyle style = TextStyle(color: context.textSec, fontWeight: FontWeight.bold, fontSize: 11);
                            String text;
                            if (_throughputTimeframe == 'This Year') {
                              switch (value.toInt()) {
                                case 0: text = 'Q1'; break;
                                case 1: text = 'Q2'; break;
                                case 3: text = 'Q4'; break;
                                default: text = '';
                              }
                            } else if (_throughputTimeframe == 'This Month') {
                              text = 'W${value.toInt() + 1}';
                            } else {
                              switch (value.toInt()) {
                                case 0: text = 'Mon-Tue'; break;
                                case 2: text = 'Fri'; break;
                                case 3: text = 'Sat-Sun'; break;
                                default: text = '';
                              }
                            }
                            return Padding(padding: EdgeInsets.only(top: 8), child: Text(text, style: style));
                          },
                        ),
                      ),
                    ),
                    borderData: FlBorderData(show: false),
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      getDrawingHorizontalLine: (value) => FlLine(color: Colors.grey.withValues(alpha: 0.1), strokeWidth: 1),
                    ),
                    barGroups: [
                      _makeGroupData(0, submissions[0].toDouble(), approved[0].toDouble()),
                      _makeGroupData(1, submissions[1].toDouble(), approved[1].toDouble()),
                      _makeGroupData(2, submissions[2].toDouble(), approved[2].toDouble()),
                      _makeGroupData(3, submissions[3].toDouble(), approved[3].toDouble()),
                    ],
                  ),
                );
              }
            ),
          ),
          SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _legendIndicator(context, 'Total Submissions', AppTheme.primaryColor.withValues(alpha: 0.3)),
              SizedBox(width: 16),
              _legendIndicator(context, 'Approved', AppTheme.primaryColor),
            ],
          ),
        ],
      ),
    );
  }

  BarChartGroupData _makeGroupData(int x, double y1, double y2) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y1,
          color: AppTheme.primaryColor.withValues(alpha: 0.3),
          width: 16,
          borderRadius: const BorderRadius.only(topLeft: Radius.circular(4), topRight: Radius.circular(4)),
        ),
        BarChartRodData(
          toY: y2,
          color: AppTheme.primaryColor,
          width: 16,
          borderRadius: const BorderRadius.only(topLeft: Radius.circular(4), topRight: Radius.circular(4)),
        ),
      ],
      barsSpace: 4,
    );
  }

  Widget _legendIndicator(BuildContext context, String title, Color color) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: 6),
        Text(title, style: TextStyle(fontSize: 12, color: context.textSec)),
      ],
    );
  }

  Widget _buildDemographicBreakdown(BuildContext context) {




    return Container(
      padding: EdgeInsets.all(24),
      decoration: context.glassDecoration.copyWith(
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Approval by Department', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 4),
          Text('Program-specific performance analytics.', style: TextStyle(fontSize: 12, color: context.textSec)),
          SizedBox(height: 32),
          StreamBuilder<QuerySnapshot>(
            stream: _studentsStream,
            builder: (context, snapshot) {
              if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                return SizedBox(
                  height: 200,
                  child: Center(child: Text('No student data available', style: TextStyle(color: context.textSec, fontSize: 12))),
                );
              }

              // Aggregation logic
              Map<String, int> deptCounts = {'BSIT': 0, 'BTLED': 0, 'BFPT': 0};
              int total = 0;

              for (var doc in snapshot.data!.docs) {
                final data = doc.data() as Map<String, dynamic>;
                final String course = data['course'] ?? '';
                
                String dept = 'Other';
                if (course.contains('BSIT')) {
                  dept = 'BSIT';
                } else if (course.contains('BTLED')) dept = 'BTLED';
                else if (course.contains('BFPT')) dept = 'BFPT';

                if (deptCounts.containsKey(dept)) {
                  deptCounts[dept] = deptCounts[dept]! + 1;
                  total++;
                }
              }

              if (total == 0) {
                 return SizedBox(
                  height: 200,
                  child: Center(child: Text('No student data in current departments', style: TextStyle(color: context.textSec, fontSize: 12))),
                );
              }

              return Column(
                children: [
                  SizedBox(
                    height: 200,
                    child: PieChart(
                      PieChartData(
                        sectionsSpace: 2,
                        centerSpaceRadius: 50,
                        sections: [
                          _buildPieSection(context, 'BSIT', deptCounts['BSIT']!.toDouble(), total, AppTheme.primaryColor),
                          _buildPieSection(context, 'BTLED', deptCounts['BTLED']!.toDouble(), total, AppTheme.secondaryColor),
                          _buildPieSection(context, 'BFPT', deptCounts['BFPT']!.toDouble(), total, AppTheme.success),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 32),
                  _collegeLegend('Dept. of Info. Technology (BSIT)', deptCounts['BSIT']!, total, AppTheme.primaryColor),
                  _collegeLegend('Dept. of Technical Education (BTLED)', deptCounts['BTLED']!, total, AppTheme.secondaryColor),
                  _collegeLegend('Dept. of Food Technology (BFPT)', deptCounts['BFPT']!, total, AppTheme.success),
                ],
              );
            }
          ),
        ],
      ),
    );
  }

  PieChartSectionData _buildPieSection(BuildContext context, String title, double value, int total, Color color) {
    final double percentage = (value / total) * 100;
    // Don't show labels for 0% sections to avoid clutter
    if (percentage == 0) return PieChartSectionData(value: 0.1, color: color.withValues(alpha: 0.05), radius: 30, title: '');
    
    return PieChartSectionData(
      color: color, 
      value: value, 
      title: title, 
      radius: 35 + (percentage / 10), // Dynamic radius based on size
      titleStyle: TextStyle(color: context.surfaceC, fontWeight: FontWeight.bold, fontSize: 10)
    );
  }

  Widget _collegeLegend(String name, int count, int total, Color color) {
    final String percentage = total > 0 ? '${((count / total) * 100).toStringAsFixed(0)}%' : '0%';
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
              SizedBox(width: 8),
              Text(name, style: TextStyle(fontSize: 12)),
            ],
          ),
          Text(percentage, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildStudentsTable(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: _studentsStream,
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return Container(
            padding: EdgeInsets.all(48),
            decoration: context.glassDecoration,
            child: Center(
              child: Column(
                children: [
                  Icon(LucideIcons.users, size: 48, color: context.textSec.withValues(alpha: 0.3)),
                  SizedBox(height: 16),
                  Text('No student records found.', style: TextStyle(color: context.textSec)),
                ],
              ),
            ),
          );
        }

        final students = snapshot.data!.docs;

        return Container(
          decoration: context.glassDecoration,
          width: double.infinity,
          child: Scrollbar(
            controller: _horizontalScrollController,
            thumbVisibility: true,
            trackVisibility: true,
            thickness: 8,
            radius: const Radius.circular(8),
            child: SingleChildScrollView(
              controller: _horizontalScrollController,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 16),
              child: DataTable(
              headingTextStyle: TextStyle(fontWeight: FontWeight.bold, color: context.textPri),
              dataTextStyle: TextStyle(color: context.textPri, fontSize: 13),
              columnSpacing: 24,
              showCheckboxColumn: true,
              onSelectAll: (selected) {
                setState(() {
                  if (selected == true) {
                    _selectedStudentIds.addAll(students.map((d) => d.id));
                  } else {
                    _selectedStudentIds.clear();
                  }
                });
              },
              columns: const [
                DataColumn(label: Text('Student ID')),
                DataColumn(label: Text('Full Name')),
                DataColumn(label: Text('Email')),
                DataColumn(label: Text('Gender')),
                DataColumn(label: Text('Course')),
                DataColumn(label: Text('Yr & Sec')),
                DataColumn(label: Text('Scholarship')),
                DataColumn(label: Text('Contact')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text("Father's Name")),
                DataColumn(label: Text("Father's Age")),
                DataColumn(label: Text("Father's Occupation")),
                DataColumn(label: Text("Mother's Name")),
                DataColumn(label: Text("Mother's Age")),
                DataColumn(label: Text("Mother's Occupation")),
                DataColumn(label: Text('Yearly Income')),
                DataColumn(label: Text('Religion')),
                DataColumn(label: Text('Tribe')),
              ],
              rows: students.map((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final family = data['familyDetails'] as Map<String, dynamic>? ?? {};
                
                return DataRow(
                  selected: _selectedStudentIds.contains(doc.id),
                  onSelectChanged: (selected) {
                    setState(() {
                      if (selected == true) {
                        _selectedStudentIds.add(doc.id);
                      } else {
                        _selectedStudentIds.remove(doc.id);
                      }
                    });
                  },
                  cells: [
                    DataCell(Text(data['studentId']?.toString() ?? 'N/A')),
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.1),
                            backgroundImage: (data['profilePictureUrl'] != null && data['profilePictureUrl'].toString().isNotEmpty)
                              ? NetworkImage(data['profilePictureUrl'])
                              : null,
                            child: (data['profilePictureUrl'] == null || data['profilePictureUrl'].toString().isEmpty)
                              ? Icon(LucideIcons.user, size: 14, color: AppTheme.primaryColor)
                              : null,
                          ),
                          SizedBox(width: 8),
                          Text(data['fullName']?.toString() ?? 'N/A', style: TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      )
                    ),
                    DataCell(Text(data['email']?.toString() ?? 'N/A')),
                    DataCell(Text(data['gender']?.toString() ?? 'N/A')),
                    DataCell(Text(data['courseDisplay']?.toString() ?? data['course']?.toString() ?? 'N/A')),
                    DataCell(Text('${data['year']?.toString().split(' ')[0] ?? ''} - ${data['section']?.toString() ?? ''}')),
                    DataCell(Text(data['scholarshipName']?.toString() ?? 'N/A')),
                    DataCell(Text(data['contactNumber']?.toString() ?? 'N/A')),
                    DataCell(_buildStatusBadge(data['status']?.toString() ?? 'Pending')),
                    DataCell(Text(family['fatherName']?.toString() ?? 'N/A')),
                    DataCell(Text(family['fatherAge']?.toString() ?? 'N/A')),
                    DataCell(Text(family['fatherOccupation']?.toString() ?? 'N/A')),
                    DataCell(Text(family['motherName']?.toString() ?? 'N/A')),
                    DataCell(Text(family['motherAge']?.toString() ?? 'N/A')),
                    DataCell(Text(family['motherOccupation']?.toString() ?? 'N/A')),
                    DataCell(Text(family['yearlyIncome']?.toString() ?? 'N/A')),
                    DataCell(Text(family['religion']?.toString() ?? 'N/A')),
                    DataCell(Text(family['tribe']?.toString() ?? 'N/A')),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      );
    }
  );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    switch (status) {
      case 'Approved':
      case 'Verified':
        color = AppTheme.success;
        break;
      case 'Rejected':
      case 'Missing':
        color = AppTheme.error;
        break;
      case 'Pending':
      default:
        color = AppTheme.warning;
        break;
    }
    
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(
        status,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}
