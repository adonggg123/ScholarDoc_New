import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

/// Service responsible for managing SMS communications in ScholarDoc.
/// 
/// SECURITY NOTE: In compliance with security requirements, the Semaphore
/// API credentials are never stored or exposed within this client code.
/// All SMS transmissions are routed securely through the backend server
/// or Supabase Edge Functions.
class SmsService {
  static final SmsService _instance = SmsService._internal();
  factory SmsService() => _instance;
  SmsService._internal();

  final SupabaseClient _supabase = Supabase.instance.client;

  /// Default server URL for local development/emulator
  static String get serverBaseUrl {
    if (kIsWeb) return '';
    // Android emulator alias for host machine
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080';
    }
    return 'http://localhost:8080';
  }

  /// Normalizes any Philippine mobile phone number into standard '09XXXXXXXXX' format.
  /// Valid formats include:
  /// - 09171234567
  /// - +639171234567
  /// - 639171234567
  /// - 9171234567
  /// - 0917-123-4567
  static String? normalizePhilippineMobile(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    String digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('63') && digits.length == 12) {
      digits = '0${digits.substring(2)}';
    } else if (digits.startsWith('9') && digits.length == 10) {
      digits = '0$digits';
    }
    if (RegExp(r'^09\d{9}$').hasMatch(digits)) {
      return digits;
    }
    return null;
  }

  /// Checks if the given mobile number is a valid Philippine mobile number.
  static bool isValidPhilippineMobile(String? raw) {
    return normalizePhilippineMobile(raw) != null;
  }

  /// Sends an event-driven SMS notification to a student via the secure backend.
  Future<Map<String, dynamic>> sendStudentSms({
    required String studentId,
    String? phone,
    String eventType = 'custom',
    String? message,
    String? feedback,
    bool force = false,
  }) async {
    final payload = {
      'student_id': studentId,
      'uid': studentId,
      'phone': normalizePhilippineMobile(phone),
      'event_type': eventType,
      'message': message,
      'feedback': feedback,
      'force': force,
    };

    // 1. Attempt local server API
    try {
      final uri = Uri.parse('$serverBaseUrl/api/sms/send');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return jsonDecode(res.body);
      }
    } catch (_) {
      // Local server unavailable or timed out; fallback to Supabase Edge Function
    }

    // 2. Fallback to Supabase Edge Function
    try {
      final res = await _supabase.functions.invoke(
        'send-sms-notification',
        body: payload,
      );
      if (res.data != null) {
        return Map<String, dynamic>.from(res.data);
      }
    } catch (e) {
      debugPrint('SmsService: Edge function invocation failed: $e');
    }

    return {
      'success': false,
      'error': 'SMS service is temporarily unreachable.',
    };
  }

  /// Fetches Semaphore account status and credit balance via server.
  Future<Map<String, dynamic>> checkAccountStatus() async {
    try {
      final uri = Uri.parse('$serverBaseUrl/api/sms/account');
      final res = await http.get(uri).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (_) {}

    try {
      final res = await _supabase.functions.invoke(
        'send-sms-notification',
        body: {'action': 'account'},
      );
      if (res.data != null) {
        return Map<String, dynamic>.from(res.data);
      }
    } catch (_) {}

    return {
      'configured': false,
      'status': 'offline',
      'message': 'Cannot reach SMS server',
    };
  }

  /// Stream of SMS delivery logs for a student from Supabase.
  Stream<List<Map<String, dynamic>>> getStudentSmsLogsStream(String studentId) {
    return _supabase
        .from('sms_logs')
        .stream(primaryKey: ['id'])
        .eq('student_id', studentId)
        .order('sent_at', ascending: false);
  }
}
