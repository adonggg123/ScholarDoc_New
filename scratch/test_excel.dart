import 'dart:io';
import 'package:excel/excel.dart';

void main() {
  try {
    print('Reading template file...');
    final file = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    final bytes = file.readAsBytesSync();
    
    print('Decoding bytes...');
    var excel = Excel.decodeBytes(bytes);
    
    print('Testing Sheet 2 write WITH insertRowIterables...');
    final sheet2 = excel.tables['Annex 5-TES New Form 2'];
    if (sheet2 != null) {
      sheet2.insertRowIterables([], 45);
    }
    
    print('Saving file...');
    final outBytes = excel.save();
    if (outBytes != null) {
      print('Decoding the SAVED file again...');
      final reDecoded = Excel.decodeBytes(outBytes);
      print('Successfully re-decoded file with insertRowIterables! No XML parser crash.');
    }
  } catch (e, stack) {
    print('Exception during test: $e');
    print(stack);
  }
}
