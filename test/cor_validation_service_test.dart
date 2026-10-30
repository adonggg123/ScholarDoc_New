import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:tesdoc_project/services/academic_term_service.dart';
import 'package:tesdoc_project/services/cor_validation_service.dart';

Future<Uint8List> _buildSampleCorPdf({
  required String studentName,
  required String termHeader,
  String extraLines = '',
}) async {
  final doc = pw.Document();
  doc.addPage(
    pw.Page(
      build: (ctx) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES'),
          pw.Text('CERTIFICATE OF REGISTRATION'),
          pw.SizedBox(height: 8),
          pw.Text(termHeader),
          pw.Text('Student Name: $studentName'),
          pw.Text('Program: BS Information Technology   Year Level: 2nd Year'),
          if (extraLines.isNotEmpty) pw.Text(extraLines),
          pw.SizedBox(height: 8),
          pw.Text('Subject Code   Description                        Units'),
          pw.Text('IT211          Data Structures and Algorithms     3.0'),
          pw.Text('IT212          Object-Oriented Programming        3.0'),
        ],
      ),
    ),
  );
  return doc.save();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const activeTerm = AcademicTerm(
    academicYear: '2026-2027',
    semester: '1st Semester',
  );

  setUp(() {
    CorValidationService.clearCache();
  });

  group('PDF-only format enforcement (isPdfBytes)', () {
    test('accepts genuine PDF magic header and rejects images or arbitrary bytes', () {
      final pdfHeader = Uint8List.fromList(utf8.encode('%PDF-1.7\n1 0 obj\n'));
      expect(CorValidationService.isPdfBytes(pdfHeader), isTrue);

      final jpegBytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(CorValidationService.isPdfBytes(jpegBytes), isFalse);

      final pngBytes = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(CorValidationService.isPdfBytes(pngBytes), isFalse);

      expect(CorValidationService.isPdfBytes(Uint8List(0)), isFalse);
    });

    test('validateCorPdf immediately rejects non-PDF bytes even before OCR', () async {
      final fakePdf = Uint8List.fromList(utf8.encode('NOT A REAL PDF FILE CONTENT'));
      final res = await CorValidationService.validateCorPdf(
        fakePdf,
        expectedName: 'Juan Dela Cruz',
        targetTerm: activeTerm,
      );
      expect(res.isValid, isFalse);
      expect(res.isPdf, isFalse);
    });
  });

  group('Real PDF digital text extraction & end-to-end COR validation', () {
    test('approves a valid COR PDF matching student name, AY, and semester', () async {
      final pdfBytes = await _buildSampleCorPdf(
        studentName: 'DELA CRUZ, JUAN P.',
        termHeader: 'First Semester, A.Y. 2026-2027',
      );

      final res = await CorValidationService.validateCorPdf(
        pdfBytes,
        expectedName: 'DELA CRUZ, JUAN PEDRO',
        targetTerm: activeTerm,
      );

      expect(res.isPdf, isTrue);
      expect(res.isReadable, isTrue);
      expect(res.nameMatches, isTrue);
      expect(res.yearMatches, isTrue);
      expect(res.semesterMatches, isTrue);
      expect(res.isValid, isTrue);
      expect(res.detectedAcademicYear, '2026-2027');
      expect(res.detectedSemester, '1st Semester');
    });

    test('rejects COR PDF belonging to a different student or sibling', () async {
      final pdfBytes = await _buildSampleCorPdf(
        studentName: 'DELA CRUZ, MARIA PEDRO',
        termHeader: '1st Semester, SY 2026-2027',
      );

      final res = await CorValidationService.validateCorPdf(
        pdfBytes,
        expectedName: 'DELA CRUZ, JUAN PEDRO',
        targetTerm: activeTerm,
      );

      expect(res.isValid, isFalse);
      expect(res.nameMatches, isFalse);
      expect(res.yearMatches, isTrue);
      expect(res.semesterMatches, isTrue);
    });

    test('rejects COR PDF with outdated academic year', () async {
      final pdfBytes = await _buildSampleCorPdf(
        studentName: 'JUAN PEDRO DELA CRUZ',
        termHeader: '1st Semester, A.Y. 2025-2026',
      );

      final res = await CorValidationService.validateCorPdf(
        pdfBytes,
        expectedName: 'Juan Pedro Dela Cruz',
        targetTerm: activeTerm,
      );

      expect(res.isValid, isFalse);
      expect(res.nameMatches, isTrue);
      expect(res.yearMatches, isFalse);
      expect(res.semesterMatches, isTrue);
      expect(res.detectedAcademicYear, '2025-2026');
    });

    test('rejects COR PDF with mismatched semester', () async {
      final pdfBytes = await _buildSampleCorPdf(
        studentName: 'JUAN PEDRO DELA CRUZ',
        termHeader: '2nd Semester, A.Y. 2026-2027',
      );

      final res = await CorValidationService.validateCorPdf(
        pdfBytes,
        expectedName: 'Juan Pedro Dela Cruz',
        targetTerm: activeTerm,
      );

      expect(res.isValid, isFalse);
      expect(res.nameMatches, isTrue);
      expect(res.yearMatches, isTrue);
      expect(res.semesterMatches, isFalse);
      expect(res.detectedSemester, '2nd Semester');
    });
  });

  group('COR layout & edge-case text evaluation', () {
    test('handles label:value Semester: 1st without confusing 2nd Year level and ignores Curriculum year', () {
      const sampleText = '''
UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES
CERTIFICATE OF REGISTRATION
Student No: 2024-10293
Student Name: CAÑETE, NIÑO J.
Curriculum: BSIT 2023-2024
Year Level: 2nd Year
Academic Year: 2026-2027
Semester: 1st
Course Code: IT211  Units: 3.0
''';

      final res = CorValidationService.evaluateCorText(
        rawText: sampleText,
        expectedName: 'Nino Jose Canete',
        targetTerm: activeTerm,
      );

      expect(res.isValid, isTrue);
      expect(res.nameMatches, isTrue);
      expect(res.detectedAcademicYear, '2026-2027');
      expect(res.detectedSemester, '1st Semester');
    });

    test('fails safely when expectedName is empty instead of bypassing name check', () {
      const sampleText = '''
CERTIFICATE OF REGISTRATION
First Semester, A.Y. 2026-2027
Student Name: JUAN DELA CRUZ
Subjects Enrolled: IT211 Data Structures (3.0 units)
''';

      final res = CorValidationService.evaluateCorText(
        rawText: sampleText,
        expectedName: '   ',
        targetTerm: activeTerm,
      );

      expect(res.isValid, isFalse);
      expect(res.nameMatches, isFalse);
    });
  });
}

