import 'dart:ui' as ui;
import 'dart:math' as math;
import 'package:flutter/foundation.dart';

/// Result of image sharpness and quality analysis.
class ImageQualityResult {
  /// Whether the image is considered blurry and should be retaken.
  final bool isBlurry;

  /// Raw Laplacian variance score (higher = sharper).
  final double variance;

  /// Normalized sharpness percentage between 0 and 100.
  final int sharpnessPercent;

  /// Mean brightness value (0-255).
  final double brightness;

  /// User-friendly status message.
  final String message;

  /// Short status title (e.g. "Sharp & Clear", "Blurry Scan", "Too Dark").
  final String statusTitle;

  const ImageQualityResult({
    required this.isBlurry,
    required this.variance,
    required this.sharpnessPercent,
    required this.brightness,
    required this.message,
    required this.statusTitle,
  });

  @override
  String toString() =>
      'ImageQualityResult(isBlurry: $isBlurry, variance: $variance, sharpness: $sharpnessPercent%, brightness: $brightness)';
}

/// Service to detect blurriness, motion blur, and poor focus on captured ID cards.
class ImageQualityService {
  /// Laplacian variance threshold below which an ID scan is considered blurry.
  /// Standard ID cards with text, borders, and photo produce variance >= 120+.
  /// Blurry or out-of-focus photos produce variance < 80.
  static const double defaultBlurThreshold = 80.0;

  /// Minimum acceptable brightness (0-255). Below this, the image is too dark.
  static const double minBrightnessThreshold = 25.0;

  /// Target downscaled width for consistent, rapid real-time processing.
  static const int analysisTargetWidth = 400;

  /// Analyzes image bytes and returns a comprehensive quality and blur assessment.
  static Future<ImageQualityResult> analyzeQuality(
    Uint8List imageBytes, {
    double blurThreshold = defaultBlurThreshold,
  }) async {
    try {
      // Decode image and downscale to standard width using hardware-accelerated codec
      final codec = await ui.instantiateImageCodec(
        imageBytes,
        targetWidth: analysisTargetWidth,
      );
      final frame = await codec.getNextFrame();
      final image = frame.image;
      final width = image.width;
      final height = image.height;

      // Extract raw RGBA uncompressed bytes
      final byteData = await image.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      );
      if (byteData == null) {
        return const ImageQualityResult(
          isBlurry: true,
          variance: 0.0,
          sharpnessPercent: 0,
          brightness: 0.0,
          statusTitle: 'Read Error',
          message: 'Unable to decode image data. Please capture again.',
        );
      }

      final rgba = byteData.buffer.asUint8List();
      final totalPixels = width * height;
      final gray = Uint8List(totalPixels);

      double totalLuminance = 0;

      // Convert to Grayscale Luminance (ITU-R BT.601 formula)
      // Composite transparent alpha over white paper background
      for (int i = 0; i < totalPixels; i++) {
        final offset = i * 4;
        final a = rgba[offset + 3];
        int r = rgba[offset];
        int g = rgba[offset + 1];
        int b = rgba[offset + 2];

        if (a < 255) {
          final invA = 255 - a;
          r = (r * a + 255 * invA) ~/ 255;
          g = (g * a + 255 * invA) ~/ 255;
          b = (b * a + 255 * invA) ~/ 255;
        }

        final lum = (299 * r + 587 * g + 114 * b) ~/ 1000;
        gray[i] = lum;
        totalLuminance += lum;
      }

      final meanBrightness = totalPixels > 0 ? (totalLuminance / totalPixels) : 0.0;

      // Check for extremely dark photo (black screen or camera blocked)
      if (meanBrightness < 12.0) {
        return ImageQualityResult(
          isBlurry: true,
          variance: 0.0,
          sharpnessPercent: 0,
          brightness: meanBrightness,
          statusTitle: 'Too Dark',
          message: 'The photo is too dark. Please turn on lights or avoid blocking the camera lens.',
        );
      }

      // Compute Laplacian Variance
      // Using standard 4-neighbor Laplacian kernel:
      //  [ 0,  1,  0 ]
      //  [ 1, -4,  1 ]
      //  [ 0,  1,  0 ]
      double sum = 0;
      double sumSq = 0;
      int count = 0;

      for (int y = 1; y < height - 1; y++) {
        final rowOffset = y * width;
        final rowAbove = (y - 1) * width;
        final rowBelow = (y + 1) * width;

        for (int x = 1; x < width - 1; x++) {
          final center = gray[rowOffset + x];
          final top = gray[rowAbove + x];
          final bottom = gray[rowBelow + x];
          final left = gray[rowOffset + x - 1];
          final right = gray[rowOffset + x + 1];

          final lap = (top + bottom + left + right) - (4 * center);
          final lapVal = lap.toDouble();

          sum += lapVal;
          sumSq += lapVal * lapVal;
          count++;
        }
      }

      if (count == 0) {
        return const ImageQualityResult(
          isBlurry: true,
          variance: 0.0,
          sharpnessPercent: 0,
          brightness: 0.0,
          statusTitle: 'Invalid Size',
          message: 'Image dimensions are too small to analyze.',
        );
      }

      final mean = sum / count;
      final variance = (sumSq / count) - (mean * mean);

      // Calculate a normalized sharpness score 0 - 100%
      // 0 variance = 0%, blurThreshold (80) ~= 40%, 200+ variance = 100%
      int sharpness = 0;
      if (variance > 0) {
        final ratio = variance / (blurThreshold * 2.5);
        sharpness = math.min(100, (ratio * 100).round());
      }

      final isBlurry = variance < blurThreshold;

      String statusTitle;
      String message;

      if (isBlurry) {
        statusTitle = 'Blurry Scan Detected';
        message = 'The ID photo is too blurry or out of focus. Text and details cannot be verified. Please retake a sharper scan.';
      } else if (sharpness < 60) {
        statusTitle = 'Acceptable Clarity';
        message = 'Image is acceptable and readable.';
      } else {
        statusTitle = 'Sharp & Clear';
        message = 'Image quality is sharp, clear, and readable.';
      }

      return ImageQualityResult(
        isBlurry: isBlurry,
        variance: variance,
        sharpnessPercent: sharpness,
        brightness: meanBrightness,
        statusTitle: statusTitle,
        message: message,
      );
    } catch (e) {
      debugPrint('Error in ImageQualityService: $e');
      return ImageQualityResult(
        isBlurry: true,
        variance: 0.0,
        sharpnessPercent: 0,
        brightness: 0.0,
        statusTitle: 'Analysis Failed',
        message: 'Could not analyze image clarity: $e',
      );
    }
  }
}
