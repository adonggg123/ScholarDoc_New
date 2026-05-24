import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  try {
    print('=== ALL MERGE CELLS in ORIGINAL template (sheet2) ===');
    printAllMergeCells('assets/0_Annex_5_TES_New_Billing_Form.xlsx', 'xl/worksheets/sheet2.xml');

    print('\n=== ALL MERGE CELLS in filled_scenario_b.xlsx (sheet2) [10 inserts] ===');
    printAllMergeCells('scratch/filled_scenario_b.xlsx', 'xl/worksheets/sheet2.xml');

    print('\n=== ALL MERGE CELLS in filled_scenario_a.xlsx (sheet2) [0 inserts] ===');
    printAllMergeCells('scratch/filled_scenario_a.xlsx', 'xl/worksheets/sheet2.xml');
    
    print('\n=== Checking highest row r attribute in scenario_b sheet2 ===');
    checkHighestRow('scratch/filled_scenario_b.xlsx', 'xl/worksheets/sheet2.xml');
  } catch (e, s) {
    print('Error: $e\n$s');
  }
}

void printAllMergeCells(String path, String sheetPath) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  for (final file in archive) {
    if (file.name == sheetPath) {
      final doc = XmlDocument.parse(String.fromCharCodes(file.content));
      final mcs = doc.findAllElements('mergeCell').toList();
      print('Count: ${mcs.length}');
      for (final mc in mcs) print('  ${mc.getAttribute('ref')}');
    }
  }
}

void checkHighestRow(String path, String sheetPath) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  for (final file in archive) {
    if (file.name == sheetPath) {
      final doc = XmlDocument.parse(String.fromCharCodes(file.content));
      final rows = doc.findAllElements('row').toList();
      int maxR = 0;
      for (final row in rows) {
        final r = int.tryParse(row.getAttribute('r') ?? '0') ?? 0;
        if (r > maxR) maxR = r;
      }
      print('Highest row r attribute: $maxR');
      print('Total rows: ${rows.length}');
    }
  }
}
