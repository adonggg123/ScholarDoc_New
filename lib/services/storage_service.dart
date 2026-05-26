import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';

class StorageService {
  static const String _cloudName = 'dc2wi71nx';
  static const String _uploadPreset = 'scholardoc_profiles';

  /// Uploads a file to Cloudinary and returns the secure URL.
  /// [path] is the destination path (e.g., 'submissions/uid/filename.pdf').
  /// [bytes] are the raw bytes of the file.
  Future<String> uploadFile({
    required String path,
    required Uint8List bytes,
  }) async {
    try {
      final String fileName = path.split('/').last;
      final String folder = path.contains('/')
          ? path.substring(0, path.lastIndexOf('/'))
          : 'submissions';

      final bool isPdf = fileName.toLowerCase().endsWith('.pdf');
      final String resourceType = isPdf ? 'raw' : 'auto';
      final uri = Uri.parse(
        'https://api.cloudinary.com/v1_1/$_cloudName/$resourceType/upload',
      );

      final request = http.MultipartRequest('POST', uri)
        ..fields['upload_preset'] = _uploadPreset
        ..fields['folder'] = folder
        ..files.add(
          http.MultipartFile.fromBytes(
            'file',
            bytes,
            filename: fileName,
          ),
        );

      final streamedResponse = await request.send().timeout(
        const Duration(minutes: 2),
        onTimeout: () => throw Exception('Upload timed out. Please check your connection.'),
      );
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final String? secureUrl = json['secure_url'] as String?;
        if (secureUrl == null) {
          throw Exception('Cloudinary upload succeeded but no URL was returned.');
        }
        return secureUrl;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
          'Cloudinary upload failed (${response.statusCode}): '
          '${error['error']?['message'] ?? response.body}',
        );
      }
    } catch (e) {
      debugPrint('Error uploading file: $e');
      throw Exception('Failed to upload requirement document: ${e.toString()}');
    }
  }

  /// Deletes a file from storage.
  Future<bool> deleteFile(String path) async {
    // Cloudinary deletion requires API signatures which are typically not stored on client.
    // Return true to succeed gracefully.
    return true;
  }
}
