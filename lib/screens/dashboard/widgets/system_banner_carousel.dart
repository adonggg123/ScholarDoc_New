import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../config/api_config.dart';
import '../../../theme/app_theme.dart';

class _CarouselSlide {
  final String backgroundImagePath;

  const _CarouselSlide({required this.backgroundImagePath});
}

class ScholarDocCarousel extends StatefulWidget {
  const ScholarDocCarousel({super.key});

  @override
  State<ScholarDocCarousel> createState() => _ScholarDocCarouselState();
}

class _ScholarDocCarouselState extends State<ScholarDocCarousel> {
  late final PageController _pageController;
  int _currentPage = 0;
  Timer? _timer;

  List<_CarouselSlide> _slides = const [
    _CarouselSlide(backgroundImagePath: 'assets/Slide_image1.jpg'),
    _CarouselSlide(backgroundImagePath: 'assets/Slide_image2.jpg'),
    _CarouselSlide(backgroundImagePath: 'assets/Slide_image3.jpg'),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.93, initialPage: 0);
    _startTimer();
    _fetchRemoteBanners();
  }

  Future<void> _fetchRemoteBanners() async {
    try {
      final candidates = await ApiConfig.resolveFastCandidates();
      for (final candidate in candidates) {
        try {
          final uri = Uri.parse('$candidate/api/banners?active=true');
          final res = await http.get(uri).timeout(const Duration(seconds: 4));
          if (res.statusCode == 200) {
            final data = jsonDecode(res.body);
            if (data is Map && data['banners'] is List) {
              final list = data['banners'] as List;
              if (list.isNotEmpty && mounted) {
                final newSlides = <_CarouselSlide>[];
                for (final item in list) {
                  if (item is Map && item['imageUrl'] != null) {
                    var imgUrl = item['imageUrl'].toString();
                    if (imgUrl.startsWith('/')) {
                      imgUrl = '$candidate$imgUrl';
                    }
                    newSlides.add(_CarouselSlide(backgroundImagePath: imgUrl));
                  }
                }
                if (newSlides.isNotEmpty && mounted) {
                  setState(() {
                    _slides = newSlides;
                  });
                  _startTimer();
                  return;
                }
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  void _startTimer() {
    _timer?.cancel();
    if (_slides.length <= 1) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_pageController.hasClients && _slides.isNotEmpty) {
        final nextPage = (_currentPage + 1) % _slides.length;
        _pageController.animateToPage(
          nextPage,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  void _onPageChanged(int index) {
    setState(() {
      _currentPage = index;
    });
    // Restart timer when user manually swipes
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Widget _buildImage(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return Image.network(
        path,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
      );
    }
    return Image.asset(
      path,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        // Fallback for case variation (e.g. Slide_image vs slide_image)
        final alternatePath = path.contains('Slide_')
            ? path.replaceAll('Slide_', 'slide_')
            : path.replaceAll('slide_', 'Slide_');
        return Image.asset(
          alternatePath,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
        );
      },
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: const Color(0xFF0F3260),
      alignment: Alignment.center,
      child: const Icon(LucideIcons.image, color: Colors.white38, size: 36),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 180,
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: _onPageChanged,
            itemCount: _slides.length,
            itemBuilder: (context, index) {
              final slide = _slides[index];
              return _buildSlideCard(slide);
            },
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_slides.length, (index) => _buildDot(index)),
        ),
      ],
    );
  }

  Widget _buildSlideCard(_CarouselSlide slide) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.black.withOpacity(0.06), width: 1),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryColor.withOpacity(0.18),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: SizedBox(
          width: double.infinity,
          height: double.infinity,
          child: _buildImage(slide.backgroundImagePath),
        ),
      ),
    );
  }

  Widget _buildDot(int index) {
    final isActive = _currentPage == index;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      height: 6,
      width: isActive ? 18 : 6,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(3),
        color: isActive ? AppTheme.primaryColor : Colors.grey.withOpacity(0.4),
      ),
    );
  }
}
