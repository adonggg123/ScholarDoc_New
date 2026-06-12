import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationService {
  final SupabaseClient _supabase = Supabase.instance.client;

  // Send a notification to a specific student
  Future<void> sendNotification({
    required String studentId,
    required String title,
    required String message,
    required String type, // 'success', 'warning', 'error', 'info'
  }) async {
    try {
      await _supabase.from('notifications').insert({
        'studentId': studentId,
        'title': title,
        'message': message,
        'type': type,
        'isRead': false,
        // timestamp is handled by the DB
      });
    } catch (e) {
      print('Error sending notification: $e');
    }
  }

  // Stream of notifications for a specific student
  Stream<List<Map<String, dynamic>>> getNotificationsStream(String studentId) {
    return _supabase
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('studentId', studentId)
        .order('timestamp', ascending: false);
  }

  // Mark a notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      await _supabase
          .from('notifications')
          .update({'isRead': true})
          .eq('id', notificationId);
    } catch (e) {
      print('Error marking notification as read: $e');
    }
  }

  // Mark all notifications as read for a specific student
  Future<void> markAllAsRead(String studentId) async {
    try {
      await _supabase
          .from('notifications')
          .update({'isRead': true})
          .eq('studentId', studentId)
          .eq('isRead', false);
    } catch (e) {
      print('Error marking all notifications as read: $e');
    }
  }
}
