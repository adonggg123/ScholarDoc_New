import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../../theme/theme_provider.dart';
import '../../../services/announcement_service.dart';

class AnnouncementDetailDialog extends StatelessWidget {
  final Announcement announcement;

  const AnnouncementDetailDialog({super.key, required this.announcement});

  static Future<void> show(BuildContext context, Announcement announcement) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) =>
          AnnouncementDetailDialog(announcement: announcement),
    );
  }

  @override
  Widget build(BuildContext context) {
    Color typeColor = const Color(0xFF0F3260); // Primary Navy
    IconData typeIcon = LucideIcons.megaphone;
    String badgeText = announcement.type.toUpperCase();

    if (announcement.type == 'Deadline') {
      typeColor = const Color(0xFFEF4444); // Red
      typeIcon = LucideIcons.calendarClock;
      badgeText = 'DEADLINE NOTICE';
    } else if (announcement.type == 'Update') {
      typeColor = const Color(0xFF10B981); // Emerald
      typeIcon = LucideIcons.bellRing;
      badgeText = 'IMPORTANT UPDATE';
    }

    final formattedDate = DateFormat(
      'MMMM d, y • h:mm a',
    ).format(announcement.createdAt);

    // Extract deadline date string if embedded in content [Deadline: ...]
    String? deadlineSnippet;
    String cleanContent = announcement.content;
    final deadlineMatch = RegExp(
      r'\[Deadline:\s*([^\]]+)\]',
      caseSensitive: false,
    ).firstMatch(announcement.content);
    if (deadlineMatch != null) {
      deadlineSnippet = deadlineMatch.group(1);
      cleanContent = cleanContent
          .replaceAll(deadlineMatch.group(0)!, '')
          .trim();
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      backgroundColor: context.surfaceC,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 680),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Accent Header
            Container(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 16),
              decoration: BoxDecoration(
                color: typeColor.withValues(alpha: 0.08),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
                border: Border(
                  bottom: BorderSide(
                    color: typeColor.withValues(alpha: 0.15),
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: typeColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(typeIcon, size: 13, color: typeColor),
                        const SizedBox(width: 6),
                        Text(
                          badgeText,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: typeColor,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Icon(LucideIcons.x, size: 20, color: context.textSec),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Close',
                  ),
                ],
              ),
            ),

            // Scrollable Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      announcement.title,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: context.textPri,
                        letterSpacing: -0.4,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Timestamp
                    if (formattedDate.isNotEmpty)
                      Row(
                        children: [
                          Icon(
                            LucideIcons.clock,
                            size: 13,
                            color: context.textSec,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            formattedDate,
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textSec,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),

                    // Deadline Banner if applicable
                    if (deadlineSnippet != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFEF4444,
                          ).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: const Color(
                              0xFFEF4444,
                            ).withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              LucideIcons.calendarClock,
                              color: const Color(0xFFEF4444),
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Submission Deadline',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFEF4444),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    deadlineSnippet,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF991B1B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 20),
                    const Divider(height: 1),
                    const SizedBox(height: 20),

                    // Body Content
                    SelectableText(
                      cleanContent,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.6,
                        color: context.textPri.withValues(alpha: 0.9),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Footer Actions
            Container(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: context.crispBorder, width: 1),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      'Dismiss',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: context.textSec,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(LucideIcons.check, size: 16),
                    label: const Text('Got it'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: typeColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
