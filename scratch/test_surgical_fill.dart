import 'dart:io';
import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../lib/services/billing_service.dart';

void main() async {
  print('=== Running Surgical ZIP Injection Integration Test ===');
  
  final File templateFile = File('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
  if (!templateFile.existsSync()) {
    print('❌ Template file not found at assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    return;
  }
  final Uint8List templateBytes = templateFile.readAsBytesSync();

  // Create some mock students to run the fill workflow
  final List<Map<String, dynamic>> mockStudents = [
    // Continuing Grantees (payoutsReceived > 0)
    {
      'studentId': '2021-0001',
      'fullName': 'Dela Cruz, Juan Ponce',
      'gender': 'Male',
      'year': '3',
      'saNumber': 'TES-2021-99882',
      'contactNumber': '09171234567',
      'email': 'juan.delacruz@hei.edu.ph',
      'course': 'BS in Computer Science',
      'birthdate': '10/24/2002',
      'scholarshipName': 'TES Scholarship',
      'payoutsReceived': '2',
    },
    {
      'studentId': '2021-0002',
      'fullName': 'Santos, Maria Clara',
      'gender': 'Female',
      'year': '3',
      'saNumber': 'TES-2021-99883',
      'contactNumber': '09187654321',
      'email': 'maria.santos@hei.edu.ph',
      'course': 'BS in Information Technology',
      'birthdate': '12/15/2002',
      'scholarshipName': 'TES',
      'payoutsReceived': '1',
    },
    // New Grantees (payoutsReceived == 0 or null)
    {
      'studentId': '2023-0005',
      'fullName': 'Aquino, Benigno Simeon',
      'gender': 'Male',
      'year': '1',
      'saNumber': 'TES-2023-11223',
      'contactNumber': '09051112222',
      'email': 'benigno.aquino@hei.edu.ph',
      'course': 'Bachelor of Arts in Political Science',
      'birthdate': '02/08/2005',
      'scholarshipName': 'TES Scholarship',
      'payoutsReceived': '0',
      'status': 'Approved',
    },
    {
      'studentId': '2023-0006',
      'fullName': 'Reyes, Alice Guo',
      'gender': 'Female',
      'year': '1',
      'saNumber': '',
      'contactNumber': '09063334444',
      'email': 'alice.reyes@hei.edu.ph',
      'course': 'BS in Business Administration',
      'birthdate': '08/31/2005',
      'scholarshipName': 'TES',
      'payoutsReceived': '0',
      'status': 'Pending Verification',
    },
  ];

  final billingService = BillingService();
  try {
    print('Filling template with ${mockStudents.length} students...');
    final result = await billingService.fillAnnex5Template(templateBytes, customStudents: mockStudents);
    
    print('Generation success:');
    print('  - Total Count: ${result.totalCount}');
    print('  - Continuing Count: ${result.continuingCount}');
    print('  - New Count: ${result.newCount}');
    
    // Save to scratch/final_filled.xlsx so verify_fix.dart can read it
    final outputDir = Directory('scratch');
    if (!outputDir.existsSync()) {
      outputDir.createSync();
    }
    final File outputFile = File('scratch/final_filled.xlsx');
    outputFile.writeAsBytesSync(result.bytes);
    print('✅ Saved populated workbook to ${outputFile.path} (${result.bytes.length} bytes)');
  } catch (e, stack) {
    print('❌ Failed to fill template: $e');
    print(stack);
  }
}
