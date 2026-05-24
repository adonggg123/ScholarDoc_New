import 'dart:io';
import 'package:archive/archive.dart';

void main() {
  // Compare original template vs generated file XML starts
  print('=== Original template sheet2.xml (first 500 chars) ===');
  printStart('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
  
  print('\n=== filled_scenario_a.xlsx sheet2.xml (first 500 chars) ===');
  printStart('scratch/filled_scenario_a.xlsx');
}

void printStart(String path) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  for (final file in archive) {
    if (file.name == 'xl/worksheets/sheet2.xml') {
      final raw = file.content as List<int>;
      // Print first 500 bytes as escaped string to see line endings
      final snippet = raw.take(500).toList();
      final visible = snippet.map((b) {
        if (b == 13) return '\\r';
        if (b == 10) return '\\n';
        return String.fromCharCode(b);
      }).join('');
      print(visible);
      return;
    }
  }
}
