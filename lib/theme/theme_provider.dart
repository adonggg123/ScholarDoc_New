import 'package:flutter/material.dart';

class ThemeProvider {
  static final ThemeProvider _instance = ThemeProvider._internal();
  factory ThemeProvider() => _instance;
  ThemeProvider._internal();

  final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.light);

  bool get isDarkMode => themeNotifier.value == ThemeMode.dark;

  void toggleTheme() {
    themeNotifier.value = isDarkMode ? ThemeMode.light : ThemeMode.dark;
  }
}

extension ThemeColorsExt on BuildContext {
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  
  Color get surfaceC => Theme.of(this).colorScheme.surface;
  Color get bgC => Theme.of(this).scaffoldBackgroundColor;
  Color get textPri => Theme.of(this).colorScheme.onSurface;
  Color get textSec => Theme.of(this).colorScheme.onSurfaceVariant;
  Color get glassBorder => isDark ? Colors.white.withOpacity(0.1) : Colors.white.withOpacity(0.2);
  Color get crispBorder => isDark ? const Color(0xFF334155) : Colors.grey.shade200;

  BoxDecoration get glassDecoration {
    return BoxDecoration(
      color: isDark ? Colors.white.withOpacity(0.05) : Colors.white.withOpacity(0.7),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: glassBorder),
    );
  }

  BoxDecoration get crispDecoration {
    return BoxDecoration(
      color: surfaceC,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: crispBorder, width: 1.5),
      boxShadow: [
        BoxShadow(color: Colors.black.withOpacity(isDark ? 0.2 : 0.03), offset: const Offset(0, 2), blurRadius: 4),
      ],
    );
  }
}
