import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:tesdoc_project/services/image_quality_service.dart';

void main() {
  test('Test ImageQualityService on asset images', () async {
    final file = File('assets/app_logo3.png');
    if (await file.exists()) {
      final bytes = await file.readAsBytes();
      final result = await ImageQualityService.analyzeQuality(bytes);
      print('app_logo3.png: $result');
      expect(result.variance, greaterThan(80));
      expect(result.isBlurry, isFalse);
    }

    final campusFile = File('assets/campus_bg.jpg');
    if (await campusFile.exists()) {
      final bytes = await campusFile.readAsBytes();
      final result = await ImageQualityService.analyzeQuality(bytes);
      print('campus_bg.jpg: $result');
      expect(result.variance, greaterThan(80));
      expect(result.isBlurry, isFalse);
    }
  });
}


