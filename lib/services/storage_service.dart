import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

class StorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;

  /// Uploads a file to Firebase Storage and returns the download URL.
  /// [path] is the destination path in the bucket (e.g., 'submissions/uid/filename.pdf').
  /// [file] is the File object to upload.
  Future<String> uploadFile({
    required String path,
    required Uint8List bytes,
  }) async {
    try {
      _storage.setMaxUploadRetryTime(const Duration(seconds: 15));
      final Reference ref = _storage.ref().child(path);
      
      // Specify content type if possible
      final SettableMetadata metadata = SettableMetadata(
        contentType: path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      );

      TaskSnapshot? snapshot;
      int maxRetries = 3;
      
      for (int i = 0; i < maxRetries; i++) {
        try {
          final UploadTask uploadTask = ref.putData(bytes, metadata);
          snapshot = await uploadTask;
          break; // Upload succeeded
        } catch (e) {
          if (i == maxRetries - 1) rethrow; // If last attempt fails, throw
          await Future.delayed(const Duration(seconds: 2)); // Wait before retrying
        }
      }

      if (snapshot == null) {
        throw Exception("Upload failed after multiple attempts.");
      }
      
      String downloadUrl = '';
      try {
        downloadUrl = await snapshot.ref.getDownloadURL();
      } catch (e) {
        if (e.toString().contains('object-not-found')) {
          // Retry after a short delay to allow Firebase Storage to finalize
          await Future.delayed(const Duration(milliseconds: 800));
          downloadUrl = await snapshot.ref.getDownloadURL();
        } else {
          rethrow;
        }
      }
      
      return downloadUrl;
    } on FirebaseException catch (e) {
      debugPrint('Firebase Storage Error: ${e.message}');
      throw Exception(e.message ?? 'Unknown Storage Error');
    } catch (e) {
      debugPrint('Error uploading file: $e');
      throw Exception(e.toString());
    }
  }

  /// Deletes a file from Firebase Storage given its path.
  Future<bool> deleteFile(String path) async {
    try {
      await _storage.ref().child(path).delete();
      return true;
    } catch (e) {
      debugPrint('Error deleting file: $e');
      return false;
    }
  }
}
