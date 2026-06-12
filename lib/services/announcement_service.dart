import 'package:supabase_flutter/supabase_flutter.dart';

class Announcement {
  final String id;
  final String title;
  final String content;
  final String type; // 'Deadline', 'Update', 'General'
  final DateTime createdAt;
  final bool isActive;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.createdAt,
    required this.isActive,
  });

  factory Announcement.fromMap(Map<String, dynamic> data) {
    return Announcement(
      id: data['id']?.toString() ?? '',
      title: data['title'] ?? '',
      content: data['content'] ?? '',
      type: data['type'] ?? 'General',
      createdAt: data['createdAt'] != null 
          ? DateTime.parse(data['createdAt'].toString()) 
          : DateTime.now(),
      isActive: data['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'title': title,
      'content': content,
      'type': type,
      // 'createdAt' is typically set by the DB
      'isActive': isActive,
    };
  }
}

class AnnouncementService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Stream<List<Announcement>> getActiveAnnouncements() {
    return _supabase
        .from('announcements')
        .stream(primaryKey: ['id'])
        .eq('isActive', true)
        .order('createdAt', ascending: false)
        .map((data) => data.map((doc) => Announcement.fromMap(doc)).toList());
  }

  // Get all announcements
  Stream<List<Announcement>> getAllAnnouncements() {
    return _supabase
        .from('announcements')
        .stream(primaryKey: ['id'])
        .order('createdAt', ascending: false)
        .map((data) => data.map((doc) => Announcement.fromMap(doc)).toList());
  }

  // Add an announcement
  Future<void> postAnnouncement(Announcement announcement) async {
    await _supabase.from('announcements').insert(announcement.toMap());
  }

  // Update an announcement
  Future<void> updateAnnouncement(String id, Map<String, dynamic> updates) async {
    await _supabase.from('announcements').update(updates).eq('id', id);
  }

  // Archive an announcement
  Future<void> archiveAnnouncement(String id) async {
    await _supabase.from('announcements').update({'isActive': false}).eq('id', id);
  }

  // Delete an announcement
  Future<void> deleteAnnouncement(String id) async {
    await _supabase.from('announcements').delete().eq('id', id);
  }
}
