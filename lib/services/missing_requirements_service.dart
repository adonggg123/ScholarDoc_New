// ignore_for_file: avoid_print
import 'package:supabase_flutter/supabase_flutter.dart';

import 'notification_service.dart';

class MissingRequirementItem {
  final String key;
  final String title;
  final String description;
  final String category; // 'document', 'verification', 'detail'
  final bool isActionRequired;

  MissingRequirementItem({
    required this.key,
    required this.title,
    required this.description,
    required this.category,
    this.isActionRequired = true,
  });
}

class MissingRequirementsService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final NotificationService _notificationService = NotificationService();

  /// Analyzes a student data map and returns a list of missing or incomplete requirements.
  List<MissingRequirementItem> detectMissingRequirements(Map<String, dynamic> student) {
    final List<MissingRequirementItem> missingList = [];

    final docs = (student['documents'] is Map)
        ? Map<String, dynamic>.from(student['documents'])
        : <String, dynamic>{};

    final String saStatus = docs['saVerificationStatus']?.toString() ?? 'Pending';
    final String idStatus = docs['idValidationStatus']?.toString() ?? 'Pending';
    final bool requiresResubmission = student['requiresResubmission'] == true;

    // 1. SA Number Check
    final saNumber = student['saNumber'] ?? student['familyDetails']?['saNumber'];
    if (saNumber == null || saNumber.toString().trim().isEmpty || saNumber.toString().trim() == 'N/A') {
      missingList.add(MissingRequirementItem(
        key: 'sa_number',
        title: 'SA Number',
        description: 'Student Assistant (SA) Number has not been submitted.',
        category: 'detail',
      ));
    } else if (saStatus == 'Missing' || saStatus == 'Rejected') {
      missingList.add(MissingRequirementItem(
        key: 'sa_number_revision',
        title: 'SA Number Verification',
        description: saStatus == 'Missing'
            ? 'Administrator flagged your SA Number as incomplete or missing details.'
            : 'Your submitted SA Number was rejected by administrator.',
        category: 'verification',
      ));
    }

    // 2. ID Document PDF / Images Check
    final submissionPdfUrl = student['submissionPdfUrl'] ?? docs['submissionPdfUrl'];
    final idFrontUrl = student['idFrontUrl'] ?? docs['idFrontUrl'];
    final idBackUrl = student['idBackUrl'] ?? docs['idBackUrl'];

    if (submissionPdfUrl == null || submissionPdfUrl.toString().trim().isEmpty) {
      if (idFrontUrl == null || idBackUrl == null || idFrontUrl.toString().isEmpty || idBackUrl.toString().isEmpty) {
        missingList.add(MissingRequirementItem(
          key: 'id_documents',
          title: 'ID Front & Back + Signatures PDF',
          description: 'Official student ID document PDF is missing.',
          category: 'document',
        ));
      }
    }

    if (idStatus == 'Missing' || idStatus == 'Rejected') {
      missingList.add(MissingRequirementItem(
        key: 'id_documents_revision',
        title: 'ID Document Revision',
        description: idStatus == 'Missing'
            ? 'ID Front & Back document requires revision based on admin feedback.'
            : 'Submitted ID document was rejected by administrator.',
        category: 'verification',
      ));
    }

    // 3. Overall Resubmission Flag
    if (requiresResubmission && !missingList.any((m) => m.category == 'verification')) {
      missingList.add(MissingRequirementItem(
        key: 'general_resubmission',
        title: 'Document Resubmission Required',
        description: student['adminRemarks'] ?? 'Administrator requested document resubmission.',
        category: 'verification',
      ));
    }

    return missingList;
  }

  /// Automatically inspects a student record and triggers a notification if missing requirements are detected.
  Future<List<MissingRequirementItem>> runAutomatedDetection(String studentId, {Map<String, dynamic>? studentData}) async {
    try {
      Map<String, dynamic>? data = studentData;
      if (data == null) {
        final res = await _supabase.from('students').select('*').eq('uid', studentId).maybeSingle();
        data = res;
      }

      if (data == null) return [];

      final missingItems = detectMissingRequirements(data);
      if (missingItems.isNotEmpty) {
        final itemTitles = missingItems.map((e) => e.title).toList();
        await _notificationService.sendMissingRequirementsNotification(
          studentId: studentId,
          missingItems: itemTitles,
        );
      }
      return missingItems;
    } catch (e) {
      print('Error running automated missing requirements detection: $e');
      return [];
    }
  }
}
