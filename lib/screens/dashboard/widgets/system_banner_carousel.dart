import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../theme/app_theme.dart';
import '../../../theme/theme_provider.dart';

class _CarouselSlide {
  final String badge;
  final String title;
  final String description;
  final IconData icon;
  final List<Color> gradientColors;
  final String backgroundImagePath;

  const _CarouselSlide({
    required this.badge,
    required this.title,
    required this.description,
    required this.icon,
    required this.gradientColors,
    required this.backgroundImagePath,
  });
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

  final List<_CarouselSlide> _slides = const [
    _CarouselSlide(
      badge: 'FAST SUBMISSIONS',
      title: 'Seamless Doc Submissions',
      description: 'Capture your ID cards and draw your signature directly in the app.',
      icon: LucideIcons.fileUp,
      gradientColors: [Color(0xFF0F3260), Color(0xFF1D5CAB)],
      backgroundImagePath: 'assets/Slide_image1.jpg',
    ),
    _CarouselSlide(
      badge: 'AI VERIFICATION',
      title: 'Instant OCR Scanning',
      description: 'Verify your billing details automatically with integrated text extraction.',
      icon: LucideIcons.scanFace,
      gradientColors: [Color(0xFF1E88E5), Color(0xFF00ACC1)],
      backgroundImagePath: 'assets/Slide_image2.jpg',
    ),
    _CarouselSlide(
      badge: 'REAL-TIME TRACKING',
      title: 'Live Status Monitoring',
      description: 'Stay updated on your scholarship approval and billing logs instantly.',
      icon: LucideIcons.bellRing,
      gradientColors: [Color(0xFF43A047), Color(0xFF2E7D32)],
      backgroundImagePath: 'assets/slide_image3.jpg',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.93, initialPage: 0);
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_pageController.hasClients) {
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
    // Restart the timer to give the user 5 seconds from the moment they manually swipe
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
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
          children: List.generate(
            _slides.length,
            (index) => _buildDot(index),
          ),
        ),
      ],
    );
  }

  Widget _buildSlideCard(_CarouselSlide slide) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withOpacity(0.15),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: slide.gradientColors.first.withOpacity(0.2),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            // Background Image
            Positioned.fill(
              child: Image.asset(
                slide.backgroundImagePath,
                fit: BoxFit.cover,
              ),
            ),
            // Themed gradient overlay to ensure text readability
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      slide.gradientColors.first.withOpacity(0.85),
                      slide.gradientColors.last.withOpacity(0.65),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            // Decorative background shapes for extra aesthetic quality
            Positioned(
              right: -30,
              top: -30,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withOpacity(0.06),
                ),
              ),
            ),
            Positioned(
              right: 60,
              bottom: -40,
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withOpacity(0.04),
                ),
              ),
            ),
            // Card Content
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Badge Pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            slide.badge,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Title
                        Text(
                          slide.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Description
                        Text(
                          slide.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.85),
                            fontSize: 12.5,
                            height: 1.35,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Glowing Icon Container
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.12),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.2),
                        width: 1,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      slide.icon,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ],
              ),
            ),
          ],
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
        color: isActive
            ? AppTheme.primaryColor
            : Colors.grey.withOpacity(0.4),
      ),
    );
  }
}
