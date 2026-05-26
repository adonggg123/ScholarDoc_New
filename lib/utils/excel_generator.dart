import 'package:excel/excel.dart';
import 'package:file_saver/file_saver.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'dart:typed_data';

class ExcelGenerator {
  /// Exports the system audit logs to an Excel file
  static Future<void> generateAuditExcel(List<Map<String, dynamic>> logs) async {
    final Excel excel = Excel.createExcel();
    final Sheet sheetObject = excel['Activity Logs'];

    // Header Style
    final CellStyle headerStyle = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      backgroundColorHex: ExcelColor.fromHexString('#1A365D'), // Navy Blue
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );

    // 1. Add Title Row
    sheetObject.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0), 
                     CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: 0));
    final cell = sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0));
    cell.value = TextCellValue('ScholarDoc System Audit Report - ${DateFormat('yyyy-MM-dd').format(DateTime.now())}');
    cell.cellStyle = headerStyle;

    // 2. Add Header Row
    final List<String> headers = ['Timestamp', 'User Name', 'Role', 'Action Taken', 'Target Student ID'];
    for (int i = 0; i < headers.length; i++) {
      final cell = sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 1));
      cell.value = TextCellValue(headers[i]);
      cell.cellStyle = headerStyle;
      sheetObject.setColumnWidth(i, 25);
    }

    // 3. Add Data Rows
    for (int row = 0; row < logs.length; row++) {
      final log = logs[row];
      final ts = log['timestamp'];
      String dateStr = 'N/A';
      if (ts is Timestamp) {
        dateStr = DateFormat('yyyy-MM-dd HH:mm:ss').format(ts.toDate());
      }

      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: row + 2)).value = TextCellValue(dateStr);
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: row + 2)).value = TextCellValue(log['adminName'] ?? 'Unknown');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: row + 2)).value = TextCellValue(log['role'] ?? 'Admin');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: row + 2)).value = TextCellValue(log['action'] ?? '-');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: row + 2)).value = TextCellValue(log['studentId'] ?? 'N/A');
    }

    // 4. Save and Download
    final List<int>? fileBytes = excel.save();
    if (fileBytes != null) {
      final String fileName = 'AuditLog_Export_${DateTime.now().millisecondsSinceEpoch}.xlsx';
      await FileSaver.instance.saveFile(
        name: fileName,
        bytes: Uint8List.fromList(fileBytes),
      );
    }
  }

  /// Exports the full student roster to an Excel file
  static Future<void> exportStudentsData({
    required List<Map<String, dynamic>> students,
    required String title,
  }) async {
    final Excel excel = Excel.createExcel();
    final Sheet sheetObject = excel['Students Roster'];

    // Header Style
    final CellStyle headerStyle = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      backgroundColorHex: ExcelColor.fromHexString('#1A365D'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );

    // 1. Add Title Row
    sheetObject.merge(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0), 
                     CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: 0));
    final cell = sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0));
    cell.value = TextCellValue('ScholarDoc Student Records - ${DateFormat('yyyy-MM-dd').format(DateTime.now())}');
    cell.cellStyle = headerStyle;

    // 2. Add Header Row
    final List<String> headers = ['Student ID', 'Full Name', 'Birthdate', 'Course', 'Year', 'Status', 'Date Registered'];
    for (int i = 0; i < headers.length; i++) {
      final cell = sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 1));
      cell.value = TextCellValue(headers[i]);
      cell.cellStyle = headerStyle;
      sheetObject.setColumnWidth(i, 20);
    }

    // 3. Add Data Rows
    for (int row = 0; row < students.length; row++) {
      final s = students[row];
      final ts = s['createdAt'];
      String dateStr = 'N/A';
      if (ts is Timestamp) {
        dateStr = DateFormat('yyyy-MM-dd').format(ts.toDate());
      }

      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: row + 2)).value = TextCellValue(s['studentId']?.toString() ?? 'N/A');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: row + 2)).value = TextCellValue(s['fullName'] ?? 'N/A');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: row + 2)).value = TextCellValue(s['birthdate']?.toString() ?? '01/01/2000');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: row + 2)).value = TextCellValue(s['course'] ?? 'N/A');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: row + 2)).value = TextCellValue(s['year']?.toString() ?? 'N/A');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: row + 2)).value = TextCellValue(s['status'] ?? 'Pending');
      sheetObject.cell(CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: row + 2)).value = TextCellValue(dateStr);
    }

    // 4. Save and Download
    final List<int>? fileBytes = excel.save();
    if (fileBytes != null) {
      final String fileName = '${title}_Export_${DateTime.now().millisecondsSinceEpoch}.xlsx';
      await FileSaver.instance.saveFile(
        name: fileName,
        bytes: Uint8List.fromList(fileBytes),
      );
    }
  }
}
