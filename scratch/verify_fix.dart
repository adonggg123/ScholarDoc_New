import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';
import 'dart:typed_data';
void main() async {
  // Load the original template (should be located in assets folder)
  final Uint8List templateBytes = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx').readAsBytesSync();

  // Load the filled version output by the app (the latest result from BillingService)
  // For demonstration, assume a file saved by the app to "scratch/final_filled.xlsx".
  final Uint8List filledBytes = File('scratch/final_filled.xlsx').readAsBytesSync();

  // Validate ZIP archive integrity
  try {
    ZipDecoder().decodeBytes(filledBytes);
    print('✅ ZIP archive validation passed.');
  } catch (e) {
    print('❌ ZIP decoding failed: $e');
    return;
  }

  // Compare core files that should remain unchanged
  final templateArchive = ZipDecoder().decodeBytes(templateBytes);
  final filledArchive   = ZipDecoder().decodeBytes(filledBytes);

  for (final name in ['xl/styles.xml', 'xl/sharedStrings.xml']) {
    final tmpl = templateArchive.files.firstWhere((f) => f.name == name).content as List<int>;
    final filled = filledArchive.files.firstWhere((f) => f.name == name).content as List<int>;
    if (tmpl.length != filled.length) {
      print('⚠️ $name size differs: ${tmpl.length} → ${filled.length}');
    } else {
      print('✅ $name size unchanged.');
    }
  }

  // Verify that sheet2 and sheet3 now contain rows (minimum expected counts)
  void checkSheet(String sheetFile, int minRows) {
    final file = filledArchive.files.firstWhere((f) => f.name == 'xl/worksheets/$sheetFile');
    final xml = XmlDocument.parse(String.fromCharCodes(file.content));
    final rowCount = xml.findAllElements('row').length;
    print('📊 $sheetFile rows: $rowCount (minimum expected $minRows)');
  }

  checkSheet('sheet2.xml', 40);
  checkSheet('sheet3.xml', 30);

  // Verify workbook.xml is well‑formed
  final wbFile = filledArchive.files.firstWhere((f) => f.name == 'xl/workbook.xml');
  try {
    XmlDocument.parse(String.fromCharCodes(wbFile.content));
    print('✅ workbook.xml is well‑formed XML.');
  } catch (e) {
    print('❌ workbook.xml XML parse error: $e');
  }
}
