import 'dart:io';
import 'dart:typed_data';
import 'package:excel/excel.dart';

void main() async {
  try {
    final file = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    final bytes = file.readAsBytesSync();
    
    // Scenario A: 3 continuing, 3 new (No row insertion)
    print('Testing Scenario A (No row insertion)...');
    final List<Map<String, dynamic>> studentsA = [];
    for (int i = 0; i < 3; i++) {
      studentsA.add({
        'fullName': 'Continuing Scholar $i',
        'studentId': 'CONT$i',
        'gender': i % 2 == 0 ? 'Male' : 'Female',
        'year': '2nd Year',
        'payoutsReceived': '2',
        'scholarshipName': 'TES',
        'contactNumber': '0911000000$i',
        'email': 'cont$i@email.com',
        'course': 'BSIT',
        'birthdate': '01/01/2000',
      });
    }
    for (int i = 0; i < 3; i++) {
      studentsA.add({
        'fullName': 'New Scholar $i',
        'studentId': 'NEW$i',
        'gender': i % 2 == 0 ? 'Male' : 'Female',
        'year': '1st Year',
        'payoutsReceived': '0',
        'scholarshipName': 'TES',
        'contactNumber': '0922000000$i',
        'email': 'new$i@email.com',
        'course': 'BSIT',
        'birthdate': '01/01/2001',
      });
    }
    
    final outBytesA = fillAnnex5TemplateLocal(bytes, studentsA);
    File('scratch/filled_scenario_a.xlsx').writeAsBytesSync(outBytesA);
    print('Scenario A saved to scratch/filled_scenario_a.xlsx');
    
  } catch (e, s) {
    print('Error: $e');
    print(s);
  }
}

Map<String, String> _splitFullName(String fullName) {
  final name = fullName.trim();
  if (name.contains(',')) {
    final parts = name.split(',');
    final lastName = parts[0].trim();
    final remaining = parts.sublist(1).join(',').trim();
    final subParts = remaining.split(' ');
    if (subParts.isNotEmpty && subParts.last.length <= 2 && !subParts.last.contains('.')) {
      final middleInitial = subParts.last.toUpperCase();
      final givenName = subParts.sublist(0, subParts.length - 1).join(' ').trim();
      return {
        'lastName': lastName,
        'givenName': givenName,
        'middleInitial': middleInitial,
      };
    } else {
      return {
        'lastName': lastName,
        'givenName': remaining,
        'middleInitial': '',
      };
    }
  } else {
    final parts = name.split(' ');
    if (parts.length <= 1) {
      return {
        'lastName': name,
        'givenName': '',
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

Uint8List fillAnnex5TemplateLocal(Uint8List templateBytes, List<Map<String, dynamic>> rawStudents) {
  final Excel excel = Excel.decodeBytes(templateBytes);

  final List<Map<String, dynamic>> tesScholars = [];
  for (var s in rawStudents) {
    final scholarship = (s['scholarshipName'] ?? s['scholarshipType'] ?? '').toString().toLowerCase();
    if (scholarship.contains('tes')) {
      tesScholars.add(s);
    }
  }

  // Sort scholars by full name so they are ordered alphabetically in the spreadsheets
  tesScholars.sort((a, b) {
    final nameA = (a['fullName'] ?? '').toString().toLowerCase();
    final nameB = (b['fullName'] ?? '').toString().toLowerCase();
    return nameA.compareTo(nameB);
  });

  // Categorize based on payoutsReceived (payouts > 0 -> Continuing/Billing details, payouts == 0 -> New)
  final List<Map<String, dynamic>> continuingScholars = [];
  final List<Map<String, dynamic>> newScholars = [];

  for (var s in tesScholars) {
    final int payouts = int.tryParse(s['payoutsReceived']?.toString() ?? '0') ?? 0;
    if (payouts > 0) {
      continuingScholars.add(s);
    } else {
      newScholars.add(s);
    }
  }

  // --- Fill Annex 5-TES New Form 2 (Continuing Grantees / Billing Details) ---
  final Sheet? sheet2 = excel.tables['Annex 5-TES New Form 2'];
  if (sheet2 != null) {
    int startRow = 41; // index 41 is Row 42
    int defaultEmptyRows = 6; // Row 42 to Row 47 are empty

    // If we have more scholars than empty rows, dynamically insert additional rows
    if (continuingScholars.length > defaultEmptyRows) {
      final int rowsToInsert = continuingScholars.length - defaultEmptyRows;
      for (int i = 0; i < rowsToInsert; i++) {
        sheet2.insertRowIterables([], startRow + defaultEmptyRows);
      }
    }

    for (int i = 0; i < continuingScholars.length; i++) {
      final student = continuingScholars[i];
      final int r = startRow + i;

      final nameInfo = _splitFullName(student['fullName'] ?? '');
      final String rawGender = (student['gender'] ?? 'Male').toString().trim().toUpperCase();
      final String genderLetter = rawGender.startsWith('F') ? 'F' : 'M';

      final String rawYear = (student['year'] ?? '').toString();
      final String yearLevel = rawYear.contains('1')
          ? '1'
          : rawYear.contains('2')
              ? '2'
              : rawYear.contains('3')
                  ? '3'
                  : rawYear.contains('4')
                      ? '4'
                      : rawYear;

      final String saNumber = student['saNumber'] ?? student['familyDetails']?['saNumber'] ?? '';
      final String contactNum = student['contactNumber'] ?? student['phone'] ?? '';
      final String email = student['email'] ?? '';
      final String course = student['course'] ?? '';
      final String birthdate = student['birthdate'] ?? student['birthday'] ?? '';

      final double amount = 10000.0; // Standard public school TES amount
      final double pwdAmt = 0.0;     // PWD support (default to 0.0 unless specified)
      final double totalAmt = amount + pwdAmt;

      // B (Col index 1): Control Number
      _setCellValue(sheet2, 1, r, (i + 1).toString().padLeft(5, '0'));
      // C (Col index 2): Student Number
      _setCellValue(sheet2, 2, r, student['studentId'] ?? '');
      // D (Col index 3): TES Application Number
      _setCellValue(sheet2, 3, r, saNumber.isNotEmpty ? saNumber : 'N/A');
      // E (Col index 4): Last Name
      _setCellValue(sheet2, 4, r, nameInfo['lastName']);
      // F (Col index 5): Given Name
      _setCellValue(sheet2, 5, r, nameInfo['givenName']);
      // G (Col index 6): Middle Initial
      _setCellValue(sheet2, 6, r, nameInfo['middleInitial']);
      // H (Col index 7): Sex
      _setCellValue(sheet2, 7, r, genderLetter);
      // I (Col index 8): Birthdate
      _setCellValue(sheet2, 8, r, birthdate.isNotEmpty ? birthdate : 'N/A');
      // J (Col index 9): Degree Program
      _setCellValue(sheet2, 9, r, course);
      // K (Col index 10): Year Level
      _setCellValue(sheet2, 10, r, yearLevel);
      // L (Col index 11): E-mail
      _setCellValue(sheet2, 11, r, email);
      // M (Col index 12): Phone
      _setCellValue(sheet2, 12, r, contactNum);
      // N (Col index 13): TES Batch
      _setCellValue(sheet2, 13, r, 1);
      // O (Col index 14): TES Amount
      _setCellValue(sheet2, 14, r, amount);
      // P (Col index 15): TES-3A PWD
      _setCellValue(sheet2, 15, r, pwdAmt);
      // Q (Col index 16): Total Amount
      _setCellValue(sheet2, 16, r, totalAmt);
    }
  }

  // --- Fill Annex 5-TES New Form 3 (New Grantees Summary) ---
  final Sheet? sheet3 = excel.tables['Annex 5-TES New Form 3'];
  if (sheet3 != null) {
    int startRow = 33; // index 33 is Row 34
    int defaultEmptyRows = 6; // Row 34 to Row 39 are empty

    if (newScholars.length > defaultEmptyRows) {
      final int rowsToInsert = newScholars.length - defaultEmptyRows;
      for (int i = 0; i < rowsToInsert; i++) {
        sheet3.insertRowIterables([], startRow + defaultEmptyRows);
      }
    }

    for (int i = 0; i < newScholars.length; i++) {
      final student = newScholars[i];
      final int r = startRow + i;

      final nameInfo = _splitFullName(student['fullName'] ?? '');
      final String rawGender = (student['gender'] ?? 'Male').toString().trim().toUpperCase();
      final String genderLetter = rawGender.startsWith('F') ? 'F' : 'M';

      final String rawYear = (student['year'] ?? '').toString();
      final String yearLevel = rawYear.contains('1')
          ? '1'
          : rawYear.contains('2')
              ? '2'
              : rawYear.contains('3')
                  ? '3'
                  : rawYear.contains('4')
                      ? '4'
                      : rawYear;

      final String saNumber = student['saNumber'] ?? student['familyDetails']?['saNumber'] ?? '';
      final String course = student['course'] ?? '';
      final String birthdate = student['birthdate'] ?? student['birthday'] ?? '';
      final String status = student['status'] ?? 'Approved';

      // B (Col index 1): Control Number
      _setCellValue(sheet3, 1, r, (i + 1).toString().padLeft(5, '0'));
      // C (Col index 2): Student Number
      _setCellValue(sheet3, 2, r, student['studentId'] ?? '');
      // D (Col index 3): TES Application Number
      _setCellValue(sheet3, 3, r, saNumber.isNotEmpty ? saNumber : 'N/A');
      // E (Col index 4): Last Name
      _setCellValue(sheet3, 4, r, nameInfo['lastName']);
      // F (Col index 5): Given Name
      _setCellValue(sheet3, 5, r, nameInfo['givenName']);
      // G (Col index 6): Middle Initial
      _setCellValue(sheet3, 6, r, nameInfo['middleInitial']);
      // H (Col index 7): Sex
      _setCellValue(sheet3, 7, r, genderLetter);
      // I (Col index 8): Birthdate
      _setCellValue(sheet3, 8, r, birthdate.isNotEmpty ? birthdate : 'N/A');
      // J (Col index 9): Degree Program
      _setCellValue(sheet3, 9, r, course);
      // K (Col index 10): Year Level
      _setCellValue(sheet3, 10, r, yearLevel);
      // L (Col index 11): Status
      _setCellValue(sheet3, 11, r, status);
      // M (Col index 12): Remarks
      _setCellValue(sheet3, 12, r, 'Active');
    }
  }

  final List<int>? fileBytes = excel.save();
  return Uint8List.fromList(fileBytes!);
}
