// File: lib/services/push_notification_service.dart
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../firebase_options.dart';
import 'announcement_service.dart';
import '../screens/dashboard/widgets/announcement_detail_dialog.dart';
import '../screens/notifications/notification_screen.dart';

/// Top-level background message handler for Firebase Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}
  debugPrint("ScholarDoc Push: Background message received: ${message.messageId} | ${message.data}");

  // If the message is a data-only payload received in the background, display it explicitly
  if (message.notification == null && message.data.isNotEmpty) {
    try {
      final localNotifications = FlutterLocalNotificationsPlugin();
      const androidInit = AndroidInitializationSettings('@drawable/ic_notification');
      const initSettings = InitializationSettings(android: androidInit);
      await localNotifications.initialize(initSettings);

      const channel = AndroidNotificationChannel(
        'scholardoc_announcements',
        'ScholarDoc Announcements',
        description: 'Notifications for new scholarship announcements, deadlines, and updates',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      final title = message.data['title'] ?? 'ScholarDoc Announcement';
      final body = message.data['message'] ?? message.data['body'] ?? 'New scholarship announcement posted.';

      final androidDetails = AndroidNotificationDetails(
        channel.id,
        channel.name,
        channelDescription: channel.description,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@drawable/ic_notification',
        color: const Color(0xFF0F3260),
        playSound: true,
        enableVibration: true,
        styleInformation: BigTextStyleInformation(body, contentTitle: title),
      );

      final details = NotificationDetails(android: androidDetails);
      final int notifId = DateTime.now().millisecondsSinceEpoch.remainder(100000);
      await localNotifications.show(
        notifId,
        title,
        body,
        details,
        payload: jsonEncode(message.data),
      );
    } catch (e) {
      debugPrint("ScholarDoc Push: Error showing background notification: $e");
    }
  }
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final SupabaseClient _supabase = Supabase.instance.client;

  GlobalKey<NavigatorState>? _navigatorKey;
  String? _pendingAnnouncementId;
  Map<String, dynamic>? _pendingNotificationData;
  bool _isInitialized = false;

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'scholardoc_announcements',
    'ScholarDoc Announcements',
    description: 'Notifications for new scholarship announcements, deadlines, and updates',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  /// Initialize Firebase Messaging, Local Notifications, and click listeners
  Future<void> initialize({GlobalKey<NavigatorState>? navKey}) async {
    if (_isInitialized) {
      if (navKey != null) _navigatorKey = navKey;
      return;
    }

    _navigatorKey = navKey;

    try {
      // 1. Request Notification Permissions (Android 13+ / iOS)
      final settings = await _fcm.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      debugPrint('ScholarDoc Push: Notification permission status: ${settings.authorizationStatus}');

      // 2. Initialize Local Notifications Plugin (for foreground display)
      const androidInit = AndroidInitializationSettings('@mipmap/launcher_icon');
      const darwinInit = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidInit,
        iOS: darwinInit,
      );

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          final payload = response.payload;
          if (payload != null && payload.isNotEmpty) {
            try {
              final Map<String, dynamic> data = jsonDecode(payload);
              handleNotificationTap(data);
            } catch (_) {
              handleNotificationTap({'announcementId': payload});
            }
          } else {
            navigateToNotificationsScreen();
          }
        },
      );

      // 3. Create Android High-Priority Notification Channel
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);

      // Set foreground notification presentation options for iOS/macOS
      await _fcm.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 4. Foreground Message Listener -> Display heads-up banner via flutter_local_notifications
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('ScholarDoc Push: Foreground message received: ${message.data}');
        _showForegroundNotification(message);
      });

      // 5. Background Notification Tap Listener (when app in background)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('ScholarDoc Push: Notification clicked from background: ${message.data}');
        handleNotificationTap(message.data);
      });

      // 6. Terminated State Tap Check (when app was terminated and opened via notification)
      final initialMessage = await _fcm.getInitialMessage();
      if (initialMessage != null) {
        debugPrint('ScholarDoc Push: App launched via notification: ${initialMessage.data}');
        _pendingAnnouncementId = initialMessage.data['announcementId']?.toString();
        _pendingNotificationData = initialMessage.data;
      }

      // 7. Subscribe to global student broadcast topics
      try {
        await _fcm.subscribeToTopic('all_students');
        await _fcm.subscribeToTopic('announcements');
      } catch (e) {
        debugPrint('ScholarDoc Push: Topic subscription note: $e');
      }

      _isInitialized = true;
      debugPrint('ScholarDoc Push: Successfully initialized.');
    } catch (e) {
      debugPrint('ScholarDoc Push initialization error: $e');
    }
  }

  /// Show a local heads-up notification when app is running in the foreground
  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final data = message.data;

    final title = notification?.title ?? data['title'] ?? 'ScholarDoc Announcement';
    final body = notification?.body ?? data['body'] ?? data['message'] ?? 'New announcement posted.';

    final androidDetails = AndroidNotificationDetails(
      _channel.id,
      _channel.name,
      channelDescription: _channel.description,
      importance: Importance.max,
      priority: Priority.high,
      icon: '@drawable/ic_notification',
      color: const Color(0xFF0F3260),
      playSound: true,
      enableVibration: true,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
      ),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(android: androidDetails, iOS: iosDetails);

    final int notifId = DateTime.now().millisecondsSinceEpoch.remainder(100000);
    await _localNotifications.show(
      notifId,
      title,
      body,
      details,
      payload: jsonEncode(data),
    );
  }

  /// Synchronize the student's FCM token to Supabase `user_fcm_tokens` table
  Future<void> syncToken(String userId, {String? studentId}) async {
    try {
      final token = await _fcm.getToken();
      if (token == null) {
        debugPrint('ScholarDoc Push: Unable to retrieve FCM token.');
        return;
      }

      debugPrint('ScholarDoc Push: Syncing FCM token for user $userId');

      await _saveTokenToSupabase(userId, token, studentId: studentId);

      // Listen for token refresh events (e.g. app re-install, token rotation)
      _fcm.onTokenRefresh.listen((newToken) {
        debugPrint('ScholarDoc Push: Token refreshed');
        _saveTokenToSupabase(userId, newToken, studentId: studentId);
      });
    } catch (e) {
      debugPrint('ScholarDoc Push: Error syncing FCM token: $e');
    }
  }

  /// Upsert device token in Supabase
  Future<void> _saveTokenToSupabase(String userId, String token, {String? studentId}) async {
    try {
      await _supabase.from('user_fcm_tokens').upsert(
        {
          'user_id': userId,
          'student_id': studentId,
          'fcm_token': token,
          'device_type': defaultTargetPlatform.name.toLowerCase(),
          'updated_at': DateTime.now().toIso8601String(),
        },
        onConflict: 'fcm_token',
      );
      debugPrint('ScholarDoc Push: Token successfully saved to user_fcm_tokens.');
    } catch (e) {
      debugPrint('ScholarDoc Push: Supabase token upsert error (table may need setup): $e');
    }
  }

  /// Remove token on logout so subsequent users on this device do not receive alerts
  Future<void> clearToken(String userId) async {
    try {
      final token = await _fcm.getToken();
      if (token != null) {
        await _supabase
            .from('user_fcm_tokens')
            .delete()
            .eq('fcm_token', token);
      }
    } catch (e) {
      debugPrint('ScholarDoc Push: Error clearing FCM token: $e');
    }
  }

  /// Process any pending notification payload saved during cold start
  void processPendingNotification(BuildContext context) {
    if (_pendingAnnouncementId != null) {
      final id = _pendingAnnouncementId!;
      final data = _pendingNotificationData;
      _pendingAnnouncementId = null;
      _pendingNotificationData = null;
      Future.delayed(const Duration(milliseconds: 600), () {
        openAnnouncementById(id, fallbackData: data, context: context);
      });
    }
  }

  /// Handle tapping on a notification
  Future<void> handleNotificationTap(Map<String, dynamic> data) async {
    final String? announcementId = data['announcementId']?.toString() ?? data['id']?.toString();
    final BuildContext? context = _navigatorKey?.currentContext;

    debugPrint('ScholarDoc Push: Handling notification tap with announcementId=$announcementId');

    if (announcementId != null && announcementId.isNotEmpty) {
      await openAnnouncementById(announcementId, fallbackData: data, context: context);
    } else {
      navigateToNotificationsScreen(context: context);
    }
  }

  /// Fetch and display the announcement in a modal dialog
  Future<void> openAnnouncementById(
    String announcementId, {
    Map<String, dynamic>? fallbackData,
    BuildContext? context,
  }) async {
    final ctx = context ?? _navigatorKey?.currentContext;

    try {
      final response = await _supabase
          .from('announcements')
          .select('*')
          .eq('id', announcementId)
          .maybeSingle();

      if (response != null && ctx != null && ctx.mounted) {
        final announcement = Announcement.fromMap(response);
        await AnnouncementDetailDialog.show(ctx, announcement);
        return;
      }
    } catch (e) {
      debugPrint('ScholarDoc Push: Error fetching announcement for modal: $e');
    }

    // Resilient fallback: If database returned null or is delayed, render using notification payload data directly
    if (fallbackData != null &&
        fallbackData['title'] != null &&
        fallbackData['title'].toString().isNotEmpty &&
        ctx != null &&
        ctx.mounted) {
      final fallbackAnnouncement = Announcement(
        id: announcementId,
        title: fallbackData['title']?.toString() ?? 'Announcement',
        content: (fallbackData['content'] ??
                fallbackData['message'] ??
                fallbackData['body'] ??
                '')
            .toString(),
        type: fallbackData['type']?.toString() ?? 'General',
        createdAt: DateTime.now(),
        isActive: true,
      );
      await AnnouncementDetailDialog.show(ctx, fallbackAnnouncement);
      return;
    }

    // Fallback: Navigate to notifications screen
    navigateToNotificationsScreen(context: ctx);
  }

  /// Navigate to notifications screen
  void navigateToNotificationsScreen({BuildContext? context}) {
    final ctx = context ?? _navigatorKey?.currentContext;
    if (ctx != null && ctx.mounted) {
      Navigator.of(ctx).push(
        MaterialPageRoute(builder: (_) => const NotificationScreen()),
      );
    }
  }
}
