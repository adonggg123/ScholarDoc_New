import 'package:csv/csv.dart';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:file_saver/file_saver.dart';
import 'package:flutter/foundation.dart';

class BillingService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Parses an uploaded file (CSV or Excel) and returns a list of rows as Maps.
  Future<List<Map<String, dynamic>>> parseFile(PlatformFile file) async {
    try {
      final Uint8List bytes = file.bytes!;
      final String extension = file.extension?.toLowerCase() ?? '';

      if (extension == 'csv') {
        final String csvString = utf8.decode(bytes);
        final List<List<dynamic>> rows = const CsvDecoder().convert(csvString);
        if (rows.isEmpty) return [];

        final List<String> headers = rows[0].map((e) => e.toString().trim()).toList();
        return rows.skip(1).map((row) {
          final Map<String, dynamic> data = {};
          for (int i = 0; i < headers.length; i++) {
            if (i < row.length) {
              data[headers[i]] = row[i];
            }
          }
          return data;
        }).toList();
      } else if (extension == 'xlsx' || extension == 'xls') {
        final Excel excel = Excel.decodeBytes(bytes);
        final String sheetName = excel.tables.keys.first;
        final Sheet? sheet = excel.tables[sheetName];

        if (sheet == null || sheet.maxRows == 0) return [];

        final List<String> headers = sheet.rows[0].map((cell) => cell?.value?.toString().trim() ?? '').toList();
        final List<Map<String, dynamic>> dataList = [];

        for (int i = 1; i < sheet.maxRows; i++) {
          final Map<String, dynamic> data = {};
          final List<Data?> row = sheet.rows[i];
          for (int j = 0; j < headers.length; j++) {
            if (j < row.length) {
              data[headers[j]] = row[j]?.value?.toString() ?? '';
            }
          }
          dataList.add(data);
        }
        return dataList;
      } else {
        throw Exception('Unsupported file format: $extension');
      }
    } catch (e) {
      debugPrint('BillingService: Error parsing file: $e');
      rethrow;
    }
  }

  /// Matches uploaded records with master list in Firestore.
  /// Returns a list of processed records with matched data.
  Future<Map<String, dynamic>> processBillingData(List<Map<String, dynamic>> uploadedData) async {
    int matchedCount = 0;
    int unmatchedCount = 0;
    int duplicateCount = 0;
    final List<Map<String, dynamic>> processedData = [];
    final Set<String> processedIds = {};

    // Get all students for efficient matching (if dataset is small enough)
    // For 400+ scholars, we can fetch all or do individual queries.
    // Fetching all is usually faster than 400 separate Firestore calls if students < 2000.
    final QuerySnapshot masterSnap = await _firestore.collection('students').get();
    final List<Map<String, dynamic>> masterList = masterSnap.docs.map((doc) {
      final data = doc.data() as Map<String, dynamic>;
      data['uid'] = doc.id;
      return data;
    }).toList();

    for (var row in uploadedData) {
      final String studentId = _getValue(row, ['Student ID', 'ID Number', 'Student No', 'ID']).toString().trim();
      final String fullName = _getValue(row, ['Full Name', 'Name', 'Student Name']).toString().trim();
      final String scholarship = _getValue(row, ['Scholarship Type', 'Scholarship', 'Type']).toString().trim();

      // Check for duplicates in the uploaded file
      final String uniqueKey = studentId.isNotEmpty ? studentId : fullName;
      if (uniqueKey.isNotEmpty && processedIds.contains(uniqueKey)) {
        duplicateCount++;
      }
      processedIds.add(uniqueKey);

      // Attempt matching
      Map<String, dynamic>? match;

      // 1. Try Student ID match
      if (studentId.isNotEmpty) {
        match = masterList.firstWhere(
          (s) => s['studentId']?.toString().trim() == studentId,
          orElse: () => {},
        );
        if (match.isEmpty) match = null;
      }

      // 2. Try Name match if ID fails
      if (match == null && fullName.isNotEmpty) {
        match = masterList.firstWhere(
          (s) => s['fullName']?.toString().trim().toLowerCase() == fullName.toLowerCase(),
          orElse: () => {},
        );
        if (match.isEmpty) match = null;
      }

      // 3. Try Scholarship + Name match if still no match
      if (match == null && fullName.isNotEmpty && scholarship.isNotEmpty) {
        match = masterList.firstWhere(
          (s) => 
              s['fullName']?.toString().trim().toLowerCase() == fullName.toLowerCase() &&
              (s['scholarshipName']?.toString().trim().toLowerCase() == scholarship.toLowerCase() ||
               s['scholarshipType']?.toString().trim().toLowerCase() == scholarship.toLowerCase()),
          orElse: () => {},
        );
        if (match.isEmpty) match = null;
      }

      final Map<String, dynamic> resultRow = Map<String, dynamic>.from(row);

      if (match != null) {
        matchedCount++;
        resultRow['matchStatus'] = 'matched';
        
        // Auto-fill missing fields
        _fillIfEmpty(resultRow, match, 'Student ID', ['studentId']);
        _fillIfEmpty(resultRow, match, 'Full Name', ['fullName']);
        _fillIfEmpty(resultRow, match, 'Scholarship Type', ['scholarshipName', 'scholarshipType']);
        _fillIfEmpty(resultRow, match, 'Course/Program', ['course', 'program']);
        _fillIfEmpty(resultRow, match, 'Year Level', ['year', 'scholarYearLevel', 'yearLevel']);
        _fillIfEmpty(resultRow, match, 'Semester', ['semester']);
        _fillIfEmpty(resultRow, match, 'Academic Year', ['academicYear', 'ay']);
        _fillIfEmpty(resultRow, match, 'SA Number', ['saNumber']);
        _fillIfEmpty(resultRow, match, 'Status', ['status']);
      } else {
        unmatchedCount++;
        resultRow['matchStatus'] = 'unmatched';
      }

      processedData.add(resultRow);
    }

    return {
      'processedData': processedData,
      'stats': {
        'total': uploadedData.length,
        'matched': matchedCount,
        'unmatched': unmatchedCount,
        'duplicates': duplicateCount,
      }
    };
  }

  /// Exports processed data to the original format or Excel.
  Future<void> exportFile(List<Map<String, dynamic>> data, String originalFileName, {bool asCsv = false}) async {
    if (data.isEmpty) return;

    final List<String> headers = data.first.keys.where((k) => k != 'matchStatus').toList();

    if (asCsv) {
      final List<List<dynamic>> rows = [headers];
      for (var row in data) {
        rows.add(headers.map((h) => row[h]).toList());
      }
      final String csvData = const CsvEncoder().convert(rows);
      final String fileName = 'AutoFilled_${originalFileName.replaceAll(RegExp(r'\..+$'), '')}.csv';
      await FileSaver.instance.saveFile(
        name: fileName,
        bytes: Uint8List.fromList(utf8.encode(csvData)),
      );
    } else {
      final Excel excel = Excel.createExcel();
      final Sheet sheet = excel[excel.getDefaultSheet()!];

      // Add headers
      for (int i = 0; i < headers.length; i++) {
        final cell = sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0));
        cell.value = TextCellValue(headers[i]);
        cell.cellStyle = CellStyle(bold: true, backgroundColorHex: ExcelColor.fromHexString('#F3F4F6'));
      }

      // Add data
      for (int i = 0; i < data.length; i++) {
        final rowData = data[i];
        for (int j = 0; j < headers.length; j++) {
          final cell = sheet.cell(CellIndex.indexByColumnRow(columnIndex: j, rowIndex: i + 1));
          final value = rowData[headers[j]];
          cell.value = TextCellValue(value?.toString() ?? '');
          
          // Highlight matched rows slightly or highlight auto-filled cells?
          // User requested highlighting unmatched rows for manual review in UI, 
          // but for export let's keep it clean.
        }
      }

      final List<int>? fileBytes = excel.save();
      if (fileBytes != null) {
        final String fileName = 'AutoFilled_${originalFileName.replaceAll(RegExp(r'\..+$'), '')}.xlsx';
        await FileSaver.instance.saveFile(
          name: fileName,
          bytes: Uint8List.fromList(fileBytes),
        );
      }
    }
  }

  // --- Helper Methods ---

  dynamic _getValue(Map<String, dynamic> row, List<String> keys) {
    for (var key in keys) {
      if (row.containsKey(key) && row[key] != null && row[key].toString().isNotEmpty) {
        return row[key];
      }
      // Case insensitive search
      final actualKey = row.keys.firstWhere(
        (k) => k.toLowerCase() == key.toLowerCase(),
        orElse: () => '',
      );
      if (actualKey.isNotEmpty && row[actualKey] != null && row[actualKey].toString().isNotEmpty) {
        return row[actualKey];
      }
    }
    return '';
  }

  void _fillIfEmpty(Map<String, dynamic> resultRow, Map<String, dynamic> match, String targetKey, List<String> sourceKeys) {
    // 1. Check if targetKey already exists and has value
    final existingValue = _getValue(resultRow, [targetKey]);
    if (existingValue.toString().isNotEmpty && existingValue != 'N/A') return;

    // 2. Try to find a source key that matches the targetKey concept
    for (var skey in sourceKeys) {
      if (match.containsKey(skey) && match[skey] != null && match[skey].toString().isNotEmpty) {
        // Find the actual key in resultRow to update, or create targetKey
        final actualKey = resultRow.keys.firstWhere(
          (k) => k.toLowerCase() == targetKey.toLowerCase(),
          orElse: () => targetKey,
        );
        resultRow[actualKey] = match[skey].toString();
        return;
      }
    }
  }
}
