import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  checkSharedStrings('assets/0_Annex_5_TES_New_Billing_Form.xlsx', 'original');
  checkSharedStrings('scratch/filled_scenario_a.xlsx', 'scenario_a');
}

void checkSharedStrings(String path, String label) {
  print('\n=== $label sharedStrings.xml ===');
  final bytes = File(path).readAsBytesSync();
  final archive = ZipDecoder().decodeBytes(bytes);
  for (final file in archive) {
    if (file.name == 'xl/sharedStrings.xml') {
      final xmlBytes = file.content as List<int>;
      final xmlString = String.fromCharCodes(xmlBytes);
      print('Byte length: ${xmlBytes.length}');
      try {
        final doc = XmlDocument.parse(xmlString);
        final sst = doc.rootElement;
        print('count attr: ${sst.getAttribute('count')}');
        print('uniqueCount attr: ${sst.getAttribute('uniqueCount')}');
        final sis = sst.findAllElements('si').toList();
        print('Actual <si> elements: ${sis.length}');
        // Print last 5 entries to see what was added
        print('Last 5 shared strings:');
        for (int i = sis.length - 5; i < sis.length; i++) {
          if (i >= 0) print('  [$i]: ${sis[i].toXmlString()}');
        }
      } catch (e) {
        print('❌ XML PARSE ERROR: $e');
        // Dump the bad XML so we can inspect it
        File('scratch/${label}_sharedStrings_dump.xml').writeAsStringSync(xmlString);
        print('Dumped to scratch/${label}_sharedStrings_dump.xml');
        // Also print around the error position
        final lines = xmlString.split('\n');
        print('Line count: ${lines.length}');
        if (lines.length >= 2) print('Line 2: ${lines[1].substring(0, lines[1].length > 200 ? 200 : lines[1].length)}');
      }
    }
  }
}
