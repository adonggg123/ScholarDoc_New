import 'dart:io';
import 'package:excel/excel.dart';

void main() {
  try {
    final file = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    final bytes = file.readAsBytesSync();
    final excel = Excel.decodeBytes(bytes);
    
    print('=== non-null cells in Annex 5-TES New Form 2 ===');
    final sheet2 = excel.tables['Annex 5-TES New Form 2'];
    if (sheet2 != null) {
      print('Max cols: ${sheet2.maxColumns}, Max rows: ${sheet2.maxRows}');
      for (int r = 0; r < sheet2.maxRows; r++) {
        for (int c = 0; c < sheet2.maxColumns; c++) {
          final cell = sheet2.cell(CellIndex.indexByColumnRow(columnIndex: c, rowIndex: r));
          if (cell.value != null) {
            print('Row $r (Excel ${r + 1}), Col $c: ${cell.value} (${cell.value.runtimeType})');
          }
        }
      }
    }
    
    print('\n=== non-null cells in Annex 5-TES New Form 3 ===');
    final sheet3 = excel.tables['Annex 5-TES New Form 3'];
    if (sheet3 != null) {
      print('Max cols: ${sheet3.maxColumns}, Max rows: ${sheet3.maxRows}');
      for (int r = 0; r < sheet3.maxRows; r++) {
        for (int c = 0; c < sheet3.maxColumns; c++) {
          final cell = sheet3.cell(CellIndex.indexByColumnRow(columnIndex: c, rowIndex: r));
          if (cell.value != null) {
            print('Row $r (Excel ${r + 1}), Col $c: ${cell.value} (${cell.value.runtimeType})');
          }
        }
      }
    }
  } catch (e, s) {
    print('Error: $e');
    print(s);
  }
}
