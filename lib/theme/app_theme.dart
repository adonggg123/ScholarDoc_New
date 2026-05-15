import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF0F3260); // Doc Blue
  static const Color secondaryColor = Color(0xFF43A047); // Doc Green
  static const Color accentColor = Color(0xFFFBC02D); // Laurel Gold
  static const Color backgroundColor = Color(0xFFF9FAFB);
  static const Color surfaceColor = Colors.white;
  static const Color textPrimary = Color(0xFF1F2937);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color success = Color(0xFF43A047);
  static const Color warning = Color(0xFFFBC02D);
  static const Color error = Color(0xFFEF4444);
  // Premium Shadows
  static List<BoxShadow> get softShadow => [
    BoxShadow(
      color: Colors.black.withOpacity(0.02),
      offset: const Offset(0, 4),
      blurRadius: 8,
    ),
    BoxShadow(
      color: Colors.black.withOpacity(0.01),
      offset: const Offset(0, 15),
      blurRadius: 30,
    ),
  ];

  static List<BoxShadow> get premiumShadow => [
    BoxShadow(
      color: primaryColor.withOpacity(0.08),
      offset: const Offset(0, 20),
      blurRadius: 40,
      spreadRadius: -10,
    ),
  ];

  static BoxDecoration glassDecoration({double blur = 10, double opacity = 0.7, List<BoxShadow>? boxShadow, BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: Colors.white.withOpacity(opacity),
      borderRadius: borderRadius ?? BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withOpacity(0.2)),
      boxShadow: boxShadow,
    );
  }

  static BoxDecoration crispDecoration({List<BoxShadow>? boxShadow}) {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: Colors.grey.shade200, width: 1.5),
      boxShadow: boxShadow ?? softShadow,
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
        secondary: secondaryColor,
        surface: backgroundColor,
        error: error,
      ),
      scaffoldBackgroundColor: backgroundColor,
      textTheme: GoogleFonts.interTextTheme().copyWith(
        displayLarge: GoogleFonts.poppins(
            color: textPrimary, fontWeight: FontWeight.bold, letterSpacing: -0.5),
        displayMedium: GoogleFonts.poppins(
            color: textPrimary, fontWeight: FontWeight.bold, letterSpacing: -0.5),
        headlineLarge: GoogleFonts.poppins(
            color: textPrimary, fontWeight: FontWeight.w600, letterSpacing: -0.3),
        headlineMedium: GoogleFonts.poppins(
            color: textPrimary, fontWeight: FontWeight.w600, letterSpacing: -0.3),
        titleLarge: GoogleFonts.poppins(
            color: textPrimary, fontWeight: FontWeight.w600),
        titleMedium: GoogleFonts.inter(
            color: textPrimary, fontWeight: FontWeight.w500),
        bodyLarge: GoogleFonts.inter(color: textPrimary, letterSpacing: 0.1),
        bodyMedium: GoogleFonts.inter(color: textSecondary, letterSpacing: 0.1),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surfaceColor,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: textPrimary),
        titleTextStyle: GoogleFonts.poppins(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: const BorderSide(color: primaryColor, width: 1.5),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: error, width: 1.5),
        ),
        labelStyle: GoogleFonts.inter(color: textSecondary),
        hintStyle: GoogleFonts.inter(color: Colors.grey.shade400),
      ),
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        margin: EdgeInsets.zero,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }

  static ThemeData get darkTheme {
    const Color darkBg = Color(0xFF0F172A);
    const Color darkSurface = Color(0xFF1E293B);
    const Color darkTextPri = Color(0xFFF8FAFC);
    const Color darkTextSec = Color(0xFF94A3B8);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        primary: primaryColor,
        secondary: secondaryColor,
        surface: darkSurface,
        onSurface: darkTextPri,
        onSurfaceVariant: darkTextSec,
        error: error,
      ),
      scaffoldBackgroundColor: darkBg,
      textTheme: GoogleFonts.interTextTheme().copyWith(
        displayLarge: GoogleFonts.poppins(color: darkTextPri, fontWeight: FontWeight.bold, letterSpacing: -0.5),
        displayMedium: GoogleFonts.poppins(color: darkTextPri, fontWeight: FontWeight.bold, letterSpacing: -0.5),
        headlineLarge: GoogleFonts.poppins(color: darkTextPri, fontWeight: FontWeight.w600, letterSpacing: -0.3),
        headlineMedium: GoogleFonts.poppins(color: darkTextPri, fontWeight: FontWeight.w600, letterSpacing: -0.3),
        titleLarge: GoogleFonts.poppins(color: darkTextPri, fontWeight: FontWeight.w600),
        titleMedium: GoogleFonts.inter(color: darkTextPri, fontWeight: FontWeight.w500),
        bodyLarge: GoogleFonts.inter(color: darkTextPri, letterSpacing: 0.1),
        bodyMedium: GoogleFonts.inter(color: darkTextSec, letterSpacing: 0.1),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: darkSurface,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: darkTextPri),
        titleTextStyle: GoogleFonts.poppins(color: darkTextPri, fontSize: 18, fontWeight: FontWeight.w600),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: const BorderSide(color: primaryColor, width: 1.5),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.grey.shade800)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: primaryColor, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: error, width: 1.5)),
        labelStyle: GoogleFonts.inter(color: darkTextSec),
        hintStyle: GoogleFonts.inter(color: Colors.grey.shade600),
      ),
      cardTheme: CardThemeData(
        color: darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        margin: EdgeInsets.zero,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: darkSurface,
        selectedItemColor: primaryColor,
        unselectedItemColor: darkTextSec,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }
}
