import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

/// Supported CamScanner-style enhancement filters
enum DocumentFilterType {
  original,
  magicColor,
  bwDocument,
  grayscale,
}

extension DocumentFilterTypeExt on DocumentFilterType {
  String get displayName {
    switch (this) {
      case DocumentFilterType.original:
        return 'Original';
      case DocumentFilterType.magicColor:
        return 'Magic Color';
      case DocumentFilterType.bwDocument:
        return 'B&W Clean';
      case DocumentFilterType.grayscale:
        return 'Grayscale';
    }
  }

  String get description {
    switch (this) {
      case DocumentFilterType.original:
        return 'Unfiltered camera capture';
      case DocumentFilterType.magicColor:
        return 'CamScanner enhanced contrast & clarity';
      case DocumentFilterType.bwDocument:
        return 'High contrast black & white document';
      case DocumentFilterType.grayscale:
        return 'Monochrome scan without noise';
    }
  }
}

/// Service providing CamScanner-like document enhancement, cropping, and rotation.
class ImageEnhancementService {
  /// Applies cropping, rotation, and chosen CamScanner enhancement filter.
  static Future<Uint8List> processDocumentImage({
    required Uint8List imageBytes,
    DocumentFilterType filter = DocumentFilterType.magicColor,
    ui.Rect? normalizedCropRect,
    int rotationDegrees = 0,
    int quality = 92,
  }) async {
    return compute(_processImageWorker, _WorkerParams(
      bytes: imageBytes,
      filter: filter,
      cropLeft: normalizedCropRect?.left,
      cropTop: normalizedCropRect?.top,
      cropRight: normalizedCropRect?.right,
      cropBottom: normalizedCropRect?.bottom,
      rotationDegrees: rotationDegrees,
      quality: quality,
    ));
  }

  /// Worker function executed in isolate or main thread for image manipulation
  static Uint8List _processImageWorker(_WorkerParams params) {
    img.Image? image = img.decodeImage(params.bytes);
    if (image == null) {
      return params.bytes;
    }

    // 1. Apply normalized cropping if provided
    if (params.cropLeft != null &&
        params.cropTop != null &&
        params.cropRight != null &&
        params.cropBottom != null) {
      final left = (params.cropLeft!.clamp(0.0, 1.0) * image.width).round();
      final top = (params.cropTop!.clamp(0.0, 1.0) * image.height).round();
      final right = (params.cropRight!.clamp(0.0, 1.0) * image.width).round();
      final bottom = (params.cropBottom!.clamp(0.0, 1.0) * image.height).round();

      final cropWidth = (right - left).clamp(10, image.width - left);
      final cropHeight = (bottom - top).clamp(10, image.height - top);

      if (cropWidth > 20 && cropHeight > 20) {
        image = img.copyCrop(
          image,
          x: left,
          y: top,
          width: cropWidth,
          height: cropHeight,
        );
      }
    }

    // 2. Apply Rotation if specified (90, 180, 270 degrees)
    if (params.rotationDegrees % 360 != 0) {
      image = img.copyRotate(image, angle: params.rotationDegrees % 360);
    }

    // 3. Apply CamScanner Enhancement Filter
    switch (params.filter) {
      case DocumentFilterType.magicColor:
        // CamScanner "Magic Color":
        // - Increases contrast so text pops against white paper
        // - Slightly increases brightness and saturation
        // - Preserves all document text without destructive binarization
        image = img.adjustColor(
          image,
          contrast: 1.25,
          brightness: 1.06,
          saturation: 1.08,
        );
        break;

      case DocumentFilterType.bwDocument:
        // CamScanner "B&W Document":
        // - Grayscale conversion
        // - High-contrast boost to make white backgrounds pure white and ink crisp black
        image = img.grayscale(image);
        image = img.adjustColor(
          image,
          contrast: 1.55,
          brightness: 1.15,
        );
        break;

      case DocumentFilterType.grayscale:
        // Clean monochrome scan
        image = img.grayscale(image);
        image = img.adjustColor(
          image,
          contrast: 1.15,
          brightness: 1.04,
        );
        break;

      case DocumentFilterType.original:
        // No filter modifications
        break;
    }

    // Encode to high-quality JPEG
    final outBytes = img.encodeJpg(image, quality: params.quality);
    return Uint8List.fromList(outBytes);
  }

  /// Calculates smart initial document bounds (normalized 0.0 to 1.0)
  /// If aspect ratio indicates ID card or document, centers a bounding box.
  static ui.Rect calculateInitialDocumentBounds(int width, int height, {bool isIdCard = true}) {
    if (width <= 0 || height <= 0) {
      return const ui.Rect.fromLTWH(0.05, 0.05, 0.9, 0.9);
    }

    final isLandscape = width >= height;

    if (isIdCard) {
      // Standard ISO ID card ratio: ~1.586
      const targetRatio = 1.586;
      if (isLandscape) {
        final boxWidth = 0.90;
        final boxHeight = (boxWidth * (width / height)) / targetRatio;
        final clampedHeight = boxHeight.clamp(0.40, 0.90);
        final top = (1.0 - clampedHeight) / 2;
        final left = (1.0 - boxWidth) / 2;
        return ui.Rect.fromLTWH(left, top, boxWidth, clampedHeight);
      } else {
        // Vertical camera taking horizontal card or portrait card
        final boxWidth = 0.88;
        final boxHeight = boxWidth / (targetRatio * (width / height));
        final clampedHeight = boxHeight.clamp(0.35, 0.85);
        final top = (1.0 - clampedHeight) / 2;
        final left = (1.0 - boxWidth) / 2;
        return ui.Rect.fromLTWH(left, top, boxWidth, clampedHeight);
      }
    }

    // Default document padding
    return const ui.Rect.fromLTWH(0.04, 0.04, 0.92, 0.92);
  }
}

class _WorkerParams {
  final Uint8List bytes;
  final DocumentFilterType filter;
  final double? cropLeft;
  final double? cropTop;
  final double? cropRight;
  final double? cropBottom;
  final int rotationDegrees;
  final int quality;

  _WorkerParams({
    required this.bytes,
    required this.filter,
    this.cropLeft,
    this.cropTop,
    this.cropRight,
    this.cropBottom,
    required this.rotationDegrees,
    required this.quality,
  });
}
