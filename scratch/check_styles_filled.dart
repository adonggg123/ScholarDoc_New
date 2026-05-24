import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  final bytes = File('scratch/final_filled.xlsx').readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);

  print('=== FILLED SHEET2.XML — ROW 42 CELLS (should have s= attrs) ===');
  final s2 = archive.files.firstWhere((f) => f.name == 'xl/worksheets/sheet2.xml');
  final doc2 = XmlDocument.parse(String.fromCharCodes(s2.content));
  final row42 = doc2.findAllElements('row').firstWhere(
    (r) => r.getAttribute('r') == '42', orElse: () => XmlElement(XmlName('row')));
  for (final c in row42.findElements('c')) {
    final val = c.findElements('v').firstOrNull?.innerText
        ?? c.findElements('is').firstOrNull?.findElements('t').firstOrNull?.innerText
        ?? '';
    print('  ${c.getAttribute('r')}  s=${c.getAttribute('s')}  val="$val"');
  }

  print('\n=== FILLED SHEET3.XML — ROW 34 CELLS ===');
  final s3 = archive.files.firstWhere((f) => f.name == 'xl/worksheets/sheet3.xml');
  final doc3 = XmlDocument.parse(String.fromCharCodes(s3.content));
  final row34 = doc3.findAllElements('row').firstWhere(
    (r) => r.getAttribute('r') == '34', orElse: () => XmlElement(XmlName('row')));
  for (final c in row34.findElements('c')) {
    final val = c.findElements('v').firstOrNull?.innerText
        ?? c.findElements('is').firstOrNull?.findElements('t').firstOrNull?.innerText
        ?? '';
    print('  ${c.getAttribute('r')}  s=${c.getAttribute('s')}  val="$val"');
  }
}
