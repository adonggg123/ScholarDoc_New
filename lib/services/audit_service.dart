import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart'; // For kIsWeb
import 'dart:io'; // For Platform checking (only safe to use when not on Web)

class AuditService {
  final SupabaseClient _supabase = Supabase.instance.client;

  /// Logs a secure system audit event into Supabase
  /// [action] Summary of what happened (e.g., 'Approved SA Number')
  /// [userName] Name of the person performing the action
  /// [role] 'Admin' or 'Student'
  /// [studentId] Optional ID of the student impacted by the action
  Future<void> logActivity({
    required String action,
    required String userName,
    required String role,
    String? studentId,
  }) async {
    try {
      // Safely determine platform
      String platformInfo = 'Unknown Device';
      if (kIsWeb) {
        platformInfo = 'Web Browser';
      } else {
        try {
          if (Platform.isAndroid) {
            platformInfo = 'Android Device';
          } else if (Platform.isIOS) {
            platformInfo = 'iOS Device';
          } else if (Platform.isWindows) {
            platformInfo = 'Windows Client';
          } else if (Platform.isMacOS) {
            platformInfo = 'macOS Client';
          }
        } catch (e) {
          platformInfo = 'Unknown Desktop/Mobile';
        }
      }

      await _supabase.from('audit_logs').insert({
        'action': action,
        'userName': userName,
        'role': role,
        'studentId': studentId ?? 'N/A',
        'ipAddress': platformInfo,
        // timestamp is handled by the DB
      });
    } catch (e) {
      debugPrint('Failed to log audit activity: $e');
    }
  }

  /// Stream of latest system audit logs
  Stream<List<Map<String, dynamic>>> getAuditLogsStream({int limit = 10}) {
    return _supabase
        .from('audit_logs')
        .stream(primaryKey: ['id'])
        .order('timestamp', ascending: false)
        .limit(limit);
  }
}
