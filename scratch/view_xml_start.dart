import 'dart:io';
import 'package:archive/archive.dart';

void main() {
  try {
    final bytes = File('scratch/filled_scenario_a.xlsx').readAsBytesSync();
    final archive = ZipDecoder().decodeBytes(bytes);
    for (final file in archive) {
      if (file.name == 'xl/worksheets/sheet2.xml') {
        final xmlString = String.fromCharCodes(file.content);
        print('=== Start of sheet2.xml ===');
        print(xmlString.substring(0, xmlString.length > 2000 ? 2000 : xmlString.length));
        return;
      }
    }
  } catch (e, s) {
    print('Error: $e');
    print(s);
  }
}
