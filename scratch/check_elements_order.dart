import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  try {
    print('=== Child elements of <worksheet> in filled_scenario_a.xlsx ===');
    printChildrenOrder('scratch/filled_scenario_a.xlsx');
  } catch (e, s) {
    print('Global error: $e');
    print(s);
  }
}

void printChildrenOrder(String path) {
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  
  for (final file in archive) {
    if (file.name == 'xl/worksheets/sheet2.xml') {
      final xmlString = String.fromCharCodes(file.content);
      final document = XmlDocument.parse(xmlString);
      final worksheet = document.rootElement;
      for (final child in worksheet.children) {
        if (child is XmlElement) {
          print('Tag: <${child.name.local}>, attributes=${child.attributes.map((a) => '${a.name.local}="${a.value}"').join(', ')}');
        }
      }
    }
  }
}
