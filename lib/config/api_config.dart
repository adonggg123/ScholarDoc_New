import 'package:flutter/foundation.dart';

/// Centralized API and Backend configuration for ScholarDoc.
/// Automatically handles routing between local development and production Vercel deployment.
class ApiConfig {
  ApiConfig._();

  /// Default production URL for ScholarDoc on Vercel.
  /// Can be overridden at build time via:
  /// `flutter build apk --dart-define=API_URL=https://scholar-doc-new.vercel.app`
  static const String defaultProductionUrl = 'https://scholar-doc-new.vercel.app';

  /// Optional override passed via compiler flag: --dart-define=API_URL=...
  static const String _envUrl = String.fromEnvironment('API_URL', defaultValue: '');

  /// Resolves the active backend base URL:
  /// - Web: '' (relative paths)
  /// - Custom compiler flag: uses provided URL
  /// - Release APK on physical devices: uses [defaultProductionUrl]
  /// - Android Debug emulator: http://10.0.2.2:8080
  /// - Other debug targets: http://localhost:8080
  static String get baseUrl {
    if (kIsWeb) return '';

    if (_envUrl.trim().isNotEmpty) {
      final trimmed = _envUrl.trim();
      return trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
    }

    if (kReleaseMode) {
      return defaultProductionUrl;
    }

    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        return 'http://10.0.2.2:8080';
      }
    } catch (_) {}

    return 'http://localhost:8080';
  }
}
