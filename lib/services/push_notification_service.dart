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
import '../screens/submissions/upload_workflow_screen.dart';
import '../screens/submissions/status_tracking_screen.dart';

/// Top-level background message handler for Firebase Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}
  debugPrint(
    "ScholarDoc Push: Background message received: ${message.messageId} | ${message.data}",
  );

  // If the message is a data-only payload received in the background, display it explicitly
  if (message.notification == null && message.data.isNotEmpty) {
    try {
      final localNotifications = FlutterLocalNotificationsPlugin();
      const androidInit = AndroidInitializationSettings(
        '@mipmap/launcher_icon',
      );
      const initSettings = InitializationSettings(android: androidInit);
      await localNotifications.initialize(initSettings);

      const generalChannel = AndroidNotificationChannel(
        'scholardoc_general',
        'ScholarDoc Updates & Alerts',
        description:
            'Application updates, status tracking, SA verification, and document submission alerts',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );
      const announcementsChannel = AndroidNotificationChannel(
        'scholardoc_announcements',
        'ScholarDoc Announcements',
        description:
            'Notifications for new scholarship announcements, deadlines, and updates',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      final androidPlugin = localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(generalChannel);
        await androidPlugin.createNotificationChannel(announcementsChannel);
      }

      final isAnnouncement = message.data['announcementId'] != null &&
          message.data['announcementId'].toString().isNotEmpty;
      final targetChannel =
          isAnnouncement ? announcementsChannel : generalChannel;

      final title = message.data['title'] ??
          (isAnnouncement
              ? 'ScholarDoc Announcement'
              : 'ScholarDoc Notification');
      final body = message.data['message'] ??
          message.data['body'] ??
          (isAnnouncement
              ? 'New scholarship announcement posted.'
              : 'You have a new update.');

      final androidDetails = AndroidNotificationDetails(
        targetChannel.id,
        targetChannel.name,
        channelDescription: targetChannel.description,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/launcher_icon',
        color: const Color(0xFF0F3260),
        playSound: true,
        enableVibration: true,
        styleInformation: BigTextStyleInformation(body, contentTitle: title),
      );

      final details = NotificationDetails(android: androidDetails);
      final int notifId = DateTime.now().millisecondsSinceEpoch.remainder(
        100000,
      );
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
  static final PushNotificationService _instance =
      PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final SupabaseClient _supabase = Supabase.instance.client;

  GlobalKey<NavigatorState>? _navigatorKey;
  String? _pendingAnnouncementId;
  Map<String, dynamic>? _pendingNotificationData;
  bool _isInitialized = false;

  static const AndroidNotificationChannel _announcementsChannel =
      AndroidNotificationChannel(
    'scholardoc_announcements',
    'ScholarDoc Announcements',
    description:
        'Notifications for new scholarship announcements, deadlines, and updates',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  static const AndroidNotificationChannel _generalChannel =
      AndroidNotificationChannel(
    'scholardoc_general',
    'ScholarDoc Updates & Alerts',
    description:
        'Application updates, status tracking, SA verification, and document submission alerts',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  final Set<String> _recentNotificationKeys = {};

  bool _isDuplicate(String key) {
    if (key.isEmpty) return false;
    if (_recentNotificationKeys.contains(key)) {
      return true;
    }
    _recentNotificationKeys.add(key);
    // Keep set bounded and prune older entries after 10 seconds
    Future.delayed(const Duration(seconds: 10), () {
      _recentNotificationKeys.remove(key);
    });
    return false;
  }

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

      debugPrint(
        'ScholarDoc Push: Notification permission status: ${settings.authorizationStatus}',
      );

      // 2. Initialize Local Notifications Plugin (for foreground display)
      const androidInit = AndroidInitializationSettings(
        '@mipmap/launcher_icon',
      );
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

      // 3. Create Android High-Priority Notification Channels & Request Android 13+ permission
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(_announcementsChannel);
        await androidPlugin.createNotificationChannel(_generalChannel);
        await androidPlugin.requestNotificationsPermission();
      }

      // Set foreground notification presentation options for iOS/macOS
      await _fcm.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 4. Foreground Message Listener -> Display heads-up banner via flutter_local_notifications
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint(
          'ScholarDoc Push: Foreground message received: ${message.data}',
        );
        _showForegroundNotification(message);
      });

      // 5. Background Notification Tap Listener (when app in background)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint(
          'ScholarDoc Push: Notification clicked from background: ${message.data}',
        );
        handleNotificationTap(message.data);
      });

      // 6. Terminated State Tap Check (when app was terminated and opened via notification)
      final initialMessage = await _fcm.getInitialMessage();
      if (initialMessage != null) {
        debugPrint(
          'ScholarDoc Push: App launched via notification: ${initialMessage.data}',
        );
        _pendingAnnouncementId = initialMessage.data['announcementId']
            ?.toString();
        _pendingNotificationData = initialMessage.data;
      }

      // 7. Subscribe to global student broadcast topics
      try {
        await _fcm.subscribeToTopic('all_students');
        await _fcm.subscribeToTopic('announcements');
      } catch (e) {
        debugPrint('ScholarDoc Push: Topic subscription note: $e');
      }

      // 8. Auto-sync token if user is already signed in
      final currentUser = _supabase.auth.currentUser;
      if (currentUser != null) {
        syncToken(currentUser.id);
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

    final title =
        notification?.title ?? data['title'] ?? 'ScholarDoc Notification';
    final body =
        notification?.body ??
        data['body'] ??
        data['message'] ??
        'New notification received.';

    final notifKey = data['notifId']?.toString() ??
        data['id']?.toString() ??
        data['announcementId']?.toString() ??
        message.messageId ??
        '${title}_$body';

    if (_isDuplicate(notifKey)) {
      debugPrint(
        'ScholarDoc Push: Suppressing duplicate foreground notification ($notifKey)',
      );
      return;
    }

    final isAnnouncement = data['announcementId'] != null &&
        data['announcementId'].toString().isNotEmpty;
    final activeChannel =
        isAnnouncement ? _announcementsChannel : _generalChannel;

    final androidDetails = AndroidNotificationDetails(
      activeChannel.id,
      activeChannel.name,
      channelDescription: activeChannel.description,
      importance: Importance.max,
      priority: Priority.high,
      icon: '@mipmap/launcher_icon',
      color: const Color(0xFF0F3260),
      playSound: true,
      enableVibration: true,
      styleInformation: BigTextStyleInformation(body, contentTitle: title),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    final int notifId = DateTime.now().millisecondsSinceEpoch.remainder(100000);
    await _localNotifications.show(
      notifId,
      title,
      body,
      details,
      payload: jsonEncode(data),
    );
  }

  /// Trigger a local heads-up push notification banner on the device
  Future<void> showLocalNotification({
    required String title,
    required String body,
    Map<String, dynamic>? payload,
    String? channelId,
  }) async {
    try {
      final notifKey = payload?['id']?.toString() ??
          payload?['notifId']?.toString() ??
          payload?['announcementId']?.toString() ??
          '${title}_$body';

      if (_isDuplicate(notifKey)) {
        debugPrint(
          'ScholarDoc Push: Suppressing duplicate local notification ($notifKey)',
        );
        return;
      }

      final isAnnouncement =
          (payload?['announcementId'] != null &&
              payload!['announcementId'].toString().isNotEmpty) ||
          channelId == _announcementsChannel.id;
      final activeChannel =
          isAnnouncement ? _announcementsChannel : _generalChannel;

      final androidDetails = AndroidNotificationDetails(
        activeChannel.id,
        activeChannel.name,
        channelDescription: activeChannel.description,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/launcher_icon',
        color: const Color(0xFF0F3260),
        playSound: true,
        enableVibration: true,
        styleInformation: BigTextStyleInformation(body, contentTitle: title),
      );

      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      final details = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );
      final int notifId = DateTime.now().millisecondsSinceEpoch.remainder(
        100000,
      );
      await _localNotifications.show(
        notifId,
        title,
        body,
        details,
        payload: payload != null ? jsonEncode(payload) : null,
      );
    } catch (e) {
      debugPrint('ScholarDoc Push: Error showing local notification: $e');
    }
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
  Future<void> _saveTokenToSupabase(
    String userId,
    String token, {
    String? studentId,
  }) async {
    try {
      final uuidRegex = RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      );
      String? validUserId;
      if (uuidRegex.hasMatch(userId)) {
        validUserId = userId;
      } else {
        final currentAuthUid = _supabase.auth.currentUser?.id;
        if (currentAuthUid != null && uuidRegex.hasMatch(currentAuthUid)) {
          validUserId = currentAuthUid;
          studentId ??= userId;
        }
      }

      if (validUserId == null) {
        debugPrint(
          'ScholarDoc Push: Skipping token upsert - userId ($userId) is not a valid UUID',
        );
        return;
      }

      await _supabase.from('user_fcm_tokens').upsert({
        'user_id': validUserId,
        'student_id': studentId,
        'fcm_token': token,
        'device_type': defaultTargetPlatform.name.toLowerCase(),
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'fcm_token');
      debugPrint(
        'ScholarDoc Push: Token successfully saved to user_fcm_tokens for $validUserId ($studentId).',
      );
    } catch (e) {
      debugPrint(
        'ScholarDoc Push: Supabase token upsert error: $e',
      );
    }
  }

  /// Remove token on logout so subsequent users on this device do not receive alerts
  Future<void> clearToken(String userId) async {
    try {
      final token = await _fcm.getToken();
      if (token != null) {
        await _supabase.from('user_fcm_tokens').delete().eq('fcm_token', token);
      }
    } catch (e) {
      debugPrint('ScholarDoc Push: Error clearing FCM token: $e');
    }
  }

  /// Process any pending notification payload saved during cold start
  void processPendingNotification(BuildContext context) {
    if (_pendingAnnouncementId != null || _pendingNotificationData != null) {
      final announcementId = _pendingAnnouncementId;
      final data = _pendingNotificationData ?? {};
      _pendingAnnouncementId = null;
      _pendingNotificationData = null;

      Future.delayed(const Duration(milliseconds: 600), () {
        if (context.mounted) {
          navigateFromNotification(
            context,
            title: data['title']?.toString(),
            message: (data['body'] ?? data['message'])?.toString(),
            type: data['type']?.toString(),
            announcementId:
                announcementId ?? data['announcementId']?.toString(),
            data: data,
          );
        }
      });
    }
  }

  /// Handle tapping on a notification
  Future<void> handleNotificationTap(Map<String, dynamic> data) async {
    final BuildContext? context = _navigatorKey?.currentContext;
    final String? announcementId =
        data['announcementId']?.toString() ??
        (data['target'] == 'announcement' ? data['id']?.toString() : null);
    final String? title = data['title']?.toString();
    final String? message = (data['body'] ?? data['message'])?.toString();
    final String? type = data['type']?.toString();

    debugPrint(
      'ScholarDoc Push: Handling notification tap: title=$title, announcementId=$announcementId',
    );

    navigateFromNotification(
      context,
      title: title,
      message: message,
      type: type,
      announcementId: announcementId,
      data: data,
    );
  }

  /// Central notification navigation dispatcher
  void navigateFromNotification(
    BuildContext? context, {
    String? title,
    String? message,
    String? type,
    String? announcementId,
    Map<String, dynamic>? data,
  }) {
    final ctx = context ?? _navigatorKey?.currentContext;
    if (ctx == null || !ctx.mounted) {
      debugPrint('ScholarDoc Push: Context is not mounted for navigation');
      return;
    }

    // 1. Announcement notification
    if (announcementId != null && announcementId.isNotEmpty) {
      openAnnouncementById(announcementId, fallbackData: data, context: ctx);
      return;
    }

    final combinedText =
        '${title ?? ''} ${message ?? ''} ${type ?? ''} ${data?['target'] ?? ''}'
            .toLowerCase();

    // 2. Document Submission Update / Missing Documents / Resubmission
    if (combinedText.contains('missing documents') ||
        combinedText.contains('missing document') ||
        combinedText.contains('resubmission') ||
        combinedText.contains('re-upload') ||
        combinedText.contains('requires revision') ||
        combinedText.contains('document submission') ||
        combinedText.contains('upload documents')) {
      Navigator.of(
        ctx,
      ).push(MaterialPageRoute(builder: (_) => const UploadWorkflowScreen()));
      return;
    }

    // 3. SA Verification, ID Validation, Application Status Updates (Pending, Verified, Approved, Rejected)
    if (combinedText.contains('sa verification') ||
        combinedText.contains('sa number') ||
        combinedText.contains('id validation') ||
        combinedText.contains('school id') ||
        combinedText.contains('application approved') ||
        combinedText.contains('application rejected') ||
        combinedText.contains('verified') ||
        combinedText.contains('status') ||
        combinedText.contains('grantee')) {
      Navigator.of(
        ctx,
      ).push(MaterialPageRoute(builder: (_) => const StatusTrackingScreen()));
      return;
    }

    // 4. Default fallback: Notifications Screen
    if (ModalRoute.of(ctx)?.settings.name != '/notifications') {
      navigateToNotificationsScreen(context: ctx);
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
        if (announcement.isActive) {
          await AnnouncementDetailDialog.show(ctx, announcement);
          return;
        }
      }

      // If announcement does not exist or is inactive, it was deleted/archived by superadmin
      // Purge orphan notifications for this announcement from DB
      try {
        await _supabase
            .from('notifications')
            .delete()
            .eq('announcementId', announcementId);
      } catch (_) {}

      if (ctx != null && ctx.mounted) {
        ScaffoldMessenger.of(ctx).hideCurrentSnackBar();
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.info_outline, color: Color(0xFFFBC02D), size: 18),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This announcement was removed by the administrator.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF0F3260),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
            duration: const Duration(seconds: 3),
          ),
        );
        return;
      }
    } catch (e) {
      debugPrint('ScholarDoc Push: Error fetching announcement for modal: $e');
    }

    // Fallback: Navigate to notifications screen
    navigateToNotificationsScreen(context: ctx);
  }

  /// Navigate to notifications screen
  void navigateToNotificationsScreen({BuildContext? context}) {
    final ctx = context ?? _navigatorKey?.currentContext;
    if (ctx != null && ctx.mounted) {
      Navigator.of(
        ctx,
      ).push(MaterialPageRoute(builder: (_) => const NotificationScreen()));
    }
  }
}
