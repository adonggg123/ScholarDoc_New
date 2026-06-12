import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class PresenceService {
  final SupabaseClient _supabase = Supabase.instance.client;
  RealtimeChannel? _presenceChannel;

  // Track user presence
  Future<void> setUserPresence(String uid) async {
    try {
      // 1. Update database directly first to show online immediately
      await _updateDatabasePresence(uid, true);

      // 2. Set up Supabase Realtime Presence
      _presenceChannel = _supabase.channel('online-users');
      
      _presenceChannel!
          .onPresenceSync((payload) {
            // Can be used to sync list of online users locally
          })
          .subscribe((status, [error]) async {
            if (status == 'SUBSCRIBED') {
              await _presenceChannel!.track({'user_id': uid});
            }
          });
    } catch (e) {
      debugPrint('Error in PresenceService: $e');
    }
  }

  Future<void> _updateDatabasePresence(String uid, bool isOnline) async {
    try {
      await _supabase.from('students').update({
        'isOnline': isOnline,
        'lastSeen': DateTime.now().toIso8601String(),
      }).eq('uid', uid);
    } catch (e) {
      debugPrint('Error updating presence DB: $e');
    }
  }

  // Clear presence on logout
  Future<void> setOffline(String uid) async {
    try {
      if (_presenceChannel != null) {
        await _presenceChannel!.untrack();
        await _supabase.removeChannel(_presenceChannel!);
        _presenceChannel = null;
      }
      await _updateDatabasePresence(uid, false);
    } catch (e) {
      debugPrint('Error setting offline: $e');
    }
  }
}
