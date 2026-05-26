import 'package:csv/csv.dart';
import 'dart:convert';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:file_saver/file_saver.dart';
import 'package:flutter/foundation.dart';

class BillingService {
  final FirebaseFirestore? firestoreOverride;
  FirebaseFirestore get _firestore => firestoreOverride ?? FirebaseFirestore.instance;

  BillingService({this.firestoreOverride});

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
        
        // Auto-fill missing fields (supports common header variations)
        _fillIfEmpty(resultRow, match, 'Student ID', ['studentId']);
        _fillIfEmpty(resultRow, match, 'Full Name', ['fullName']);
        _fillIfEmpty(resultRow, match, 'Scholarship Type', ['scholarshipName', 'scholarshipType']);
        
        _fillIfEmpty(resultRow, match, 'Course/Program', ['course', 'program']);
        _fillIfEmpty(resultRow, match, 'Degree/Program', ['course', 'program']);
        
        _fillIfEmpty(resultRow, match, 'Year Level', ['year', 'scholarYearLevel', 'yearLevel']);
        _fillIfEmpty(resultRow, match, 'Year', ['year', 'scholarYearLevel', 'yearLevel']);
        
        _fillIfEmpty(resultRow, match, 'Semester', ['semester']);
        _fillIfEmpty(resultRow, match, 'Academic Year', ['academicYear', 'ay']);
        _fillIfEmpty(resultRow, match, 'SA Number', ['saNumber']);
        
        _fillIfEmpty(resultRow, match, 'Sex at Birth (M/F)', ['gender', 'sex']);
        _fillIfEmpty(resultRow, match, 'Sex', ['gender', 'sex']);
        _fillIfEmpty(resultRow, match, 'Gender', ['gender', 'sex']);
        
        _fillIfEmpty(resultRow, match, 'Birthdate (mm/dd/yyyy)', ['birthdate', 'birthday']);
        _fillIfEmpty(resultRow, match, 'Birthdate', ['birthdate', 'birthday']);
        _fillIfEmpty(resultRow, match, 'Birth Date', ['birthdate', 'birthday']);
        _fillIfEmpty(resultRow, match, 'Birthday', ['birthdate', 'birthday']);
        
        _fillIfEmpty(resultRow, match, 'E-mail address', ['email']);
        _fillIfEmpty(resultRow, match, 'Email', ['email']);
        _fillIfEmpty(resultRow, match, 'Email Address', ['email']);
        
        _fillIfEmpty(resultRow, match, 'Phone Number', ['contactNumber', 'phone']);
        _fillIfEmpty(resultRow, match, 'Phone', ['contactNumber', 'phone']);
        _fillIfEmpty(resultRow, match, 'Contact Number', ['contactNumber', 'phone']);
        
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
    final String cleanVal = existingValue.toString().trim().toUpperCase();
    if (cleanVal.isNotEmpty && cleanVal != 'N/A') return;

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

  /// Dynamically parses a single full name into Last Name, Given Name, and Middle Initial.
  Map<String, String> _splitFullName(String fullName) {
    fullName = fullName.trim();
    if (fullName.isEmpty) {
      return {'lastName': '', 'givenName': '', 'middleInitial': ''};
    }

    if (fullName.contains(',')) {
      final parts = fullName.split(',');
      final lastName = parts[0].trim();
      final rest = parts.sublist(1).join(',').trim();
      final restParts = rest.split(RegExp(r'\s+'));
      String givenName = '';
      String middleInitial = '';
      if (restParts.length > 1) {
        final lastPart = restParts.last;
        if (lastPart.length <= 2) {
          middleInitial = lastPart.replaceAll('.', '').toUpperCase().trim();
          givenName = restParts.sublist(0, restParts.length - 1).join(' ').trim();
        } else {
          givenName = restParts.join(' ').trim();
        }
      } else {
        givenName = rest;
      }
      return {
        'lastName': lastName,
        'givenName': givenName,
        'middleInitial': middleInitial,
      };
    } else {
      final parts = fullName.split(RegExp(r'\s+'));
      if (parts.length == 1) {
        return {
          'lastName': parts[0],
          'givenName': '',
          'middleInitial': '',
        };
      } else if (parts.length == 2) {
        return {
          'lastName': parts[1],
          'givenName': parts[0],
          'middleInitial': '',
        };
      } else {
        final lastPart = parts.last;
        final secondToLast = parts[parts.length - 2];
        if (secondToLast.length <= 2) {
          final middleInitial = secondToLast.replaceAll('.', '').toUpperCase().trim();
          final givenName = parts.sublist(0, parts.length - 2).join(' ').trim();
          return {
            'lastName': lastPart,
            'givenName': givenName,
            'middleInitial': middleInitial,
          };
        } else {
          final givenName = parts.sublist(0, parts.length - 1).join(' ').trim();
          return {
            'lastName': lastPart,
            'givenName': givenName,
            'middleInitial': '',
          };
        }
      }
    }
  }

  /// Sets a value inside a sheet cell with the appropriate CellValue subtype.
  void _setCellValue(Sheet sheet, int colIdx, int rowIdx, dynamic val) {
    final cell = sheet.cell(CellIndex.indexByColumnRow(columnIndex: colIdx, rowIndex: rowIdx));
    if (val == null) {
      cell.value = null;
    } else if (val is num) {
      cell.value = DoubleCellValue(val.toDouble());
    } else if (val is bool) {
      cell.value = BoolCellValue(val);
    } else {
      cell.value = TextCellValue(val.toString());
    }
  }

  // ─── XML helpers ────────────────────────────────────────────────────────────

  /// Convert 0-based column index to Excel letter(s). 0→A, 1→B, 25→Z, 26→AA …
  String _colLetter(int idx) {
    String r = '';
    int n = idx;
    do {
      r = String.fromCharCode(65 + (n % 26)) + r;
      n = n ~/ 26 - 1;
    } while (n >= 0);
    return r;
  }

  /// Extract 0-based column index from a cell address like "B42" → 1, "AA5" → 26.
  int _colIndexFromAddr(String addr) {
    final letters = addr.replaceAll(RegExp(r'[0-9]'), '');
    int index = 0;
    for (int i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.codeUnitAt(i) - 64);
    }
    return index - 1; // 0-based
  }

  /// Return the template's style index for a given 0-based column, form variant.
  /// These are read from the original government template's pre-existing blank cells.
  String _defaultStyle(int colIdx, {required bool isForm2}) {
    if (isForm2) {
      switch (colIdx) {
        case 1:  return '279'; // B – control number
        case 2:  return '280'; // C – student number
        case 3:  return '280'; // D – TES app number
        case 4:  return '268'; // E – last name
        case 5:  return '268'; // F – given name
        case 6:  return '279'; // G – middle initial
        case 7:  return '279'; // H – sex
        case 8:  return '279'; // I – birthdate
        case 9:  return '279'; // J – degree
        case 10: return '279'; // K – year level
        case 11: return '279'; // L – email
        case 12: return '279'; // M – phone
        case 13: return '279'; // N – batch
        case 14: return '281'; // O – TES amount
        case 15: return '282'; // P – PWD amount
        case 16: return '282'; // Q – total amount
        default: return '279';
      }
    } else {
      // Form 3 – from original sheet3.xml row 34 inspection
      return colIdx == 11 ? '344' : '321';
    }
  }

  /// Find or create a <row r="[rowNum]"> in sheetData, preserving existing row attrs.
  XmlElement _getOrCreateRow(XmlElement sheetData, int rowNum) {
    final existing = sheetData
        .findElements('row')
        .where((r) => r.getAttribute('r') == '$rowNum')
        .firstOrNull;
    if (existing != null) return existing;

    final newRow = XmlElement(XmlName('row'));
    newRow.setAttribute('r', '$rowNum');

    final allRows = sheetData.findElements('row').toList();
    int insertBefore = -1;
    for (int j = 0; j < allRows.length; j++) {
      final rn = int.tryParse(allRows[j].getAttribute('r') ?? '') ?? 0;
      if (rn > rowNum) { insertBefore = j; break; }
    }
    if (insertBefore == -1) {
      sheetData.children.add(newRow);
    } else {
      final ci = sheetData.children.indexOf(allRows[insertBefore]);
      sheetData.children.insert(ci, newRow);
    }
    return newRow;
  }

  /// Fill a single cell in-place.
  ///
  /// Finds the existing <c> by address and updates its content.
  /// Crucially, the existing cell's s="..." (style/border) attribute is
  /// left completely untouched so the template's gridlines stay intact.
  /// If the cell doesn't exist yet (row beyond placeholder range), a new
  /// <c> is created with the correct default style for that column.
  void _fillCell(
    XmlElement rowEl,
    String addr,
    String value, {
    required bool isNumeric,
    required String defaultStyle,
  }) {
    // Escape value for XML text
    final escaped = value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

    // Find existing cell element (already has s="..." border style)
    XmlElement? cell = rowEl
        .findElements('c')
        .where((c) => c.getAttribute('r') == addr)
        .firstOrNull;

    if (cell == null) {
      // Cell doesn't exist – create it with the fallback default style
      cell = XmlElement(XmlName('c'));
      cell.setAttribute('r', addr);
      cell.setAttribute('s', defaultStyle);

      // Insert in column order
      final cells = rowEl.findElements('c').toList();
      final targetIdx = _colIndexFromAddr(addr);
      int insertBefore = -1;
      for (int i = 0; i < cells.length; i++) {
        if (_colIndexFromAddr(cells[i].getAttribute('r') ?? '') > targetIdx) {
          insertBefore = i;
          break;
        }
      }
      if (insertBefore == -1) {
        rowEl.children.add(cell);
      } else {
        final ci = rowEl.children.indexOf(cells[insertBefore]);
        rowEl.children.insert(ci, cell);
      }
    }

    // Update content, preserving existing s="..." (and any other attrs on the cell)
    cell.children.clear();
    if (isNumeric) {
      cell.removeAttribute('t');
      cell.children.add(XmlElement(XmlName('v'), [], [XmlText(escaped)]));
    } else {
      cell.setAttribute('t', 'inlineStr');
      cell.children.add(
        XmlElement(XmlName('is'), [], [
          XmlElement(XmlName('t'), [], [XmlText(escaped)]),
        ]),
      );
    }
  }

  /// Inject [students] data rows into [xmlStr] starting at Excel row [startRow].
  /// Cells are filled in-place so the template's border/style attributes are
  /// completely preserved — solving the "lines disappear" issue.
  String _injectStudentRows(
    String xmlStr,
    List<Map<String, dynamic>> students,
    int startRow, {
    required bool isForm2,
  }) {
    final doc = XmlDocument.parse(xmlStr);
    final sheetData = doc.findAllElements('sheetData').first;

    for (int i = 0; i < students.length; i++) {
      final s = students[i];
      final rowNum = startRow + i;
      final ctrl = (i + 1).toString().padLeft(5, '0');

      final name   = _splitFullName(s['fullName'] ?? '');
      final gender = (s['gender'] ?? 'M').toString().toUpperCase().startsWith('F') ? 'F' : 'M';
      final rawYear = (s['year'] ?? '').toString();
      final year = rawYear.contains('1') ? '1'
          : rawYear.contains('2') ? '2'
          : rawYear.contains('3') ? '3'
          : rawYear.contains('4') ? '4'
          : rawYear;
      final sa     = (s['saNumber'] ?? s['familyDetails']?['saNumber'] ?? '').toString();
      final course = (s['course'] ?? '').toString();
      String bdate = (s['birthdate'] ?? s['birthday'] ?? '').toString().trim();
      if (bdate.isEmpty || bdate.toUpperCase() == 'N/A') {
        bdate = '01/01/2000';
      }
      final studId = (s['studentId'] ?? '').toString();

      // Get or create the row (existing blank rows already have proper styles).
      final rowEl = _getOrCreateRow(sheetData, rowNum);

      // Helper to build cell address string.
      String addr(int colIdx) => '${_colLetter(colIdx)}$rowNum';

      // Helper to fill a text cell.
      void str(int colIdx, String val) => _fillCell(
        rowEl, addr(colIdx), val,
        isNumeric: false,
        defaultStyle: _defaultStyle(colIdx, isForm2: isForm2),
      );

      // Helper to fill a numeric cell.
      void num_(int colIdx, num val) => _fillCell(
        rowEl, addr(colIdx), val.toString(),
        isNumeric: true,
        defaultStyle: _defaultStyle(colIdx, isForm2: isForm2),
      );

      // Columns shared by both forms (B–K)
      str(1,  ctrl);
      str(2,  studId);
      str(3,  sa.isNotEmpty ? sa : 'N/A');
      str(4,  name['lastName'] ?? '');
      str(5,  name['givenName'] ?? '');
      str(6,  name['middleInitial'] ?? '');
      str(7,  gender);
      str(8,  bdate);
      str(9,  course);
      str(10, year);

      if (isForm2) {
        // Form 2 extra columns
        final email = (s['email'] ?? '').toString();
        final phone = (s['contactNumber'] ?? s['phone'] ?? '').toString();
        str(11, email);
        str(12, phone);
        num_(13, 1);       // TES Batch
        num_(14, 10000);   // TES Amount
        num_(15, 0);       // TES-3A PWD
        num_(16, 10000);   // Total Amount
      } else {
        // Form 3 extra columns
        final status = (s['status'] ?? 'Approved').toString();
        str(11, status);   // Status
        str(12, 'Active'); // Remarks
      }
    }

    return doc.toXmlString();
  }

  // ────────────────────────────────────────────────────────────────────────────

  /// Automatically parses, categorizes, and fills the multi-sheet Annex 5 TES Billing Form.
  Future<Annex5FillResult> fillAnnex5Template(Uint8List templateBytes, {List<Map<String, dynamic>>? customStudents}) async {
    // Fetch or use provided student records
    final List<Map<String, dynamic>> rawStudents = [];
    if (customStudents != null) {
      rawStudents.addAll(customStudents);
    } else {
      final QuerySnapshot snap = await _firestore.collection('students').get();
      for (final doc in snap.docs) {
        final data = doc.data() as Map<String, dynamic>;
        data['uid'] = doc.id;
        rawStudents.add(data);
      }
    }

    // Keep only TES scholars, sorted alphabetically
    final tesScholars = rawStudents.where((s) {
      final sc = (s['scholarshipName'] ?? s['scholarshipType'] ?? '').toString().toLowerCase();
      return sc.contains('tes');
    }).toList()
      ..sort((a, b) => (a['fullName'] ?? '').toString().toLowerCase()
          .compareTo((b['fullName'] ?? '').toString().toLowerCase()));

    // Categorise: payoutsReceived > 0 → continuing (Form 2); 0 → new (Form 3)
    final continuingScholars = <Map<String, dynamic>>[];
    final newScholars        = <Map<String, dynamic>>[];
    for (final s in tesScholars) {
      final p = int.tryParse(s['payoutsReceived']?.toString() ?? '0') ?? 0;
      if (p > 0) continuingScholars.add(s); else newScholars.add(s);
    }

    // ── Direct XML injection into the original template ZIP ──────────────────
    //
    // We never let package:excel decode the government template, because doing
    // so mutates styles.xml (+172 entries) and silently drops ~200 cells —
    // triggering Excel's "XML error / repair" dialog on open.
    //
    // Instead we:
    //   1. Read each target worksheet as a raw XML string from the template ZIP.
    //   2. Insert <row> elements with inline-string cells directly into the
    //      existing <sheetData>, using _injectStudentRows.
    //   3. Re-encode only those two files; every other ZIP entry is copied
    //      byte-for-byte from the original template.
    // ─────────────────────────────────────────────────────────────────────────
    final templateArchive = ZipDecoder().decodeBytes(templateBytes);
    final outputArchive   = Archive();

    for (final file in templateArchive.files) {
      if (file.name == 'xl/worksheets/sheet2.xml') {
        // Form 2 – Consolidated TES New Details (Continuing Grantees)
        // Data rows start at Excel row 42 (header row = 41).
        final modifiedXml = _injectStudentRows(
          String.fromCharCodes(file.content),
          continuingScholars,
          42,
          isForm2: true,
        );
        final xmlBytes = utf8.encode(modifiedXml);
        outputArchive.addFile(ArchiveFile('xl/worksheets/sheet2.xml', xmlBytes.length, xmlBytes));
      } else if (file.name == 'xl/worksheets/sheet3.xml') {
        // Form 3 – Consolidated New TES Grantees Details
        // Data rows start at Excel row 34 (header row = 33).
        final modifiedXml = _injectStudentRows(
          String.fromCharCodes(file.content),
          newScholars,
          34,
          isForm2: false,
        );
        final xmlBytes = utf8.encode(modifiedXml);
        outputArchive.addFile(ArchiveFile('xl/worksheets/sheet3.xml', xmlBytes.length, xmlBytes));
      } else {
        // All other files (styles, sharedStrings, other sheets, rels…) stay
        // exactly as-is from the original template.
        outputArchive.addFile(file);
      }
    }

    final outputBytes = ZipEncoder().encode(outputArchive);
    if (outputBytes == null) throw Exception('Failed to re-encode output XLSX archive.');

    return Annex5FillResult(
      bytes: Uint8List.fromList(outputBytes),
      continuingCount: continuingScholars.length,
      newCount: newScholars.length,
      totalCount: tesScholars.length,
    );
  }
}

class Annex5FillResult {
  final Uint8List bytes;
  final int continuingCount;
  final int newCount;
  final int totalCount;

  Annex5FillResult({
    required this.bytes,
    required this.continuingCount,
    required this.newCount,
    required this.totalCount,
  });
}



