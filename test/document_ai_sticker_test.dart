import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:tesdoc_project/services/academic_term_service.dart';
import 'package:tesdoc_project/services/document_ai_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AcademicTermService and Normalization Tests', () {
    test('Academic Year normalization handles multiple formats and OCR typos', () {
      expect(AcademicTermService.normalizeYear('A.Y. 2026 - 2027'), '2026-2027');
      expect(AcademicTermService.normalizeYear('AY 2026–2027'), '2026-2027');
      expect(AcademicTermService.normalizeYear('2026/2027'), '2026-2027');
      expect(AcademicTermService.normalizeYear('2026-27'), '2026-2027');
      expect(AcademicTermService.normalizeYear('Academic Year 2024-2025'), '2024-2025');
      expect(AcademicTermService.normalizeYear('2O26 - 2O27'), '2026-2027'); // OCR letter O
    });

    test('Semester normalization handles multiple formats', () {
      expect(AcademicTermService.normalizeSemester('1st Semester'), '1st Semester');
      expect(AcademicTermService.normalizeSemester('1st Sem'), '1st Semester');
      expect(AcademicTermService.normalizeSemester('First Semester'), '1st Semester');
      expect(AcademicTermService.normalizeSemester('2nd Semester'), '2nd Semester');
      expect(AcademicTermService.normalizeSemester('Second Sem'), '2nd Semester');
      expect(AcademicTermService.normalizeSemester('Summer Term'), 'Summer / Midyear');
      expect(AcademicTermService.normalizeSemester('Midyear'), 'Summer / Midyear');
    });

    test('Term validation accurately approves exact match and flags mismatches', () {
      const activeTerm = AcademicTerm(academicYear: '2026-2027', semester: '1st Semester');

      // 1. Exact match
      final matchResult = AcademicTermService.validateScannedTerm(
        detectedYear: 'A.Y. 2026 - 2027',
        detectedSemester: '1st Semester',
        targetTerm: activeTerm,
      );
      expect(matchResult.isValid, isTrue);
      expect(matchResult.isFlagged, isFalse);
      expect(matchResult.yearMatches, isTrue);
      expect(matchResult.semesterMatches, isTrue);

      // 2. Outdated year (e.g. 2024-2025)
      final expiredResult = AcademicTermService.validateScannedTerm(
        detectedYear: 'A.Y. 2024 - 2025',
        detectedSemester: '1st Semester',
        targetTerm: activeTerm,
      );
      expect(expiredResult.isValid, isFalse);
      expect(expiredResult.isFlagged, isTrue);
      expect(expiredResult.yearMatches, isFalse);
      expect(expiredResult.statusTitle, contains('Expired'));

      // 3. Semester mismatch (e.g. 2nd Sem instead of 1st)
      final semMismatchResult = AcademicTermService.validateScannedTerm(
        detectedYear: 'A.Y. 2026 - 2027',
        detectedSemester: '2nd Semester',
        targetTerm: activeTerm,
      );
      expect(semMismatchResult.isValid, isFalse);
      expect(semMismatchResult.isFlagged, isTrue);
      expect(semMismatchResult.yearMatches, isTrue);
      expect(semMismatchResult.semesterMatches, isFalse);
      expect(semMismatchResult.statusTitle, contains('Mismatch'));

      // 4. Missing sticker
      final missingResult = AcademicTermService.validateScannedTerm(
        detectedYear: null,
        detectedSemester: null,
        targetTerm: activeTerm,
      );
      expect(missingResult.isValid, isFalse);
      expect(missingResult.isFlagged, isTrue);
      expect(missingResult.statusTitle, contains('Missing'));
    });
  });

  group('DocumentAIScannerService Text Parsing Tests', () {
    test('Parses USTP ID Validation sticker text accurately', () {
      const stickerOcrText = '''
        USTP OROQUIETA
        1st Semester A.Y. 2026 - 2027
        RIZALYN P. ALPANTE, LPT
        Campus Registrar - Designate
        VALIDATED
      ''';

      const targetTerm = AcademicTerm(academicYear: '2026-2027', semester: '1st Semester');

      final result = DocumentAIScannerService.parseStickerText(
        rawText: stickerOcrText,
        engineUsed: 'Google Document AI',
        targetTerm: targetTerm,
      );

      expect(result.stickerFound, isTrue);
      expect(result.academicYear, '2026-2027');
      expect(result.semester, '1st Semester');
      expect(result.hasValidationStamp, isTrue);
      expect(result.registrarText, contains('Campus Registrar'));
      expect(result.termValidation.isValid, isTrue);
      expect(result.termValidation.isFlagged, isFalse);
      expect(result.confidence, greaterThanOrEqualTo(0.85));
    });

    test('Works for other school periods and formats (e.g. 2nd Sem 2025-2026)', () {
      const text2 = '''
        USTP OROQUIETA
        2nd Semester A.Y. 2025 - 2026
        RIZALYN P. ALPANTE, LPT
        Campus Registrar - Designate
        VALIDATED
      ''';

      const targetTerm2 = AcademicTerm(academicYear: '2025-2026', semester: '2nd Semester');

      final result2 = DocumentAIScannerService.parseStickerText(
        rawText: text2,
        engineUsed: 'Google Document AI',
        targetTerm: targetTerm2,
      );

      expect(result2.stickerFound, isTrue);
      expect(result2.academicYear, '2025-2026');
      expect(result2.semester, '2nd Semester');
      expect(result2.termValidation.isValid, isTrue);
    });

    test('Parses USTP ID Validation sticker text with OCR asterisk typo 1* Semester accurately', () {
      const stickerOcrText = '''
        USTP
        OROQUIETA
        1* Semester A.Y. 2026 - 2027
        _alpedh
        RIZALYN P. ALPANTE, LPI
        Campus Registrar - Designate
        VALIDO
      ''';

      const targetTerm = AcademicTerm(academicYear: '2026-2027', semester: '1st Semester');

      final result = DocumentAIScannerService.parseStickerText(
        rawText: stickerOcrText,
        engineUsed: 'High-Accuracy Document OCR',
        targetTerm: targetTerm,
      );

      expect(result.stickerFound, isTrue);
      expect(result.academicYear, '2026-2027');
      expect(result.semester, '1st Semester');
      expect(result.hasValidationStamp, isTrue);
      expect(result.termValidation.isValid, isTrue);
      expect(result.termValidation.isFlagged, isFalse);
    });

    test('Prevents false positives on random numbers like Page 1 of 2', () {
      const randomText = 'USTP Student Handbook Page 1 of 2 Rules and Regulations';
      const targetTerm = AcademicTerm(academicYear: '2026-2027', semester: '1st Semester');

      final result = DocumentAIScannerService.parseStickerText(
        rawText: randomText,
        engineUsed: 'High-Accuracy Document OCR',
        targetTerm: targetTerm,
      );

      // Semester should not be detected from Page 1 of 2
      expect(result.semester, isNull);
      expect(result.termValidation.isValid, isFalse);
    });

    test('ROI cropping executes without error on local sticker asset', () async {
      final file = File('assets/610fa119-da65-4d5d-bd6e-ed56bbcd1dc7.jpg');
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        final cropped = await DocumentAIScannerService.cropUpperStickerROI(bytes);
        expect(cropped, isNotEmpty);
      }
    });
  });
}
