// ignore_for_file: avoid_print
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final SupabaseClient _supabase = Supabase.instance.client;

  // Global reactive state for notification counts and local removals
  static final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);
  static final ValueNotifier<int> totalCountNotifier = ValueNotifier<int>(0);
  static final ValueNotifier<Set<String>> deletedNotificationIds = ValueNotifier<Set<String>>({});
  static bool allCleared = false;

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
        .order('timestamp', ascending: false)
        .map((list) {
          if (allCleared) {
            unreadCountNotifier.value = 0;
            totalCountNotifier.value = 0;
            return [];
          }

          final filtered = list.where((n) {
            final id = n['id']?.toString();
            return id != null && !deletedNotificationIds.value.contains(id);
          }).toList();

          final unread = filtered.where((n) => !(n['isRead'] ?? true)).length;
          unreadCountNotifier.value = unread;
          totalCountNotifier.value = filtered.length;

          return filtered;
        });
  }

  // Mark a notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      if (unreadCountNotifier.value > 0) {
        unreadCountNotifier.value--;
      }
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
      unreadCountNotifier.value = 0;
      await _supabase
          .from('notifications')
          .update({'isRead': true})
          .eq('studentId', studentId)
          .eq('isRead', false);
    } catch (e) {
      print('Error marking all notifications as read: $e');
    }
  }

  // Delete a specific notification by its ID
  Future<bool> deleteNotification(String notificationId, {bool wasUnread = false}) async {
    try {
      // 1. Immediately record in deletedNotificationIds
      final currentDeleted = Set<String>.from(deletedNotificationIds.value);
      currentDeleted.add(notificationId);
      deletedNotificationIds.value = currentDeleted;

      // 2. Immediately reduce count badge
      if (unreadCountNotifier.value > 0) {
        unreadCountNotifier.value--;
      }
      if (totalCountNotifier.value > 0) {
        totalCountNotifier.value--;
      }

      await _supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);
      return true;
    } catch (e) {
      print('Error deleting notification: $e');
      return false;
    }
  }

  // Clear all notifications for a specific student
  Future<bool> clearAllNotifications(String studentId) async {
    try {
      allCleared = true;
      unreadCountNotifier.value = 0;
      totalCountNotifier.value = 0;
      await _supabase
          .from('notifications')
          .delete()
          .eq('studentId', studentId);
      return true;
    } catch (e) {
      print('Error clearing all notifications: $e');
      return false;
    }
  }

  // Send a notification specifically for missing requirements
  Future<void> sendMissingRequirementsNotification({
    required String studentId,
    required List<String> missingItems,
  }) async {
    final message = 'You have missing requirements: ${missingItems.join(", ")}';
    await sendNotification(
      studentId: studentId,
      title: 'Missing Requirements Notice',
      message: message,
      type: 'warning',
    );
  }
}

