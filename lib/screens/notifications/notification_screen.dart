import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/notification_service.dart';
import '../../services/push_notification_service.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  final AuthService _authService = AuthService();
  final NotificationService _notificationService = NotificationService();
  late Stream<List<Map<String, dynamic>>> _notificationStream;

  // Track locally deleted IDs for instantaneous optimistic UI disappearance
  final Set<String> _locallyDeletedIds = {};
  bool _locallyClearedAll = false;

  @override
  void initState() {
    super.initState();
    final user = _authService.currentUser;
    if (user != null) {
      _notificationStream = _notificationService.getNotificationsStream(user.id);
    }
  }

  Future<bool?> _confirmDeleteSingle(BuildContext context, String title) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: context.surfaceC,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.trash2, color: AppTheme.error, size: 20),
            ),
            const SizedBox(width: 12),
            const Text(
              'Delete Notice',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to remove "$title"?',
          style: const TextStyle(fontSize: 14),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleDeleteWithModal(BuildContext context, String docId, String title) async {
    final confirmed = await _confirmDeleteSingle(context, title);
    if (confirmed == true && mounted) {
      _deleteNotificationInstantly(context, docId);
    }
  }

  /// Instantly removes the notification card from view and deletes it in database
  void _deleteNotificationInstantly(BuildContext context, String docId) {
    setState(() {
      _locallyDeletedIds.add(docId);
    });

    _notificationService.deleteNotification(docId);

    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Notification deleted'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          backgroundColor: const Color(0xFF0F3260),
        ),
      );
    }
  }

  Future<void> _confirmClearAll(BuildContext context, String userId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: context.surfaceC,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.trash2, color: AppTheme.error, size: 20),
            ),
            const SizedBox(width: 12),
            const Text(
              'Clear All Notices?',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to permanently delete all your notifications? This cannot be undone.',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() {
        _locallyClearedAll = true;
      });
      final success = await _notificationService.clearAllNotifications(userId);
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'All notifications cleared' : 'Failed to clear notifications'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            backgroundColor: success ? const Color(0xFF0F3260) : AppTheme.error,
          ),
        );
      }
    }
  }

  Widget _buildHeader(BuildContext context) {
    final user = _authService.currentUser;
    final topPadding = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.fromLTRB(24, topPadding + 10, 24, 28),
      decoration: const BoxDecoration(
        color: AppTheme.primaryColor,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              InkWell(
                onTap: () => Navigator.pop(context),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(LucideIcons.arrowLeft, color: Colors.white, size: 24),
                ),
              ),
              const SizedBox(width: 16),
              const Text(
                'Notifications',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const Spacer(),
              ValueListenableBuilder<int>(
                valueListenable: NotificationService.unreadCountNotifier,
                builder: (context, unreadCount, _) {
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(LucideIcons.bell, color: Colors.white, size: 22),
                      ),
                      if (unreadCount > 0)
                        Positioned(
                          right: -3,
                          top: -3,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppTheme.primaryColor, width: 1.5),
                            ),
                            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                            child: Center(
                              child: Text(
                                unreadCount > 99 ? '99+' : '$unreadCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Stay updated with your scholarship',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              if (user != null)
                StreamBuilder<List<Map<String, dynamic>>>(
                  stream: _notificationStream,
                  builder: (context, snapshot) {
                    if (_locallyClearedAll) return const SizedBox.shrink();
                    final docs = (snapshot.data ?? [])
                        .where((doc) => !_locallyDeletedIds.contains(doc['id']?.toString()))
                        .toList();
                    final hasUnread = docs.any((doc) => !(doc['isRead'] ?? true));
                    final hasAny = docs.isNotEmpty;

                    if (!hasAny) return const SizedBox.shrink();

                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (hasUnread) ...[
                          InkWell(
                            onTap: () => _notificationService.markAllAsRead(user.id),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Mark All Read',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.4,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        InkWell(
                          onTap: () => _confirmClearAll(context, user.id),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(LucideIcons.trash2, color: Colors.white, size: 12),
                                SizedBox(width: 4),
                                Text(
                                  'Clear All',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;
    
    if (user == null) {
      return Scaffold(
        backgroundColor: context.bgC,
        body: Column(
          children: [
            _buildHeader(context),
            const Expanded(child: Center(child: Text('Please log in to view notifications.'))),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: context.bgC,
      body: Column(
        children: [
          _buildHeader(context),
          Expanded(
            child: StreamBuilder<List<Map<String, dynamic>>>(
              stream: _notificationStream,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError) {
                  debugPrint('NotificationScreen: Supabase Error -> ${snapshot.error}');
                  return const Center(child: Text('Error loading notifications'));
                }

                if (_locallyClearedAll) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.bellOff, size: 48, color: Colors.grey.withValues(alpha: 0.5)),
                        const SizedBox(height: 16),
                        const Text('No notifications yet.', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  );
                }

                List<Map<String, dynamic>> rawDocs = snapshot.data?.toList() ?? [];
                List<Map<String, dynamic>> docs = rawDocs
                    .where((d) => !_locallyDeletedIds.contains(d['id']?.toString()))
                    .toList();

                docs.sort((a, b) {
                  final tA = a['timestamp']?.toString() ?? '';
                  final tB = b['timestamp']?.toString() ?? '';
                  return tB.compareTo(tA);
                });

                if (docs.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.bellOff, size: 48, color: Colors.grey.withValues(alpha: 0.5)),
                        const SizedBox(height: 16),
                        const Text('No notifications yet.', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(24),
                  itemCount: docs.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final data = docs[index];

                    return _buildNotificationItem(
                      context,
                      data['id']?.toString() ?? '',
                      data['title'] ?? 'Notification',
                      data['message'] ?? '',
                      data['timestamp'],
                      data['type'] ?? 'info',
                      !(data['isRead'] ?? true),
                      announcementId: data['announcementId']?.toString(),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(
    BuildContext context,
    String docId,
    String title,
    String message,
    dynamic timestamp,
    String type,
    bool isNew, {
    String? announcementId,
  }) {
    IconData icon = LucideIcons.info;
    Color color = AppTheme.primaryColor;

    switch (type) {
      case 'success':
        icon = LucideIcons.checkCircle2;
        color = AppTheme.success;
        break;
      case 'warning':
        icon = LucideIcons.alertCircle;
        color = AppTheme.warning;
        break;
      case 'error':
        icon = LucideIcons.xCircle;
        color = AppTheme.error;
        break;
    }

    String timeStr = 'Some time ago';
    if (timestamp != null) {
      try {
        final dateTime = DateTime.parse(timestamp.toString());
        timeStr = DateFormat('MMM d, h:mm a').format(dateTime);
      
        final diff = DateTime.now().difference(dateTime);
        if (diff.inMinutes < 60) {
          timeStr = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          timeStr = '${diff.inHours}h ago';
        }
      } catch (_) {}
    }

    return Dismissible(
      key: Key('notif_$docId'),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.symmetric(vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        alignment: Alignment.centerRight,
        decoration: BoxDecoration(
          color: AppTheme.error,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Icon(LucideIcons.trash2, color: Colors.white, size: 20),
            SizedBox(width: 8),
            Text(
              'Delete',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
      confirmDismiss: (direction) => _confirmDeleteSingle(context, title),
      onDismissed: (direction) {
        _deleteNotificationInstantly(context, docId);
      },
      child: InkWell(
        onTap: () {
          if (isNew) {
            _notificationService.markAsRead(docId);
          }
          if (announcementId != null && announcementId.isNotEmpty) {
            PushNotificationService().openAnnouncementById(announcementId, context: context);
          }
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isNew ? context.surfaceC : context.surfaceC.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isNew ? color.withValues(alpha: 0.3) : context.crispBorder,
              width: isNew ? 1.5 : 1,
            ),
            boxShadow: isNew ? AppTheme.softShadow : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontWeight: isNew ? FontWeight.bold : FontWeight.w600,
                              fontSize: 15,
                              color: isNew ? context.textPri : context.textPri.withValues(alpha: 0.7),
                            ),
                          ),
                        ),
                        if (isNew) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'NEW',
                              style: TextStyle(
                                color: color,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => _handleDeleteWithModal(context, docId, title),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.all(4),
                              child: Icon(
                                LucideIcons.trash2,
                                size: 16,
                                color: context.textSec.withValues(alpha: 0.7),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      message,
                      style: TextStyle(
                        color: isNew ? context.textPri.withValues(alpha: 0.9) : context.textSec,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(LucideIcons.clock, size: 12, color: context.textSec),
                        const SizedBox(width: 4),
                        Text(
                          timeStr,
                          style: TextStyle(fontSize: 11, color: context.textSec),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
