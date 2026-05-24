import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  try {
    print('=== STYLES in test_out.xlsx ===');
    inspectStyles('scratch/test_out.xlsx');
    
    print('\n=== STYLES in filled_scenario_a.xlsx ===');
    inspectStyles('scratch/filled_scenario_a.xlsx');
  } catch (e, s) {
    print('Global error: $e');
    print(s);
  }
}

void inspectStyles(String path) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  
  for (final file in archive) {
    if (file.name == 'xl/styles.xml') {
      final xmlString = String.fromCharCodes(file.content);
      try {
        final document = XmlDocument.parse(xmlString);
        print('Successfully parsed xl/styles.xml!');
        
        final cellXfs = document.findAllElements('cellXfs');
        if (cellXfs.isNotEmpty) {
          final xfList = cellXfs.first.findAllElements('xf');
          print('Number of cell formats (xf): ${xfList.length}');
        }
        
        final cellStyleXfs = document.findAllElements('cellStyleXfs');
        if (cellStyleXfs.isNotEmpty) {
          final xfList = cellStyleXfs.first.findAllElements('xf');
          print('Number of cell style formats (xf): ${xfList.length}');
        }
      } catch (e) {
        print('XML Parsing Error: $e');
      }
    }
  }
}
