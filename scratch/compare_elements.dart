import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  final origBytes = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx').readAsBytesSync();
  final genBytes = File('scratch/filled_scenario_a.xlsx').readAsBytesSync();
  final origArchive = ZipDecoder().decodeBytes(origBytes);
  final genArchive = ZipDecoder().decodeBytes(genBytes);
  final origFiles = {for (final f in origArchive) f.name: f};
  final genFiles = {for (final f in genArchive) f.name: f};

  for (final sheetName in ['xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']) {
    print('\n=== $sheetName comparison ===');
    compareWorksheet(origFiles[sheetName], genFiles[sheetName]);
  }
  
  print('\n=== xl/styles.xml child elements ===');
  compareStyles(origFiles['xl/styles.xml'], genFiles['xl/styles.xml']);
}

void compareWorksheet(dynamic origFile, dynamic genFile) {
  if (origFile == null || genFile == null) { print('Missing file'); return; }
  final origDoc = XmlDocument.parse(String.fromCharCodes(origFile.content));
  final genDoc  = XmlDocument.parse(String.fromCharCodes(genFile.content));
  
  // Compare child element counts at worksheet level
  final origChildren = origDoc.rootElement.children.whereType<XmlElement>().toList();
  final genChildren  = genDoc.rootElement.children.whereType<XmlElement>().toList();
  
  print('Original top-level elements: ${origChildren.length}');
  print('Generated top-level elements: ${genChildren.length}');
  
  final origTags = origChildren.map((e) => e.name.local).toList();
  final genTags  = genChildren.map((e) => e.name.local).toList();
  
  for (final tag in origTags) {
    if (!genTags.contains(tag)) print('  DROPPED element: <$tag>');
  }
  for (final tag in genTags) {
    if (!origTags.contains(tag)) print('  ADDED element: <$tag>');
  }
  
  // Check row count in sheetData
  final origRows = origDoc.findAllElements('row').length;
  final genRows  = genDoc.findAllElements('row').length;
  print('Row count: orig=$origRows, gen=$genRows');
  
  // Check cell count
  final origCells = origDoc.findAllElements('c').length;
  final genCells  = genDoc.findAllElements('c').length;
  print('Cell count: orig=$origCells, gen=$genCells (diff=${genCells - origCells})');
  
  // Check if any cells have <f> (formula) in original
  final origFormulas = origDoc.findAllElements('f').length;
  final genFormulas  = genDoc.findAllElements('f').length;
  print('Formula cells: orig=$origFormulas, gen=$genFormulas');
}

void compareStyles(dynamic origFile, dynamic genFile) {
  if (origFile == null || genFile == null) { print('Missing file'); return; }
  final origDoc = XmlDocument.parse(String.fromCharCodes(origFile.content));
  final genDoc  = XmlDocument.parse(String.fromCharCodes(genFile.content));
  
  for (final tag in ['fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles', 'dxfs']) {
    final origCount = origDoc.findAllElements(tag).firstOrNull?.children.whereType<XmlElement>().length ?? 0;
    final genCount  = genDoc.findAllElements(tag).firstOrNull?.children.whereType<XmlElement>().length ?? 0;
    if (origCount != genCount) print('  <$tag>: orig=$origCount, gen=$genCount (diff=${genCount - origCount})');
    else print('  <$tag>: $origCount (same)');
  }
}
