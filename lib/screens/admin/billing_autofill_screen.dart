import 'package:excel/excel.dart' hide Border;
import 'package:file_picker/file_picker.dart';
import 'package:file_saver/file_saver.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/billing_service.dart';
import '../../theme/app_theme.dart';
import '../../theme/theme_provider.dart';

class BillingAutofillScreen extends StatefulWidget {
  final List<Map<String, dynamic>>? selectedStudents;
  const BillingAutofillScreen({super.key, this.selectedStudents});

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
  bool _isAnnex5 = false;
  Annex5FillResult? _annex5Result;

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
          _isAnnex5 = false;
          _annex5Result = null;
        });
        _analyzeFile();
      }
    } catch (e) {
      _showError('Failed to pick file: $e');
    }
  }

  Future<void> _analyzeFile() async {
    if (_uploadedFile == null) return;
    setState(() {
      _isLoading = true;
      _isAnnex5 = false;
      _annex5Result = null;
    });
    try {
      final bytes = _uploadedFile!.bytes;
      if (bytes != null && (_uploadedFile!.extension == 'xlsx' || _uploadedFile!.extension == 'xls')) {
        final excel = Excel.decodeBytes(bytes);
        if (excel.tables.containsKey('Annex 5-TES New Form 2')) {
          setState(() {
            _isAnnex5 = true;
            _isLoading = false;
          });
          _showSuccess('Detected official Annex 5 TES Billing Form template!');
          return;
        }
      }

      final data = await _billingService.parseFile(_uploadedFile!);
      setState(() {
        _processedData = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _isAnnex5 = false;
      });
      _showError('Analysis failed: $e');
    }
  }

  Future<void> _processAutoFill() async {
    setState(() => _isProcessing = true);
    try {
      if (_isAnnex5) {
        if (_uploadedFile?.bytes == null) {
          throw Exception('File data is not loaded.');
        }
        final result = await _billingService.fillAnnex5Template(_uploadedFile!.bytes!, customStudents: widget.selectedStudents);
        setState(() {
          _annex5Result = result;
          _stats = {
            'total': result.totalCount,
            'matched': result.continuingCount + result.newCount,
            'continuing': result.continuingCount,
            'new': result.newCount,
            'unmatched': 0,
            'duplicates': 0,
          };
          _isProcessing = false;
        });
        _showSuccess('Auto-fill completed successfully for Annex 5 template!');
      } else {
        if (_processedData == null) return;
        final result = await _billingService.processBillingData(_processedData!);
        setState(() {
          _processedData = List<Map<String, dynamic>>.from(result['processedData']);
          _stats = result['stats'];
          _isProcessing = false;
        });
        _showSuccess('Auto-fill generation completed. File is ready for download/export.');
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      _showError('Processing failed: $e');
    }
  }

  Future<void> _generateDirectAnnex5() async {
    setState(() => _isProcessing = true);
    try {
      final data = await DefaultAssetBundle.of(context).load('assets/Annex 5-TES New Form 2.xlsx');
      final bytes = data.buffer.asUint8List();
      
      final result = await _billingService.fillAnnex5Template(bytes, customStudents: widget.selectedStudents);
      
      setState(() {
        _isAnnex5 = true;
        _annex5Result = result;
        _stats = {
          'total': result.totalCount,
          'matched': result.continuingCount + result.newCount,
          'continuing': result.continuingCount,
          'new': result.newCount,
          'unmatched': 0,
          'duplicates': 0,
        };
        _isProcessing = false;
      });
      
      final String fileName = 'Annex 5-TES New Form 2.xlsx';
      await FileSaver.instance.saveFile(
        name: fileName,
        bytes: result.bytes,
      );
      
      _showSuccess('Successfully populated and downloaded official Annex 5 Billing Form!');
    } catch (e) {
      setState(() => _isProcessing = false);
      _showError('Direct generation failed: $e');
    }
  }

  Future<void> _downloadResult({bool asCsv = false}) async {
    try {
      if (_isAnnex5) {
        if (_annex5Result == null) return;
        final String originalName = _uploadedFile?.name ?? 'Annex 5-TES New Form 2.xlsx';
        final String fileName = 'AutoFilled_${originalName.replaceAll(RegExp(r'\..+$'), '')}.xlsx';
        await FileSaver.instance.saveFile(
          name: fileName,
          bytes: _annex5Result!.bytes,
        );
        _showSuccess('File downloaded successfully!');
      } else {
        if (_processedData == null || _uploadedFile == null) return;
        await _billingService.exportFile(_processedData!, _uploadedFile!.name, asCsv: asCsv);
        _showSuccess('File downloaded successfully!');
      }
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

    return Container(
      constraints: const BoxConstraints(maxWidth: 800),
      decoration: BoxDecoration(
        color: context.bgC,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: context.isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.08),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 40,
            offset: const Offset(0, 24),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Premium Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.primaryColor, AppTheme.secondaryColor],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryColor.withValues(alpha: 0.15),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    LucideIcons.sparkles,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Auto-Fill Billing Generator',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'CHED Annex 5 TES Billing Template Automation',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.x, color: Colors.white),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.15),
                    hoverColor: Colors.white.withValues(alpha: 0.25),
                  ),
                ),
              ],
            ),
          ),
          
          // Scrollable Body
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: isMobile ? 16 : 32,
                vertical: 24,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_uploadedFile == null) ...[
                    _buildDirectGeneratorSection(context),
                  ] else ...[
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
          ),
        ],
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
          'Generate the official CHED Annex 5 TES Billing Form using student records from the master list.',
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
        height: 260,
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

  Widget _buildDirectGeneratorSection(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: context.crispDecoration.copyWith(
        border: Border.all(color: Colors.amber.withOpacity(0.2), width: 1.5),
        gradient: LinearGradient(
          colors: [
            AppTheme.primaryColor.withOpacity(0.02),
            Colors.amber.withOpacity(0.02),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.fileSpreadsheet,
                  color: Colors.amber,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Direct Annex 5 Government Form Generator',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Official CHED Tertiary Education Subsidy (TES) Billing Template',
                      style: TextStyle(
                        color: context.textSec,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Generate the complete Annex 5 Billing Excel workbook in one click. The system will load the default government template, automatically query the Firestore database, segment scholars, parse their details, and trigger an instant download with all formatting preserved.',
            style: TextStyle(fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: _isProcessing ? null : _generateDirectAnnex5,
                icon: _isProcessing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(LucideIcons.sparkles),
                label: Text(_isProcessing ? 'Generating...' : 'Auto-Fill Annex 5 Form'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              if (_isProcessing)
                Text(
                  'Querying database and compiling sheets...',
                  style: TextStyle(
                    fontStyle: FontStyle.italic,
                    color: context.textSec,
                    fontSize: 13,
                  ),
                ),
            ],
          ),
        ],
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
                  _isAnnex5
                      ? 'Detected Official Annex 5 TES Billing Form Template'
                      : '${(_uploadedFile!.size / 1024).toStringAsFixed(1)} KB • ${_processedData?.length ?? 0} Records detected',
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
              _isAnnex5 = false;
              _annex5Result = null;
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsPanel(BuildContext context) {
    final s = _stats!;
    if (_isAnnex5) {
      return Row(
        children: [
          _buildStatCard('Total TES Scholars', s['total'].toString(), LucideIcons.users, Colors.blue),
          const SizedBox(width: 16),
          _buildStatCard('Continuing (Form 2)', s['continuing'].toString(), LucideIcons.arrowUpRight, AppTheme.success),
          const SizedBox(width: 16),
          _buildStatCard('New Grantees (Form 3)', s['new'].toString(), LucideIcons.sparkles, AppTheme.warning),
        ],
      );
    }
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.success,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            ),
          ),
          if (!_isAnnex5) ...[
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: () => _downloadResult(asCsv: true),
              icon: const Icon(LucideIcons.fileOutput),
              label: const Text('Export CSV'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              ),
            ),
          ],
        ],
        const Spacer(),
        if (_isLoading)
          const CircularProgressIndicator(strokeWidth: 2)
        else
          Text(
            _isAnnex5
                ? (_annex5Result == null ? 'Ready for auto-fill' : 'Government Form Generated')
                : (_processedData == null ? 'Analyze file first' : 'Previewing Data'),
            style: TextStyle(color: context.textSec, fontStyle: FontStyle.italic),
          ),
      ],
    );
  }

  Widget _buildChecklistItem(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(LucideIcons.check, color: AppTheme.success, size: 16),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
      ],
    );
  }

  Widget _buildPreviewTable(BuildContext context) {
    if (_isAnnex5) {
      if (_annex5Result == null) return const SizedBox.shrink();
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: context.crispDecoration,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.success.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 20),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Annex 5 Billing Form Auto-Fill Complete',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'The official CHED billing Excel workbook has been dynamically compiled and populated. The following operations were completed successfully:',
              style: TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            _buildChecklistItem('Continuing TES scholars were successfully inserted into Annex 5-TES New Form 2 (Row 42 onwards).'),
            const SizedBox(height: 8),
            _buildChecklistItem('New TES scholars were successfully inserted into Annex 5-TES New Form 3 (Row 34 onwards).'),
            const SizedBox(height: 8),
            _buildChecklistItem('Student names were parsed and split into Last Name, Given Name, and Middle Initial.'),
            const SizedBox(height: 8),
            _buildChecklistItem('Total and formula cell ranges were preserved for official CHED verification.'),
          ],
        ),
      );
    }

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
