import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/billing_service.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

class BillingAutofillScreen extends StatefulWidget {
  const BillingAutofillScreen({super.key});

  @override
  State<BillingAutofillScreen> createState() => _BillingAutofillScreenState();
}

class _BillingAutofillScreenState extends State<BillingAutofillScreen> {
  final BillingService _billingService = BillingService();
  
  PlatformFile? _uploadedFile;
  List<Map<String, dynamic>>? _processedData;
  Map<String, dynamic>? _stats;
  bool _isLoading = false;
  bool _isProcessing = false;

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv', 'xlsx', 'xls'],
        withData: true,
      );

      if (result != null) {
        setState(() {
          _uploadedFile = result.files.first;
          _processedData = null;
          _stats = null;
        });
        _analyzeFile();
      }
    } catch (e) {
      _showError('Failed to pick file: $e');
    }
  }

  Future<void> _analyzeFile() async {
    if (_uploadedFile == null) return;
    setState(() => _isLoading = true);
    try {
      final data = await _billingService.parseFile(_uploadedFile!);
      setState(() {
        _processedData = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      _showError('Analysis failed: $e');
    }
  }

  Future<void> _processAutoFill() async {
    if (_processedData == null) return;
    setState(() => _isProcessing = true);
    try {
      final result = await _billingService.processBillingData(_processedData!);
      setState(() {
        _processedData = List<Map<String, dynamic>>.from(result['processedData']);
        _stats = result['stats'];
        _isProcessing = false;
      });
      _showSuccess('Auto-fill generation completed. File is ready for download/export.');
    } catch (e) {
      setState(() => _isProcessing = false);
      _showError('Processing failed: $e');
    }
  }

  Future<void> _downloadResult({bool asCsv = false}) async {
    if (_processedData == null || _uploadedFile == null) return;
    try {
      await _billingService.exportFile(_processedData!, _uploadedFile!.name, asCsv: asCsv);
      _showSuccess('File downloaded successfully!');
    } catch (e) {
      _showError('Download failed: $e');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppTheme.error),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppTheme.success),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isMobile = MediaQuery.of(context).size.width < 900;

    return Scaffold(
      backgroundColor: context.bgC,
      appBar: AppBar(
        title: const Text('Auto-Fill Billing Generator'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 16 : 48,
          vertical: 24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            const SizedBox(height: 32),
            if (_uploadedFile == null)
              _buildUploadArea(context)
            else ...[
              _buildFileSummary(context),
              const SizedBox(height: 24),
              if (_stats != null) _buildStatsPanel(context),
              const SizedBox(height: 32),
              _buildActionToolbar(context),
              const SizedBox(height: 24),
              _buildPreviewTable(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Automated Scholarship Billing',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: context.textPri,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Upload a template file to automatically populate scholar information from the database.',
          style: TextStyle(color: context.textSec),
        ),
      ],
    );
  }

  Widget _buildUploadArea(BuildContext context) {
    return GestureDetector(
      onTap: _pickFile,
      child: Container(
        width: double.infinity,
        height: 300,
        decoration: context.glassDecoration.copyWith(
          border: Border.all(color: AppTheme.primaryColor.withOpacity(0.2), width: 2),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.uploadCloud, size: 48, color: AppTheme.primaryColor),
            ),
            const SizedBox(height: 24),
            Text(
              'Drag and drop your template here',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Supports CSV and Excel files (.xlsx, .xls)',
              style: TextStyle(color: context.textSec),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(LucideIcons.fileSearch),
              label: const Text('Browse Files'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileSummary(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: context.crispDecoration,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _uploadedFile!.extension == 'csv' ? LucideIcons.fileText : LucideIcons.fileSpreadsheet,
              color: AppTheme.primaryColor,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _uploadedFile!.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  '${(_uploadedFile!.size / 1024).toStringAsFixed(1)} KB • ${_processedData?.length ?? 0} Records detected',
                  style: TextStyle(color: context.textSec, fontSize: 13),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(LucideIcons.x, color: AppTheme.error),
            onPressed: () => setState(() {
              _uploadedFile = null;
              _processedData = null;
              _stats = null;
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsPanel(BuildContext context) {
    final s = _stats!;
    return Row(
      children: [
        _buildStatCard('Total Records', s['total'].toString(), LucideIcons.layers, Colors.blue),
        const SizedBox(width: 16),
        _buildStatCard('Matched', s['matched'].toString(), LucideIcons.checkCircle, AppTheme.success),
        const SizedBox(width: 16),
        _buildStatCard('Unmatched', s['unmatched'].toString(), LucideIcons.alertCircle, AppTheme.error),
        const SizedBox(width: 16),
        _buildStatCard('Duplicates', s['duplicates'].toString(), LucideIcons.copy, AppTheme.warning),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: context.glassDecoration,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 16),
            Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(color: context.textSec, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionToolbar(BuildContext context) {
    return Row(
      children: [
        if (_stats == null)
          ElevatedButton.icon(
            onPressed: _isProcessing ? null : _processAutoFill,
            icon: _isProcessing
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(LucideIcons.zap),
            label: Text(_isProcessing ? 'Processing...' : 'Run Auto-Fill'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            ),
          )
        else ...[
          ElevatedButton.icon(
            onPressed: () => _downloadResult(asCsv: false),
            icon: const Icon(LucideIcons.download),
            label: const Text('Download Excel'),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
          ),
          const SizedBox(width: 12),
          OutlinedButton.icon(
            onPressed: () => _downloadResult(asCsv: true),
            icon: const Icon(LucideIcons.fileOutput),
            label: const Text('Export CSV'),
          ),
        ],
        const Spacer(),
        if (_isLoading)
          const CircularProgressIndicator(strokeWidth: 2)
        else
          Text(
            _processedData == null ? 'Analyze file first' : 'Previewing Data',
            style: TextStyle(color: context.textSec, fontStyle: FontStyle.italic),
          ),
      ],
    );
  }

  Widget _buildPreviewTable(BuildContext context) {
    if (_processedData == null) return const SizedBox.shrink();

    final List<String> headers = _processedData!.first.keys.where((k) => k != 'matchStatus').toList();

    return Container(
      width: double.infinity,
      decoration: context.crispDecoration,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(context.isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade50),
            columns: headers.map((h) => DataColumn(label: Text(h, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(),
            rows: _processedData!.map((row) {
              final bool isMatched = row['matchStatus'] == 'matched';
              final bool isUnmatched = row['matchStatus'] == 'unmatched';
              
              return DataRow(
                color: WidgetStateProperty.resolveWith<Color?>((states) {
                  if (isUnmatched) return AppTheme.error.withOpacity(0.05);
                  if (isMatched) return AppTheme.success.withOpacity(0.05);
                  return null;
                }),
                cells: headers.map((h) {
                  return DataCell(
                    Text(
                      row[h]?.toString() ?? '',
                      style: TextStyle(
                        color: isUnmatched && (h.toLowerCase().contains('name') || h.toLowerCase().contains('id'))
                            ? AppTheme.error
                            : context.textPri,
                      ),
                    ),
                  );
                }).toList(),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}
