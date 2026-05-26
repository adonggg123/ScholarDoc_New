import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';
import '../../services/scholarship_service.dart';

class ScholarshipManagementScreen extends StatefulWidget {
  const ScholarshipManagementScreen({super.key});

  @override
  State<ScholarshipManagementScreen> createState() =>
      _ScholarshipManagementScreenState();
}

class _ScholarshipManagementScreenState
    extends State<ScholarshipManagementScreen> {
  final ScholarshipService _scholarshipService = ScholarshipService();
  late Stream<List<Scholarship>> _scholarshipsStream;

  @override
  void initState() {
    super.initState();
    _scholarshipsStream = _scholarshipService.getAllScholarships();
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
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Scholarship Management',
                          style: (isMobile
                                  ? Theme.of(context).textTheme.titleLarge
                                  : Theme.of(context).textTheme.headlineSmall)
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Manage programs and document requirements.',
                          style: TextStyle(color: context.textSec, fontSize: 13),
                        ),
                      ],
                    ),
                    ElevatedButton.icon(
                      onPressed: () => _showScholarshipDialog(),
                      icon: const Icon(LucideIcons.plus, size: 18),
                      label: Text(isMobile ? 'Add' : 'Add Program'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: StreamBuilder<List<Scholarship>>(
                    stream: _scholarshipsStream,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                LucideIcons.graduationCap,
                                size: 64,
                                color: Colors.grey.shade300,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No scholarships found.',
                                style: TextStyle(color: context.textSec),
                              ),
                            ],
                          ),
                        );
                      }

                      final scholarships = snapshot.data!;
                      
                      if (isMobile) {
                        return ListView.separated(
                          itemCount: scholarships.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final s = scholarships[index];
                            return _buildMobileScholarshipCard(s);
                          },
                        );
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _buildTableHeader(context),
                          Expanded(
                            child: ListView.builder(
                              itemCount: scholarships.length,
                              itemBuilder: (context, index) {
                                final s = scholarships[index];
                                return _buildTableRow(
                                  context,
                                  s,
                                  index == scholarships.length - 1,
                                );
                              },
                            ),
                          ),
                        ],
                      );
                    },
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
        color: context.isDark ? const Color(0xFF1E293B) : Colors.grey.shade50,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
        border: Border.all(
          color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              'PROGRAM',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                color: context.textSec,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'STATUS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                color: context.textSec,
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: Text(
              'REQUIRED DOCUMENTS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                color: context.textSec,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(
                'ACTIONS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                  color: context.textSec,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableRow(BuildContext context, Scholarship s, bool isLast) {
    final Color tintColor = s.isActive ? AppTheme.primaryColor : Colors.grey;
    
    return Container(
      decoration: BoxDecoration(
        color: context.isDark ? const Color(0xFF1E293B) : Colors.white,
        border: Border(
          left: BorderSide(
            color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
            width: 1.5,
          ),
          right: BorderSide(
            color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
            width: 1.5,
          ),
          bottom: BorderSide(
            color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
            width: 1.5,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Program Column
          Expanded(
            flex: 3,
            child: Row(
              children: [
                // Tinted badge for acronym
                Container(
                  width: 72,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tintColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: tintColor.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                  child: Text(
                    s.name,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: tintColor,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        s.name,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: context.textPri,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        s.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.textSec,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Status Column
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: s.isActive
                      ? AppTheme.success.withValues(alpha: 0.08)
                      : AppTheme.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: s.isActive
                        ? AppTheme.success.withValues(alpha: 0.2)
                        : AppTheme.error.withValues(alpha: 0.2),
                    width: 1,
                  ),
                ),
                child: Text(
                  s.isActive ? 'ACTIVE' : 'INACTIVE',
                  style: TextStyle(
                    color: s.isActive ? AppTheme.success : AppTheme.error,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ),
          ),
          
          // Required Documents Column
          Expanded(
            flex: 5,
            child: s.requiredDocuments.isEmpty
                ? Text(
                    'No documents required',
                    style: TextStyle(
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: context.textSec.withValues(alpha: 0.7),
                    ),
                  )
                : Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: s.requiredDocuments.map((docName) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: context.isDark
                              ? const Color(0xFF334155).withValues(alpha: 0.4)
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: context.isDark
                                ? const Color(0xFF475569).withValues(alpha: 0.5)
                                : Colors.grey.shade200,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              LucideIcons.fileText,
                              size: 11,
                              color: context.textSec,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              docName,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: context.textPri.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
          
          // Actions Column
          Expanded(
            flex: 2,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: Icon(
                    LucideIcons.edit2,
                    size: 16,
                    color: context.textSec,
                  ),
                  tooltip: 'Edit program',
                  onPressed: () => _showScholarshipDialog(scholarship: s),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(
                    LucideIcons.trash2,
                    size: 16,
                    color: AppTheme.error,
                  ),
                  tooltip: 'Delete program',
                  onPressed: () => _confirmDelete(s),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileScholarshipCard(Scholarship s) {
    final Color tintColor = s.isActive ? AppTheme.primaryColor : Colors.grey;
    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark ? const Color(0xFF334155) : Colors.grey.shade200,
          width: 1.5,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 64,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: tintColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: tintColor.withValues(alpha: 0.2),
                    width: 1.5,
                  ),
                ),
                child: Text(
                  s.name,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: tintColor,
                  ),
                ),
              ),
              Row(
                children: [
                  IconButton(
                    icon: Icon(
                      LucideIcons.edit2,
                      size: 16,
                      color: context.textSec,
                    ),
                    onPressed: () => _showScholarshipDialog(scholarship: s),
                  ),
                  IconButton(
                    icon: const Icon(
                      LucideIcons.trash2,
                      size: 16,
                      color: AppTheme.error,
                    ),
                    onPressed: () => _confirmDelete(s),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            s.name,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: context.textPri,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            s.description,
            style: TextStyle(
              fontSize: 12,
              color: context.textSec,
            ),
          ),
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: s.isActive
                      ? AppTheme.success.withValues(alpha: 0.08)
                      : AppTheme.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: s.isActive
                        ? AppTheme.success.withValues(alpha: 0.2)
                        : AppTheme.error.withValues(alpha: 0.2),
                  ),
                ),
                child: Text(
                  s.isActive ? 'ACTIVE' : 'INACTIVE',
                  style: TextStyle(
                    color: s.isActive ? AppTheme.success : AppTheme.error,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Row(
                children: [
                  Icon(
                    LucideIcons.fileText,
                    size: 12,
                    color: context.textSec,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${s.requiredDocuments.length} Requirements',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: context.textSec,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showScholarshipDialog({Scholarship? scholarship}) {
    final nameController = TextEditingController(text: scholarship?.name);
    final descController = TextEditingController(
      text: scholarship?.description,
    );
    final docsController = TextEditingController(
      text: scholarship?.requiredDocuments.join(', '),
    );
    bool isActive = scholarship?.isActive ?? true;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            scholarship == null ? 'Add Scholarship' : 'Edit Scholarship',
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Program Name (e.g. TES)',
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: docsController,
                  decoration: const InputDecoration(
                    labelText: 'Required Documents (comma separated)',
                    hintText: 'e.g. ID Card, Enrollment Form',
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Active Status'),
                  value: isActive,
                  onChanged: (val) => setDialogState(() => isActive = val),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final names = docsController.text
                    .split(',')
                    .map((e) => e.trim())
                    .where((e) => e.isNotEmpty)
                    .toList();
                if (scholarship == null) {
                  await _scholarshipService.addScholarship(
                    Scholarship(
                      id: '',
                      name: nameController.text.trim(),
                      description: descController.text.trim(),
                      isActive: isActive,
                      requiredDocuments: names,
                    ),
                  );
                } else {
                  await _scholarshipService.updateScholarship(scholarship.id, {
                    'name': nameController.text.trim(),
                    'description': descController.text.trim(),
                    'isActive': isActive,
                    'requiredDocuments': names,
                  });
                }
                if (mounted) Navigator.pop(context);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(Scholarship s) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Scholarship'),
        content: Text(
          'Are you sure you want to delete ${s.name}? This might affect existing students.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            onPressed: () async {
              await _scholarshipService.deleteScholarship(s.id);
              if (mounted) Navigator.pop(context);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
