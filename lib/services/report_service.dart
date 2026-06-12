import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

class ReportService {
  final SupabaseClient _supabase = Supabase.instance.client;

  // Stream of all generated reports
  Stream<List<Map<String, dynamic>>> getReportsStream() {
    return _supabase
        .from('reports')
        .stream(primaryKey: ['id'])
        .order('createdAt', ascending: false);
  }

  // Add a new report record to history
  Future<void> addReportRecord({
    required String title,
    required String fileName,
  }) async {
    await _supabase.from('reports').insert({
      'title': title,
      'fileName': fileName,
      'status': 'Generated',
      // createdAt is handled by the DB
    });
  }

  // Aggregation for Bar Chart (Throughput)
  Stream<Map<String, List<int>>> getThroughputData(String timeframe) {
    DateTime now = DateTime.now();
    DateTime startDate;

    if (timeframe == 'This Week') {
      startDate = now.subtract(Duration(days: now.weekday - 1));
    } else if (timeframe == 'This Month') {
      startDate = DateTime(now.year, now.month, 1);
    } else {
      startDate = DateTime(now.year, 1, 1);
    }

    final StreamController<Map<String, List<int>>> controller = StreamController<Map<String, List<int>>>();
    
    List<Map<String, dynamic>>? lastStudents;
    List<Map<String, dynamic>>? lastLogs;

    void update() {
      if (lastStudents == null || lastLogs == null) return;

      List<int> submissions = [0, 0, 0, 0];
      List<int> approved = [0, 0, 0, 0];

      for (var doc in lastStudents!) {
        final timestampStr = doc['createdAt'] as String?;
        if (timestampStr != null) {
          final timestamp = DateTime.tryParse(timestampStr);
          if (timestamp != null) {
            int index = _getDateIndex(timestamp, timeframe);
            if (index >= 0 && index < 4) submissions[index]++;
          }
        }
      }

      for (var doc in lastLogs!) {
        final String action = doc['action'] ?? '';
        if (action.contains('Approved')) {
          final timestampStr = doc['timestamp'] as String?;
          if (timestampStr != null) {
            final timestamp = DateTime.tryParse(timestampStr);
            if (timestamp != null) {
              int index = _getDateIndex(timestamp, timeframe);
              if (index >= 0 && index < 4) approved[index]++;
            }
          }
        }
      }

      if (!controller.isClosed) {
        controller.add({
          'submissions': submissions,
          'approved': approved,
        });
      }
    }

    final subStudents = _supabase
        .from('students')
        .stream(primaryKey: ['uid'])
        .gte('createdAt', startDate.toIso8601String())
        .listen((s) {
      lastStudents = s;
      update();
    });

    final subLogs = _supabase
        .from('audit_logs')
        .stream(primaryKey: ['id'])
        .gte('timestamp', startDate.toIso8601String())
        .listen((l) {
      lastLogs = l;
      update();
    });

    controller.onCancel = () {
      subStudents.cancel();
      subLogs.cancel();
    };

    return controller.stream;
  }

  int _getDateIndex(DateTime date, String timeframe) {
    if (timeframe == 'This Year') {
      return ((date.month - 1) / 3).floor();
    } else if (timeframe == 'This Month') {
      return ((date.day - 1) / 7).floor();
    } else {
      int day = date.weekday;
      if (day <= 2) return 0;
      if (day <= 4) return 1;
      if (day == 5) return 2;
      return 3;
    }
  }

  // Static stats for the PDF
  Future<Map<String, int>> getInstitutionalStats() async {
    final students = await _supabase.from('students').select('status');
    
    int total = students.length;
    int approved = 0;
    int pending = 0;
    int rejected = 0;

    for (var doc in students) {
      final status = doc['status'] as String? ?? 'Pending';
      if (status == 'Approved') {
        approved++;
      } else if (status == 'Rejected') rejected++;
      else pending++;
    }

    return {
      'total': total,
      'approved': approved,
      'pending': pending,
      'rejected': rejected,
    };
  }

  // Aggregation for the 6-month submission trend
  Stream<List<double>> getMonthlySubmissionTrend() {
    DateTime now = DateTime.now();
    DateTime sixMonthsAgo = DateTime(now.year, now.month - 5, 1);

    return _supabase
        .from('students')
        .stream(primaryKey: ['uid'])
        .gte('createdAt', sixMonthsAgo.toIso8601String())
        .map((snapshot) {
      List<double> counts = List.filled(6, 0.0);
      
      for (var doc in snapshot) {
        final timestampStr = doc['createdAt'] as String?;
        if (timestampStr != null) {
          final timestamp = DateTime.tryParse(timestampStr);
          if (timestamp != null) {
            int monthDiff = (now.year - timestamp.year) * 12 + now.month - timestamp.month;
            if (monthDiff >= 0 && monthDiff < 6) {
              counts[5 - monthDiff]++;
            }
          }
        }
      }
      return counts;
    });
  }
}
