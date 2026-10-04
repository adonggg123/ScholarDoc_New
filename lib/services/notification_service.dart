import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'sms_service.dart';

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

  /// Reset in-memory reactive state on logout or user switch
  static void reset() {
    unreadCountNotifier.value = 0;
    totalCountNotifier.value = 0;
    deletedNotificationIds.value = {};
    allCleared = false;
  }

  // Active announcement IDs tracking to guarantee deleted announcements vanish
  static final Set<String> _activeAnnouncementIds = {};
  static bool _hasLoadedActiveAnnouncements = false;
  static StreamSubscription? _announcementsSyncSub;

  void _ensureAnnouncementsSync() {
    if (_announcementsSyncSub != null) return;
    try {
      _announcementsSyncSub = _supabase
          .from('announcements')
          .stream(primaryKey: ['id'])
          .listen((data) {
        final active = data
            .where((doc) => (doc['isActive'] ?? true) == true)
            .map((doc) => doc['id']?.toString())
            .whereType<String>()
            .toSet();
        _activeAnnouncementIds
          ..clear()
          ..addAll(active);
        _hasLoadedActiveAnnouncements = true;
      });
    } catch (_) {}
  }

  /// Permanently delete any orphan notifications whose announcement was deleted/archived
  Future<void> pruneOrphanNotifications(String studentId) async {
    try {
      final annRes = await _supabase
          .from('announcements')
          .select('id')
          .eq('isActive', true);
      final active = (annRes as List)
          .map((doc) => doc['id']?.toString())
          .whereType<String>()
          .toSet();

      _activeAnnouncementIds
        ..clear()
        ..addAll(active);
      _hasLoadedActiveAnnouncements = true;

      final notifRes = await _supabase
          .from('notifications')
          .select('id, announcementId')
          .eq('studentId', studentId)
          .not('announcementId', 'is', null);

      final toDelete = <String>[];
      for (final n in (notifRes as List)) {
        final aId = n['announcementId']?.toString();
        if (aId != null && aId.isNotEmpty && !active.contains(aId)) {
          final id = n['id']?.toString();
          if (id != null) toDelete.add(id);
        }
      }

      if (toDelete.isNotEmpty) {
        await _supabase.from('notifications').delete().inFilter('id', toDelete);
        final currentDeleted = Set<String>.from(deletedNotificationIds.value)..addAll(toDelete);
        deletedNotificationIds.value = currentDeleted;
      }
    } catch (e) {
      debugPrint('NotificationService: pruneOrphanNotifications error: $e');
    }
  }

  // Send a notification to a specific student and mirror to SMS with same content
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

      // Synchronize with SMS: Send SMS notification with identical title and message
      if (studentId != 'admin' && studentId != 'superadmin') {
        final String smsContent = '[ScholarDoc] $title: $message';
        SmsService().sendStudentSms(
          studentId: studentId,
          message: smsContent,
          eventType: type,
        ).catchError((e) {
          debugPrint('NotificationService: SMS sync dispatch note: $e');
          return <String, dynamic>{};
        });
      }
    } catch (e) {
      print('Error sending notification: $e');
    }
  }

  // Stream of notifications for a specific student
  Stream<List<Map<String, dynamic>>> getNotificationsStream(String studentId) {
    _ensureAnnouncementsSync();
    pruneOrphanNotifications(studentId);

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
            if (id == null || deletedNotificationIds.value.contains(id)) return false;

            // Hide notification if it references an announcement that was deleted or is inactive
            final annId = n['announcementId']?.toString();
            if (annId != null && annId.isNotEmpty) {
              if (_hasLoadedActiveAnnouncements && !_activeAnnouncementIds.contains(annId)) {
                return false;
              }
            }

            return true;
          }).toList();

          final unread = filtered.where((n) => !(n['isRead'] ?? true)).length;
          unreadCountNotifier.value = unread;
          totalCountNotifier.value = filtered.length;

          return filtered;
        });
  }

  // Explicitly fetch and refresh unread notifications count (e.g. for pull-to-refresh)
  Future<int> refreshNotificationCounts(String studentId) async {
    try {
      await pruneOrphanNotifications(studentId);
      final res = await _supabase
          .from('notifications')
          .select('id, announcementId, isRead')
          .eq('studentId', studentId);
      final list = (res as List);
      final filtered = list.where((n) {
        final id = n['id']?.toString();
        if (id == null || deletedNotificationIds.value.contains(id)) return false;

        final annId = n['announcementId']?.toString();
        if (annId != null && annId.isNotEmpty) {
          if (_hasLoadedActiveAnnouncements && !_activeAnnouncementIds.contains(annId)) {
            return false;
          }
        }

        return true;
      }).toList();

      final unread = filtered.where((n) => !(n['isRead'] ?? true)).length;
      unreadCountNotifier.value = unread;
      totalCountNotifier.value = filtered.length;
      return unread;
    } catch (_) {
      return unreadCountNotifier.value;
    }
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

  /// Clears/deletes any "Missing Requirements Notice" notifications for a student
  Future<void> clearMissingRequirementsNotifications(String studentId) async {
    try {
      final res = await _supabase
          .from('notifications')
          .select('id')
          .eq('studentId', studentId)
          .ilike('title', '%Missing Requirements%');

      if (res.isNotEmpty) {
        final idsToDelete = res.map((e) => e['id'].toString()).toList();
        await _supabase
            .from('notifications')
            .delete()
            .inFilter('id', idsToDelete);

        final currentDeleted = Set<String>.from(deletedNotificationIds.value)..addAll(idsToDelete);
        deletedNotificationIds.value = currentDeleted;
        unreadCountNotifier.value = (unreadCountNotifier.value - idsToDelete.length).clamp(0, 999);
      }
    } catch (e) {
      debugPrint('NotificationService: clearMissingRequirementsNotifications error: $e');
    }
  }
}

