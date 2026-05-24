import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';
import 'dart:typed_data';

void main() {
  final bytes = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx').readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);

  // First, read sharedStrings for decoding inline string references
  final ssFile = archive.files.firstWhere((f) => f.name == 'xl/sharedStrings.xml');
  final ssDoc = XmlDocument.parse(String.fromCharCodes(ssFile.content));
  final sharedStrings = ssDoc.findAllElements('si').map((si) {
    return si.findAllElements('t').map((t) => t.innerText).join();
  }).toList();

  // Read workbook.xml to map sheet names to their file paths
  final wbFile = archive.files.firstWhere((f) => f.name == 'xl/workbook.xml');
  final wbRelFile = archive.files.firstWhere((f) => f.name == 'xl/_rels/workbook.xml.rels');
  final wbDoc = XmlDocument.parse(String.fromCharCodes(wbFile.content));
  final wbRelDoc = XmlDocument.parse(String.fromCharCodes(wbRelFile.content));

  final rIdToTarget = <String, String>{};
  for (final rel in wbRelDoc.findAllElements('Relationship')) {
    final id = rel.getAttribute('Id') ?? '';
    final target = rel.getAttribute('Target') ?? '';
    if (target.contains('worksheets/')) rIdToTarget[id] = target;
  }

  print('=== Sheets in workbook ===');
  final sheetMap = <String, String>{};
  for (final sheet in wbDoc.findAllElements('sheet')) {
    final name = sheet.getAttribute('name') ?? '';
    final rId = sheet.getAttribute('r:id') ?? sheet.getAttribute('id') ?? '';
    final target = rIdToTarget[rId] ?? '';
    final fullPath = target.startsWith('worksheets/') ? 'xl/$target' : target;
    print('  "$name" -> $fullPath');
    sheetMap[name] = fullPath;
  }

  // Inspect Form 2 and Form 3
  for (final formName in ['Annex 5-TES New Form 2', 'Annex 5-TES New Form 3']) {
    final path = sheetMap[formName];
    if (path == null) { print('\n⚠ "$formName" not found'); continue; }

    print('\n==============================');
    print('Sheet: "$formName" ($path)');
    print('==============================');

    final sheetFile = archive.files.firstWhere((f) => f.name == path);
    final sheetDoc = XmlDocument.parse(String.fromCharCodes(sheetFile.content));

    // Print first 50 rows with their cell addresses and values
    int rowsPrinted = 0;
    for (final row in sheetDoc.findAllElements('row')) {
      if (rowsPrinted >= 55) break;
      final rowNum = row.getAttribute('r') ?? '?';
      final cells = row.findElements('c').toList();
      if (cells.isEmpty) continue;

      final cellValues = <String>[];
      for (final c in cells) {
        final addr = c.getAttribute('r') ?? '?';
        final type = c.getAttribute('t') ?? '';
        final vEl = c.findElements('v').firstOrNull;
        final val = vEl?.innerText ?? '';

        String decoded;
        if (type == 's') {
          final idx = int.tryParse(val);
          decoded = (idx != null && idx < sharedStrings.length) ? sharedStrings[idx] : val;
        } else {
          decoded = val;
        }
        if (decoded.isNotEmpty) cellValues.add('$addr="$decoded"');
      }

      if (cellValues.isNotEmpty) {
        print('  Row $rowNum: ${cellValues.join(', ')}');
        rowsPrinted++;
      }
    }
  }
}
