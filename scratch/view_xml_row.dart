import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  try {
    print('=== Row 42 XML in test_out.xlsx ===');
    printRowXml('scratch/test_out.xlsx', 42);
    
    print('\n=== Row 42 XML in filled_scenario_a.xlsx ===');
    printRowXml('scratch/filled_scenario_a.xlsx', 42);
  } catch (e, s) {
    print('Global error: $e');
    print(s);
  }
}

void printRowXml(String path, int targetRowR) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  
  for (final file in archive) {
    if (file.name == 'xl/worksheets/sheet2.xml') {
      final xmlString = String.fromCharCodes(file.content);
      final document = XmlDocument.parse(xmlString);
      final rows = document.findAllElements('row');
      for (final row in rows) {
        if (row.getAttribute('r') == targetRowR.toString()) {
          print(row.toXmlString(pretty: true));
          return;
        }
      }
      print('Row $targetRowR not found in $path');
    }
  }
}
