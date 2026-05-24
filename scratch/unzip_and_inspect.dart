import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  try {
    print('=== MERGE CELLS in filled_scenario_a.xlsx ===');
    printAllMergeCells('scratch/filled_scenario_a.xlsx');
  } catch (e, s) {
    print('Global error: $e');
    print(s);
  }
}

void printAllMergeCells(String path) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  
  for (final file in archive) {
    if (file.name == 'xl/worksheets/sheet2.xml') {
      final xmlString = String.fromCharCodes(file.content);
      final document = XmlDocument.parse(xmlString);
      final mergeCells = document.findAllElements('mergeCell');
      print('Total mergeCell elements: ${mergeCells.length}');
      for (final mc in mergeCells) {
        print('  ${mc.getAttribute('ref')}');
      }
    }
  }
}
