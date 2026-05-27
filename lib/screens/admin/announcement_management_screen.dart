import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/announcement_service.dart';

class AnnouncementManagementScreen extends StatefulWidget {
  const AnnouncementManagementScreen({super.key});

  @override
  State<AnnouncementManagementScreen> createState() => _AnnouncementManagementScreenState();
}

class _AnnouncementManagementScreenState extends State<AnnouncementManagementScreen> {
  final AnnouncementService _service = AnnouncementService();
  late Stream<List<Announcement>> _announcementsStream;

  @override
  void initState() {
    super.initState();
    _announcementsStream = _service.getAllAnnouncements();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isMobile = constraints.maxWidth < 900;
        return Scaffold(
          body: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 16 : 48,
              vertical: isMobile ? 12 : 32,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Announcement Management', 
                            style: (isMobile 
                                    ? Theme.of(context).textTheme.titleLarge 
                                    : Theme.of(context).textTheme.headlineSmall)
                                ?.copyWith(fontWeight: FontWeight.bold)
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Post deadlines, updates and notifications for students.', 
                            style: TextStyle(color: context.textSec, fontSize: 13)
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: () => _showDialog(),
                      icon: const Icon(LucideIcons.plus, size: 18),
                      label: Text(isMobile ? 'Post' : 'Post New Update'),
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(
                          horizontal: isMobile ? 16 : 24,
                          vertical: isMobile ? 12 : 18,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                Expanded(
                  child: Card(
                    elevation: 4,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: StreamBuilder<List<Announcement>>(
                        stream: _announcementsStream,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState == ConnectionState.waiting) {
                            return const Center(child: CircularProgressIndicator());
                          }
                          if (!snapshot.hasData || snapshot.data!.isEmpty) {
                            return Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(LucideIcons.megaphoneOff, size: 64, color: Colors.grey.shade300),
                                  const SizedBox(height: 16),
                                  Text('No announcements posted yet.', style: TextStyle(color: context.textSec)),
                                ],
                              ),
                            );
                          }
                          final announcements = snapshot.data!;
                          return LayoutBuilder(
                            builder: (context, tableConstraints) {
                              return SingleChildScrollView(
                                scrollDirection: Axis.vertical,
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  child: SizedBox(
                                    width: isMobile ? 800 : tableConstraints.maxWidth,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        _buildTableHeader(context),
                                        ...announcements.map((a) => _buildTableRow(context, a)).toList(),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTableHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: context.isDark ? const Color(0xFF1E293B) : Colors.grey.shade100,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
        border: Border(
          bottom: BorderSide(
            color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
            width: 1.5,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              'TYPE',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'TITLE',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: Text(
              'CONTENT',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'POSTED',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'STATUS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'ACTIONS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: context.textPri,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableRow(BuildContext context, Announcement a) {
    Color typeColor = Colors.blue;
    IconData typeIcon = LucideIcons.info;
    if (a.type == 'Deadline') {
      typeColor = AppTheme.error;
      typeIcon = LucideIcons.calendarClock;
    } else if (a.type == 'Update') {
      typeColor = AppTheme.success;
      typeIcon = LucideIcons.refreshCw;
    } else {
      typeColor = AppTheme.primaryColor;
      typeIcon = LucideIcons.megaphone;
    }

    final String formattedDate = DateFormat.yMMMMd().format(a.createdAt);
    // Expand truncation length since we have a much wider table now!
    final String contentPreview = a.content.length > 80 ? a.content.substring(0, 77) + '...' : a.content;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.transparent,
        border: Border(
          bottom: BorderSide(
            color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade100,
            width: 1,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Type badge
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: typeColor, width: 1),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(typeIcon, size: 14, color: typeColor),
                    const SizedBox(width: 4),
                    Text(
                      a.type,
                      style: TextStyle(color: typeColor, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Title
          Expanded(
            flex: 3,
            child: Text(
              a.title,
              style: TextStyle(color: context.textPri, fontWeight: FontWeight.w600),
            ),
          ),
          // Content preview
          Expanded(
            flex: 5,
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Text(
                contentPreview,
                style: TextStyle(color: context.textSec),
              ),
            ),
          ),
          // Posted date
          Expanded(
            flex: 3,
            child: Text(
              formattedDate,
              style: TextStyle(color: context.textSec, fontSize: 13),
            ),
          ),
          // Status badge
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: a.isActive ? AppTheme.success.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: a.isActive ? AppTheme.success : Colors.grey,
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(a.isActive ? LucideIcons.eye : LucideIcons.archive,
                        size: 14,
                        color: a.isActive ? AppTheme.success : context.textSec),
                    const SizedBox(width: 4),
                    Text(a.isActive ? 'LIVE' : 'ARCHIVED',
                        style: TextStyle(
                            color: a.isActive ? AppTheme.success : context.textSec,
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
          // Actions
          Expanded(
            flex: 2,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: a.isActive ? 'Archive announcement' : 'Unarchive announcement',
                  icon: Icon(a.isActive ? LucideIcons.archive : LucideIcons.inbox,
                      size: 16,
                      color: a.isActive ? context.textSec : AppTheme.success),
                  onPressed: () {
                    _service.updateAnnouncement(a.id, {'isActive': !a.isActive});
                  },
                ),
                IconButton(
                  tooltip: 'Delete announcement',
                  icon: const Icon(LucideIcons.trash2, size: 16, color: AppTheme.error),
                  onPressed: () => _confirmDelete(a),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }




  void _confirmDelete(Announcement a) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: dialogContext.bgC,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                LucideIcons.alertTriangle,
                color: AppTheme.error,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Text(
              'Delete Announcement',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: context.textPri,
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to permanently delete this announcement? This action cannot be undone.',
          style: TextStyle(color: context.textSec, fontSize: 14, height: 1.5),
        ),
        actionsPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            style: TextButton.styleFrom(
              foregroundColor: context.textSec,
            ),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              await _service.deleteAnnouncement(a.id);
              if (mounted) Navigator.pop(dialogContext);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showDialog() {
    final titleController = TextEditingController();
    final contentController = TextEditingController();
    String selectedType = 'General';

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: dialogContext.bgC,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  LucideIcons.megaphone,
                  color: AppTheme.primaryColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                'Post Announcement',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: context.textPri,
                ),
              ),
            ],
          ),
          content: Container(
            constraints: const BoxConstraints(maxWidth: 480),
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Category',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: context.textPri,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: ['General', 'Update', 'Deadline'].map((type) {
                      bool isSelected = selectedType == type;
                      Color typeColor = Colors.blue;
                      if (type == 'Deadline') typeColor = AppTheme.error;
                      if (type == 'Update') typeColor = AppTheme.success;
                      if (type == 'General') typeColor = AppTheme.primaryColor;

                      return Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setDialogState(() => selectedType = type);
                          },
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected 
                                  ? typeColor.withValues(alpha: 0.1) 
                                  : (context.isDark ? const Color(0xFF1E293B) : Colors.grey.shade50),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected 
                                    ? typeColor 
                                    : (context.isDark ? const Color(0xFF334155) : Colors.grey.shade200),
                                width: 1.5,
                              ),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  type == 'Deadline' 
                                      ? LucideIcons.calendarClock 
                                      : (type == 'Update' ? LucideIcons.refreshCw : LucideIcons.megaphone),
                                  size: 16,
                                  color: isSelected ? typeColor : context.textSec,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  type,
                                  style: TextStyle(
                                    color: isSelected ? typeColor : context.textSec,
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Announcement Title',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: context.textPri,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      hintText: 'Enter a catchy title...',
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Message Body',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: context.textPri,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: contentController,
                    decoration: const InputDecoration(
                      hintText: 'Type your announcement details here...',
                      alignLabelWithHint: true,
                    ),
                    maxLines: 4,
                  ),
                ],
              ),
            ),
          ),
          actionsPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              style: TextButton.styleFrom(
                foregroundColor: context.textSec,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
            if (titleController.text.trim().isEmpty || contentController.text.trim().isEmpty) {
              ScaffoldMessenger.of(dialogContext).showSnackBar(
                const SnackBar(
                  content: Text('Please enter both title and message body.'),
                  backgroundColor: AppTheme.error,
                ),
              );
              return;
            }
            await _service.postAnnouncement(Announcement(
              id: '',
              title: titleController.text.trim(),
              content: contentController.text.trim(),
              type: selectedType,
              createdAt: DateTime.now(),
              isActive: true,
            ));
            if (mounted) Navigator.pop(dialogContext);
          },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Post Update'),
            ),
          ],
        ),
      ),
    );
  }
}
