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
                      return GridView.builder(
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 360,
                          childAspectRatio: 1.4,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                        ),
                        itemCount: scholarships.length,
                        itemBuilder: (context, index) {
                          final s = scholarships[index];
                          return _buildScholarshipCard(s);
                        },
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

  Widget _buildScholarshipCard(Scholarship s) {
    return Container(
      decoration: context.crispDecoration.copyWith(
        border: Border.all(
          color: context.isDark
              ? const Color(0xFF334155)
              : Colors.grey.shade300,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDark ? 0.3 : 0.05),
            offset: const Offset(0, 4),
            blurRadius: 12,
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
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
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
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
          const SizedBox(height: 12),
          Text(
            s.name,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: context.textPri,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            s.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: context.textSec, height: 1.3),
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  LucideIcons.fileText,
                  size: 14,
                  color: AppTheme.primaryColor.withValues(alpha: 0.7),
                ),
                const SizedBox(width: 8),
                Text(
                  '${s.requiredDocuments.length} Required Documents',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: context.textPri.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
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
