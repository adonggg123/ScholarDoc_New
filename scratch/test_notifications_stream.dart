import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  print('Initializing Supabase...');
  try {
    await Supabase.initialize(
      url: 'https://ywavesulvkqwpsejprxp.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk',
    );
  } catch (e) {
    print('Initialization failed: $e');
    return;
  }

  final client = Supabase.instance.client;
  final targetStudentId = '2f48f582-c769-45a4-af84-d6d683bc4c18';

  print('Listening to stream of notifications for student $targetStudentId...');
  final subscription = client
      .from('notifications')
      .stream(primaryKey: ['id'])
      .eq('studentId', targetStudentId)
      .listen((data) {
        print('Stream fired! Number of notifications: ${data.length}');
        for (var n in data) {
          print(' - Title: ${n['title']}, isRead: ${n['isRead']}');
        }
      }, onError: (err) {
        print('Stream error: $err');
      });

  print('Waiting 5 seconds before inserting a test notification...');
  await Future.delayed(Duration(seconds: 5));

  print('Inserting new notification...');
  try {
    await client.from('notifications').insert({
      'studentId': targetStudentId,
      'title': 'Realtime Test Notification',
      'message': 'This is a test message to verify if the stream fires in real time.',
      'type': 'info',
      'isRead': false,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    });
    print('Notification inserted successfully!');
  } catch (e) {
    print('Failed to insert notification: $e');
  }

  print('Waiting 5 seconds to see if stream gets the new insert...');
  await Future.delayed(Duration(seconds: 5));

  await subscription.cancel();
  print('Done.');
}
