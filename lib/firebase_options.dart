// File: lib/firebase_options.dart
// Generated Firebase options for ScholarDoc based on google-services.json
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E',
    appId: '1:583511512301:web:864abfadf26d9f98dd28e4',
    messagingSenderId: '583511512301',
    projectId: 'scholardoc-40e03',
    storageBucket: 'scholardoc-40e03.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E',
    appId: '1:583511512301:android:8b768cedf256c9c8dd28e4',
    messagingSenderId: '583511512301',
    projectId: 'scholardoc-40e03',
    storageBucket: 'scholardoc-40e03.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E',
    appId: '1:583511512301:ios:23db6bd502fc4d92dd28e4',
    messagingSenderId: '583511512301',
    projectId: 'scholardoc-40e03',
    storageBucket: 'scholardoc-40e03.firebasestorage.app',
  );
}
