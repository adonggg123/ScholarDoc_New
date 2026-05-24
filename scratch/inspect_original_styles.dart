import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  final bytes = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx').readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);

  // Inspect sheet2.xml
  final sheet2File = archive.files.firstWhere((f) => f.name == 'xl/worksheets/sheet2.xml');
  final doc2 = XmlDocument.parse(String.fromCharCodes(sheet2File.content));
  final sheetData2 = doc2.findAllElements('sheetData').first;

  print('=== ORIGINAL SHEET2.XML ROW 42 CELLS ===');
  final row42 = sheetData2.findElements('row').firstWhere((r) => r.getAttribute('r') == '42', orElse: () => XmlElement(XmlName('row')));
  for (final cell in row42.findElements('c')) {
    print('Cell r="${cell.getAttribute('r')}" s="${cell.getAttribute('s')}" t="${cell.getAttribute('t')}"');
  }

  print('\n=== ORIGINAL SHEET3.XML ROW 34 CELLS ===');
  final sheet3File = archive.files.firstWhere((f) => f.name == 'xl/worksheets/sheet3.xml');
  final doc3 = XmlDocument.parse(String.fromCharCodes(sheet3File.content));
  final sheetData3 = doc3.findAllElements('sheetData').first;
  final row34 = sheetData3.findElements('row').firstWhere((r) => r.getAttribute('r') == '34', orElse: () => XmlElement(XmlName('row')));
  for (final cell in row34.findElements('c')) {
    print('Cell r="${cell.getAttribute('r')}" s="${cell.getAttribute('s')}" t="${cell.getAttribute('t')}"');
  }
}
