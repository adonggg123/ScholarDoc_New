import 'package:flutter/foundation.dart';

/// Centralized API and Backend configuration for ScholarDoc.
/// Automatically handles routing between local development and production deployment.
class ApiConfig {
  ApiConfig._();

  /// Default production URL for ScholarDoc on Vercel.
  /// Can be overridden at build time via:
  /// `flutter build apk --dart-define=API_URL=https://scholar-doc-new.vercel.app`
  static const String defaultProductionUrl = 'https://scholar-doc-new.vercel.app';

  /// Optional override passed via compiler flag: --dart-define=API_URL=...
  static const String _envUrl = String.fromEnvironment('API_URL', defaultValue: '');

  static String? _workingBaseUrl;

  /// Returns candidate URLs in priority order for the current platform:
  /// - Release APK on physical devices: uses [defaultProductionUrl]
  /// - Android debug (Physical device via adb reverse): http://127.0.0.1:8080
  /// - Android debug (Emulator): http://10.0.2.2:8080
  /// - Android debug (Host Wi-Fi LAN): http://192.168.8.124:8080
  /// - Web: '' (relative paths)
  /// - Desktop / iOS Simulator: http://localhost:8080
  static List<String> get candidateUrls {
    if (kIsWeb) return [''];

    if (_envUrl.trim().isNotEmpty) {
      final trimmed = _envUrl.trim();
      return [trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed];
    }

    if (kReleaseMode) {
      return [defaultProductionUrl];
    }

    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        return [
          'http://127.0.0.1:8080',     // Physical device via adb reverse tcp:8080 tcp:8080
          'http://10.0.2.2:8080',      // Android Emulator loopback
          'http://192.168.8.124:8080', // Host PC Wi-Fi LAN IP
          'http://localhost:8080',
        ];
      }
    } catch (_) {}

    return [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://192.168.8.124:8080',
    ];
  }

  /// Resolves the active backend base URL.
  static String get baseUrl {
    if (_workingBaseUrl != null) return _workingBaseUrl!;
    final list = candidateUrls;
    return list.isNotEmpty ? list.first : 'http://localhost:8080';
  }

  /// Caches a confirmed responsive URL so subsequent calls connect instantly without probing.
  static void setWorkingBaseUrl(String url) {
    final trimmed = url.trim();
    _workingBaseUrl = trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
  }
}

