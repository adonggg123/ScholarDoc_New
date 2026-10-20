import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';
import '../../services/push_notification_service.dart';
import '../main_layout.dart';
import '../admin/admin_main_layout.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeIn));

    _scaleAnimation = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));

    _controller.forward();

    // Check active session after animation finishes
    Future.delayed(const Duration(milliseconds: 2200), () async {
      if (!mounted) return;
      try {
        final session = Supabase.instance.client.auth.currentSession;
        if (session != null) {
          final authService = AuthService();
          final isUserAdmin = await authService.isCurrentUserAdmin();
          if (!mounted) return;

          if (isUserAdmin) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const AdminMainLayout()),
            );
            return;
          }

          // Student user: sync token and proceed to MainLayout
          try {
            final profile = await authService.getStudentProfile(session.user.id);
            final studentId = profile?['studentId'] ?? profile?['student_no'];
            await PushNotificationService().syncToken(
              session.user.id,
              studentId: studentId?.toString(),
            );
          } catch (_) {}

          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const MainLayout()),
          );
          return;
        }
      } catch (e) {
        debugPrint('SplashScreen session check notice: $e');
      }

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const LoginScreen(),
          transitionsBuilder:
              (context, animation, secondaryAnimation, child) {
                return FadeTransition(opacity: animation, child: child);
              },
          transitionDuration: const Duration(milliseconds: 800),
        ),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return FadeTransition(
              opacity: _fadeAnimation,
              child: ScaleTransition(
                scale: _scaleAnimation,
                child: Stack(
                  children: [
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Image.asset(
                            'assets/app_logo3.png',
                            width: 160,
                            height: 160,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(height: 16),
                          // Elegant loading bar
                          SizedBox(
                            width: 140,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: const LinearProgressIndicator(
                                backgroundColor: Color(0xFFF1F5F9),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Color(0xFFFBC02D),
                                ),
                                minHeight: 4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      bottom: 24,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            colors: [Color(0xFF0F3260), Color(0xFFFBC02D)],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ).createShader(bounds),
                          blendMode: BlendMode.srcIn,
                          child: const Text(
                            'SCHOLARDOC',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 4.0,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
