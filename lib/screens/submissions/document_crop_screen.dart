import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../theme/app_theme.dart';
import '../../services/image_enhancement_service.dart';

/// Interactive CamScanner-style crop, rotation, and document enhancement screen.
class DocumentCropScreen extends StatefulWidget {
  final Uint8List imageBytes;
  final String title;
  final String documentType; // 'Front of ID', 'Back of ID', 'ATM Proof', etc.
  final bool isIdCard;

  const DocumentCropScreen({
    super.key,
    required this.imageBytes,
    this.title = 'Adjust & Enhance Document',
    this.documentType = 'Document',
    this.isIdCard = true,
  });

  @override
  State<DocumentCropScreen> createState() => _DocumentCropScreenState();
}

class _DocumentCropScreenState extends State<DocumentCropScreen> {
  ui.Image? _decodedImage;
  bool _isLoading = true;
  bool _isProcessing = false;

  // Normalized crop bounds (0.0 to 1.0)
  double _cropLeft = 0.05;
  double _cropTop = 0.05;
  double _cropRight = 0.95;
  double _cropBottom = 0.95;

  int _rotationDegrees = 0;
  DocumentFilterType _selectedFilter = DocumentFilterType.magicColor;

  // Active handle being dragged
  _HandleType? _activeHandle;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  Future<void> _loadImage() async {
    try {
      final codec = await ui.instantiateImageCodec(widget.imageBytes);
      final frame = await codec.getNextFrame();
      final img = frame.image;

      final initialRect =
          ImageEnhancementService.calculateInitialDocumentBounds(
            img.width,
            img.height,
            isIdCard: widget.isIdCard,
          );

      if (mounted) {
        setState(() {
          _decodedImage = img;
          _cropLeft = initialRect.left;
          _cropTop = initialRect.top;
          _cropRight = initialRect.right;
          _cropBottom = initialRect.bottom;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading image in DocumentCropScreen: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _resetToFull() {
    setState(() {
      _cropLeft = 0.02;
      _cropTop = 0.02;
      _cropRight = 0.98;
      _cropBottom = 0.98;
    });
  }

  void _autoDetect() {
    if (_decodedImage == null) return;
    final r = ImageEnhancementService.calculateInitialDocumentBounds(
      _decodedImage!.width,
      _decodedImage!.height,
      isIdCard: widget.isIdCard,
    );
    setState(() {
      _cropLeft = r.left;
      _cropTop = r.top;
      _cropRight = r.right;
      _cropBottom = r.bottom;
    });
  }

  void _rotateClockwise() {
    setState(() {
      _rotationDegrees = (_rotationDegrees + 90) % 360;
    });
  }

  Future<void> _applyAndConfirm() async {
    setState(() => _isProcessing = true);
    try {
      final processedBytes = await ImageEnhancementService.processDocumentImage(
        imageBytes: widget.imageBytes,
        filter: _selectedFilter,
        normalizedCropRect: ui.Rect.fromLTRB(
          _cropLeft,
          _cropTop,
          _cropRight,
          _cropBottom,
        ),
        rotationDegrees: _rotationDegrees,
      );

      if (!mounted) return;
      Navigator.pop(context, processedBytes);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to process scan: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Column(
          children: [
            Text(
              widget.title,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
            const SizedBox(height: 2),
            Text(
              'Align edges & select CamScanner filter',
              style: TextStyle(
                fontSize: 11,
                color: Colors.white.withOpacity(0.7),
              ),
            ),
          ],
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => Navigator.pop(context, null),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.rotateCw),
            tooltip: 'Rotate 90°',
            onPressed: _rotateClockwise,
          ),
          IconButton(
            icon: const Icon(LucideIcons.scanLine),
            tooltip: 'Auto Bounds',
            onPressed: _autoDetect,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.accentColor),
            )
          : Column(
              children: [
                // Interactive Cropper Canvas
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: _buildCropperCanvas(),
                  ),
                ),

                // Enhancement & Filter Control Panel
                _buildControlPanel(),
              ],
            ),
    );
  }

  Widget _buildCropperCanvas() {
    if (_decodedImage == null) {
      return const Center(
        child: Text('Image not loaded', style: TextStyle(color: Colors.white)),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final imgW = _decodedImage!.width.toDouble();
        final imgH = _decodedImage!.height.toDouble();

        // Calculate fitted display rect maintaining aspect ratio
        final containerW = constraints.maxWidth;
        final containerH = constraints.maxHeight;

        // If rotated by 90 or 270, swap dimensions
        final isRotated90 = _rotationDegrees % 180 != 0;
        final effW = isRotated90 ? imgH : imgW;
        final effH = isRotated90 ? imgW : imgH;

        final scale = (containerW / effW).clamp(0.0, containerH / effH);
        final displayedW = effW * scale;
        final displayedH = effH * scale;

        final offsetX = (containerW - displayedW) / 2;
        final offsetY = (containerH - displayedH) / 2;

        return Stack(
          children: [
            // Rotated Image Display
            Positioned(
              left: offsetX,
              top: offsetY,
              width: displayedW,
              height: displayedH,
              child: RotatedBox(
                quarterTurns: (_rotationDegrees ~/ 90) % 4,
                child: RawImage(image: _decodedImage, fit: BoxFit.fill),
              ),
            ),

            // Dimmed backdrop & Interactive Crop Handles
            Positioned(
              left: offsetX,
              top: offsetY,
              width: displayedW,
              height: displayedH,
              child: GestureDetector(
                onPanDown: (details) => _handlePanDown(
                  details.localPosition,
                  displayedW,
                  displayedH,
                ),
                onPanUpdate: (details) => _handlePanUpdate(
                  details.localPosition,
                  displayedW,
                  displayedH,
                ),
                onPanEnd: (_) => setState(() => _activeHandle = null),
                child: CustomPaint(
                  size: Size(displayedW, displayedH),
                  painter: _CropOverlayPainter(
                    cropLeft: _cropLeft,
                    cropTop: _cropTop,
                    cropRight: _cropRight,
                    cropBottom: _cropBottom,
                    accentColor: const Color(0xFFFBC02D),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _handlePanDown(Offset pos, double w, double h) {
    final xNorm = (pos.dx / w).clamp(0.0, 1.0);
    final yNorm = (pos.dy / h).clamp(0.0, 1.0);

    const hitDist = 0.08; // Normalized hit touch radius

    // Check 4 corners first
    if ((xNorm - _cropLeft).abs() < hitDist &&
        (yNorm - _cropTop).abs() < hitDist) {
      _activeHandle = _HandleType.topLeft;
    } else if ((xNorm - _cropRight).abs() < hitDist &&
        (yNorm - _cropTop).abs() < hitDist) {
      _activeHandle = _HandleType.topRight;
    } else if ((xNorm - _cropLeft).abs() < hitDist &&
        (yNorm - _cropBottom).abs() < hitDist) {
      _activeHandle = _HandleType.bottomLeft;
    } else if ((xNorm - _cropRight).abs() < hitDist &&
        (yNorm - _cropBottom).abs() < hitDist) {
      _activeHandle = _HandleType.bottomRight;
    }
    // Check 4 edges
    else if ((yNorm - _cropTop).abs() < hitDist &&
        xNorm >= _cropLeft &&
        xNorm <= _cropRight) {
      _activeHandle = _HandleType.top;
    } else if ((yNorm - _cropBottom).abs() < hitDist &&
        xNorm >= _cropLeft &&
        xNorm <= _cropRight) {
      _activeHandle = _HandleType.bottom;
    } else if ((xNorm - _cropLeft).abs() < hitDist &&
        yNorm >= _cropTop &&
        yNorm <= _cropBottom) {
      _activeHandle = _HandleType.left;
    } else if ((xNorm - _cropRight).abs() < hitDist &&
        yNorm >= _cropTop &&
        yNorm <= _cropBottom) {
      _activeHandle = _HandleType.right;
    }
    // Inside the crop box: move whole box
    else if (xNorm > _cropLeft &&
        xNorm < _cropRight &&
        yNorm > _cropTop &&
        yNorm < _cropBottom) {
      _activeHandle = _HandleType.center;
    } else {
      _activeHandle = null;
    }
  }

  void _handlePanUpdate(Offset pos, double w, double h) {
    if (_activeHandle == null) return;

    final xNorm = (pos.dx / w).clamp(0.0, 1.0);
    final yNorm = (pos.dy / h).clamp(0.0, 1.0);
    const minSize = 0.15; // Minimum 15% width/height

    setState(() {
      switch (_activeHandle!) {
        case _HandleType.topLeft:
          _cropLeft = xNorm.clamp(0.0, _cropRight - minSize);
          _cropTop = yNorm.clamp(0.0, _cropBottom - minSize);
          break;
        case _HandleType.topRight:
          _cropRight = xNorm.clamp(_cropLeft + minSize, 1.0);
          _cropTop = yNorm.clamp(0.0, _cropBottom - minSize);
          break;
        case _HandleType.bottomLeft:
          _cropLeft = xNorm.clamp(0.0, _cropRight - minSize);
          _cropBottom = yNorm.clamp(_cropTop + minSize, 1.0);
          break;
        case _HandleType.bottomRight:
          _cropRight = xNorm.clamp(_cropLeft + minSize, 1.0);
          _cropBottom = yNorm.clamp(_cropTop + minSize, 1.0);
          break;
        case _HandleType.top:
          _cropTop = yNorm.clamp(0.0, _cropBottom - minSize);
          break;
        case _HandleType.bottom:
          _cropBottom = yNorm.clamp(_cropTop + minSize, 1.0);
          break;
        case _HandleType.left:
          _cropLeft = xNorm.clamp(0.0, _cropRight - minSize);
          break;
        case _HandleType.right:
          _cropRight = xNorm.clamp(_cropLeft + minSize, 1.0);
          break;
        case _HandleType.center:
          final currentW = _cropRight - _cropLeft;
          final currentH = _cropBottom - _cropTop;
          var newLeft = xNorm - (currentW / 2);
          var newTop = yNorm - (currentH / 2);
          if (newLeft < 0.0) newLeft = 0.0;
          if (newTop < 0.0) newTop = 0.0;
          if (newLeft + currentW > 1.0) newLeft = 1.0 - currentW;
          if (newTop + currentH > 1.0) newTop = 1.0 - currentH;
          _cropLeft = newLeft;
          _cropTop = newTop;
          _cropRight = newLeft + currentW;
          _cropBottom = newTop + currentH;
          break;
      }
    });
  }

  Widget _buildControlPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Filter presets selector (CamScanner style)
          Row(
            children: [
              const Text(
                'FILTER:',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.8,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: DocumentFilterType.values.map((filter) {
                      final isSelected = _selectedFilter == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(
                            filter.displayName,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: isSelected
                                  ? const Color(0xFF0F172A)
                                  : Colors.white,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: const Color(0xFFFBC02D),
                          backgroundColor: Colors.white.withOpacity(0.08),
                          side: BorderSide(
                            color: isSelected
                                ? const Color(0xFFFBC02D)
                                : Colors.white24,
                          ),
                          onSelected: (val) {
                            if (val) setState(() => _selectedFilter = filter);
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Secondary utility buttons (Reset bounds, Full document)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              TextButton.icon(
                onPressed: _autoDetect,
                icon: const Icon(
                  LucideIcons.focus,
                  size: 14,
                  color: Colors.white70,
                ),
                label: const Text(
                  'Auto Fit',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
              TextButton.icon(
                onPressed: _resetToFull,
                icon: const Icon(
                  LucideIcons.maximize,
                  size: 14,
                  color: Colors.white70,
                ),
                label: const Text(
                  'Full Page',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
              TextButton.icon(
                onPressed: _rotateClockwise,
                icon: const Icon(
                  LucideIcons.rotateCw,
                  size: 14,
                  color: Colors.white70,
                ),
                label: Text(
                  'Rotate ($_rotationDegrees°)',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Primary Actions: Retake vs Confirm Scan
          Row(
            children: [
              Expanded(
                flex: 1,
                child: OutlinedButton.icon(
                  onPressed: _isProcessing
                      ? null
                      : () => Navigator.pop(context, null),
                  icon: const Icon(LucideIcons.refreshCw, size: 16),
                  label: const Text(
                    'Retake',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _applyAndConfirm,
                  icon: _isProcessing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(LucideIcons.check, size: 18),
                  label: Text(
                    _isProcessing ? 'Enhancing...' : 'Confirm & Use Scan',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 2,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _HandleType {
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  top,
  bottom,
  left,
  right,
  center,
}

/// Custom painter to draw the dimmed boundary overlay and 4 corner handles
class _CropOverlayPainter extends CustomPainter {
  final double cropLeft;
  final double cropTop;
  final double cropRight;
  final double cropBottom;
  final Color accentColor;

  _CropOverlayPainter({
    required this.cropLeft,
    required this.cropTop,
    required this.cropRight,
    required this.cropBottom,
    required this.accentColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final rect = Rect.fromLTRB(
      cropLeft * w,
      cropTop * h,
      cropRight * w,
      cropBottom * h,
    );

    // 1. Draw darkened overlay outside crop box
    final darkPaint = Paint()..color = Colors.black.withOpacity(0.55);
    canvas.drawRect(Rect.fromLTWH(0, 0, w, rect.top), darkPaint);
    canvas.drawRect(
      Rect.fromLTWH(0, rect.bottom, w, h - rect.bottom),
      darkPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(0, rect.top, rect.left, rect.height),
      darkPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(rect.right, rect.top, w - rect.right, rect.height),
      darkPaint,
    );

    // 2. Draw border frame
    final borderPaint = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawRect(rect, borderPaint);

    // 3. Draw Rule of Thirds grid
    final gridPaint = Paint()
      ..color = Colors.white.withOpacity(0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final oneThirdW = rect.width / 3;
    final oneThirdH = rect.height / 3;
    canvas.drawLine(
      Offset(rect.left + oneThirdW, rect.top),
      Offset(rect.left + oneThirdW, rect.bottom),
      gridPaint,
    );
    canvas.drawLine(
      Offset(rect.left + 2 * oneThirdW, rect.top),
      Offset(rect.left + 2 * oneThirdW, rect.bottom),
      gridPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.top + oneThirdH),
      Offset(rect.right, rect.top + oneThirdH),
      gridPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.top + 2 * oneThirdH),
      Offset(rect.right, rect.top + 2 * oneThirdH),
      gridPaint,
    );

    // 4. Draw Corner Angle Brackets (CamScanner aesthetic)
    const bracketLen = 22.0;
    const bracketThick = 4.0;
    final bracketPaint = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = bracketThick
      ..strokeCap = StrokeCap.square;

    // Top-left
    canvas.drawLine(
      Offset(rect.left - 1, rect.top),
      Offset(rect.left + bracketLen, rect.top),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.top - 1),
      Offset(rect.left, rect.top + bracketLen),
      bracketPaint,
    );

    // Top-right
    canvas.drawLine(
      Offset(rect.right + 1, rect.top),
      Offset(rect.right - bracketLen, rect.top),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(rect.right, rect.top - 1),
      Offset(rect.right, rect.top + bracketLen),
      bracketPaint,
    );

    // Bottom-left
    canvas.drawLine(
      Offset(rect.left - 1, rect.bottom),
      Offset(rect.left + bracketLen, rect.bottom),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.bottom + 1),
      Offset(rect.left, rect.bottom - bracketLen),
      bracketPaint,
    );

    // Bottom-right
    canvas.drawLine(
      Offset(rect.right + 1, rect.bottom),
      Offset(rect.right - bracketLen, rect.bottom),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(rect.right, rect.bottom + 1),
      Offset(rect.right, rect.bottom - bracketLen),
      bracketPaint,
    );

    // 5. Draw center edge drag dots
    final dotPaint = Paint()..color = accentColor;
    canvas.drawCircle(Offset(rect.center.dx, rect.top), 4.5, dotPaint);
    canvas.drawCircle(Offset(rect.center.dx, rect.bottom), 4.5, dotPaint);
    canvas.drawCircle(Offset(rect.left, rect.center.dy), 4.5, dotPaint);
    canvas.drawCircle(Offset(rect.right, rect.center.dy), 4.5, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _CropOverlayPainter oldDelegate) {
    return oldDelegate.cropLeft != cropLeft ||
        oldDelegate.cropTop != cropTop ||
        oldDelegate.cropRight != cropRight ||
        oldDelegate.cropBottom != cropBottom ||
        oldDelegate.accentColor != accentColor;
  }
}
