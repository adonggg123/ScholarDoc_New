import 'dart:io';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

void main() {
  final origBytes = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx').readAsBytesSync();
  final genBytes = File('scratch/filled_scenario_a.xlsx').readAsBytesSync();

  final origArchive = ZipDecoder().decodeBytes(origBytes);
  final genArchive = ZipDecoder().decodeBytes(genBytes);

  // List all files in both archives
  final origFiles = {for (final f in origArchive) f.name: f};
  final genFiles = {for (final f in genArchive) f.name: f};

  print('=== Files in original but not in generated ===');
  for (final name in origFiles.keys) {
    if (!genFiles.containsKey(name)) print('  MISSING: $name');
  }

  print('\n=== Files in generated but not in original ===');
  for (final name in genFiles.keys) {
    if (!origFiles.containsKey(name)) print('  NEW: $name');
  }

  print('\n=== File size differences ===');
  for (final name in origFiles.keys) {
    if (genFiles.containsKey(name)) {
      final origSize = (origFiles[name]!.content as List<int>).length;
      final genSize = (genFiles[name]!.content as List<int>).length;
      if (origSize != genSize) {
        print('  $name: orig=$origSize bytes, gen=$genSize bytes (diff=${genSize - origSize})');
      }
    }
  }
  
  // Now specifically check if sheet2.xml has any invalid XML characters in the generated file
  print('\n=== Scanning sheet2.xml for invalid XML chars ===');
  final sheet2File = genFiles['xl/worksheets/sheet2.xml'];
  if (sheet2File != null) {
    final raw = sheet2File.content as List<int>;
    // Check for invalid XML characters (control chars except tab, LF, CR)
    final invalid = <int>[];
    for (int i = 0; i < raw.length; i++) {
      final b = raw[i];
      if (b < 0x09 || (b > 0x0D && b < 0x20)) {
        invalid.add(i);
        if (invalid.length <= 10) {
          print('  Invalid char 0x${b.toRadixString(16).padLeft(2, '0')} at byte offset $i');
          // Print context
          final start = i > 30 ? i - 30 : 0;
          final end = i + 30 < raw.length ? i + 30 : raw.length;
          print('  Context: ...${String.fromCharCodes(raw.sublist(start, end)).replaceAll('\r', '\\r').replaceAll('\n', '\\n')}...');
        }
      }
    }
    if (invalid.isEmpty) print('  No invalid XML characters found in sheet2.xml');
    else print('  Total invalid chars: ${invalid.length}');
  }

  // Same for sheet3.xml
  print('\n=== Scanning sheet3.xml for invalid XML chars ===');
  final sheet3File = genFiles['xl/worksheets/sheet3.xml'];
  if (sheet3File != null) {
    final raw = sheet3File.content as List<int>;
    final invalid = <int>[];
    for (int i = 0; i < raw.length; i++) {
      final b = raw[i];
      if (b < 0x09 || (b > 0x0D && b < 0x20)) {
        invalid.add(i);
        if (invalid.length <= 10) {
          print('  Invalid char 0x${b.toRadixString(16).padLeft(2, '0')} at byte offset $i');
          final start = i > 30 ? i - 30 : 0;
          final end = i + 30 < raw.length ? i + 30 : raw.length;
          print('  Context: ...${String.fromCharCodes(raw.sublist(start, end)).replaceAll('\r', '\\r').replaceAll('\n', '\\n')}...');
        }
      }
    }
    if (invalid.isEmpty) print('  No invalid XML characters found in sheet3.xml');
    else print('  Total invalid chars: ${invalid.length}');
  }
}
