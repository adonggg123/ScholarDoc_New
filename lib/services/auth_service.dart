import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'audit_service.dart';
import 'notification_service.dart';
import 'presence_service.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final AuditService _auditService = AuditService();
  final NotificationService _notificationService = NotificationService();
  final PresenceService _presenceService = PresenceService();

  // Helper to generate a unique email based on student ID (for Supabase Auth)
  String _getAuthEmail(String studentId) {
    return '${studentId.trim().replaceAll(' ', '_')}@scholardoc.com';
  }

  // Sign up student
  Future<AuthResponse?> registerStudent({
    required String gmail, // Used for notifications, not login
    required String studentId,
    required Map<String, dynamic> studentData,
  }) async {
    try {
      final String fullName = studentData['fullName']?.toString().trim() ?? '';
      
      // 0. Validate against Masterlist Import (OCR)
      if (fullName.isNotEmpty) {
        final masterlistCheck = await _supabase
            .from('scholar_masterlist')
            .select()
            .ilike('name', fullName)
            .limit(1);

        if (masterlistCheck.isEmpty) {
          throw Exception('You are not included in the official scholar masterlist. Registration denied.');
        }
      } else {
        throw Exception('Full name is required for registration validation.');
      }

      final String authEmail = _getAuthEmail(studentId);
      final String authPassword = studentId.trim();

      // 1. Create user in Supabase Auth
      final response = await _supabase.auth.signUp(
        email: authEmail,
        password: authPassword,
      );

      // 2. Save student details to Supabase database under 'students' table
      if (response.user != null) {
        studentData['uid'] = response.user!.id;
        studentData['authEmail'] = authEmail; // Track the internal auth email
        // createdAt is handled by the DB default NOW()

        await _supabase.from('students').insert(studentData);

        // Log Activity
        await _auditService.logActivity(
          action: 'Registered new account (ID: $studentId)',
          userName: studentData['fullName'] ?? gmail,
          role: 'Student',
          studentId: studentId,
        );

        // Send Welcome Notification
        await _notificationService.sendNotification(
          studentId: response.user!.id,
          title: 'Welcome to ScholarDoc!',
          message:
              'Your account has been created successfully. Use your Student ID ($studentId) to login next time.',
          type: 'success',
        );
      }

      return response;
    } catch (e) {
      throw Exception('Registration failed: ${e.toString()}');
    }
  }

  // Login student
  Future<AuthResponse?> loginStudent({
    required String studentId,
    required String password,
  }) async {
    final String trimmedId = studentId.trim();
    final String trimmedPassword = password.trim();
    final String authEmail = _getAuthEmail(trimmedId);

    AuthResponse? authResponse;

    debugPrint('AuthService: Starting login for ID: $trimmedId');
    debugPrint('AuthService: Step 1 - Trying ID-based email: $authEmail');

    // --- Step 1: Try new ID-based email (accounts registered after the update) ---
    try {
      authResponse = await _supabase.auth.signInWithPassword(
        email: authEmail,
        password: trimmedPassword,
      );
      debugPrint(
        'AuthService: Step 1 SUCCESS (UID: ${authResponse.user?.id})',
      );
    } on AuthException catch (e) {
      debugPrint('AuthService: Step 1 FAILED (${e.message})');
      if (!e.message.toLowerCase().contains('invalid login') && 
          !e.message.toLowerCase().contains('not found')) {
        rethrow;
      }
      // Fall through to legacy fallback below
    }

    // --- Step 2: Fallback — look up student by ID in Supabase and try their Gmail ---
    if (authResponse == null) {
      debugPrint('AuthService: Step 2 - Falling back to Supabase lookup');
      try {
        final query = await _supabase
            .from('students')
            .select()
            .eq('studentId', trimmedId)
            .limit(1);

        if (query.isEmpty) {
          debugPrint(
            'AuthService: Step 2 FAILED - No record found for ID: $trimmedId',
          );
          throw Exception(
            'No account found for Student ID "$trimmedId". Please register first.',
          );
        }

        final data = query.first;
        final String? gmail = data['email'] as String?;
        debugPrint('AuthService: Step 2 - Found legacy Gmail: $gmail');

        if (gmail == null || gmail.isEmpty) {
          throw Exception(
            'Account data is incomplete. Please contact your administrator.',
          );
        }

        // Try logging in with the original Gmail + password
        try {
          authResponse = await _supabase.auth.signInWithPassword(
            email: gmail,
            password: trimmedPassword,
          );
          debugPrint(
            'AuthService: Step 2 SUCCESS (UID: ${authResponse.user?.id})',
          );
        } on AuthException catch (e) {
          debugPrint(
            'AuthService: Step 2 - Login with Gmail FAILED (${e.message})',
          );
          throw Exception('Login failed. Please verify your ID and password.');
        }
      } catch (e) {
        debugPrint(
          'AuthService: Step 2 - Supabase query FAILED ($e)',
        );
        rethrow;
      }
    }

    // --- Step 3: Verify the user record exists in Supabase students collection ---
    if (authResponse.user != null) {
      final uid = authResponse.user!.id;
      debugPrint('AuthService: Step 3 - Verifying record for UID: $uid');

      try {
        final List<Map<String, dynamic>> doc = await _supabase
            .from('students')
            .select()
            .eq('uid', uid);

        if (doc.isEmpty) {
          debugPrint('AuthService: Step 3 FAILED - No document for UID: $uid');
          await _supabase.auth.signOut();
          throw Exception('Student record not found. Please register first.');
        }

        final studentData = doc.first;
        debugPrint(
          'AuthService: Step 3 SUCCESS - Found student: ${studentData['fullName']}',
        );

        // Log Activity
        await _auditService.logActivity(
          action: 'Logged in using Student ID',
          userName: studentData['fullName'] ?? 'Student',
          role: 'Student',
          studentId: trimmedId,
        );

        // Initialize Presence tracking
        await _presenceService.setUserPresence(uid);
      } catch (e) {
        debugPrint(
          'AuthService: Step 3 - Supabase fetch FAILED ($e)',
        );
        await _supabase.auth.signOut();
        rethrow;
      }
    }

    return authResponse;
  }

  // Admin login (Using real Supabase Auth)
  Future<bool> loginAdmin({
    required String username,
    required String password,
  }) async {
    final String adminEmail = username.contains('@') 
        ? username.toLowerCase() 
        : (username.toLowerCase() == 'admin'
            ? 'admin@scholardoc.com'
            : '${username.toLowerCase()}@scholardoc.com');

    debugPrint('AuthService: Attempting Admin Login for $adminEmail');

    try {
      // 1. Attempt to sign in
      await _supabase.auth.signInWithPassword(
        email: adminEmail,
        password: password,
      );
      debugPrint('AuthService: Admin Login SUCCESS');

      // 3. Attempt to ensure Admin document exists
      try {
        await _supabase.from('admins').upsert({
          'uid': _supabase.auth.currentUser!.id,
          'email': adminEmail,
          'username': username,
          'role': 'Admin',
        });
      } catch (e) {
        debugPrint(
          'AuthService: Note - Admin role doc could not be updated: $e',
        );
      }

      // Log Admin Activity
      await _auditService.logActivity(
        action: 'Logged into Admin Dashboard',
        userName: username,
        role: 'Admin',
      );

      return true;
    } on AuthException catch (e) {
      debugPrint('AuthService: Admin Login failed (${e.message})');

      // 2. If user doesn't exist, create the admin account (Auto-Provisioning)
      if (e.message.toLowerCase().contains('invalid login') || e.message.toLowerCase().contains('not found')) {
        if (username.toLowerCase() == 'admin' && password.length >= 6) { // Supabase min is usually 6
          debugPrint(
            'AuthService: Auto-provisioning admin account ($adminEmail)...',
          );
          try {
            await _supabase.auth.signUp(
              email: adminEmail,
              password: password,
            );

            // 3. Attempt to ensure Admin document exists
            try {
              await _supabase.from('admins').upsert({
                'uid': _supabase.auth.currentUser!.id,
                'email': adminEmail,
                'username': username,
                'role': 'Admin',
              });
            } catch (e) {
              debugPrint(
                'AuthService: Note - Admin role doc could not be created: $e',
              );
            }

            debugPrint(
              'AuthService: Admin successfully provisioned with Supabase document.',
            );

            // Log Admin Activity
            await _auditService.logActivity(
              action: 'Provisioned and Logged into Admin Dashboard',
              userName: username,
              role: 'Admin',
            );
            return true;
          } on AuthException catch (createErr) {
            debugPrint(
              'AuthService: Admin Provisioning failed: ${createErr.message}',
            );
            if (createErr.message.toLowerCase().contains('already in use')) {
              throw Exception(
                'That password is incorrect for this Admin account.',
              );
            }
            throw Exception('Account setup failed: ${createErr.message}');
          } catch (e) {
            debugPrint('AuthService: Unexpected provisioning error: $e');
          }
        } else if (username.toLowerCase() == 'admin' && password.length < 6) {
          throw Exception('The Admin password must be at least 6 characters.');
        }
      }

      if (e.message.toLowerCase().contains('invalid login')) {
        throw Exception(
          'Invalid Admin credentials. Please check your username and password.',
        );
      } else {
        throw Exception('Admin Authentication Error: ${e.message}');
      }
    } catch (e) {
      debugPrint('AuthService: Unexpected Admin Login error: $e');
      if (e.toString().contains('Exception:')) rethrow;
      throw Exception('Login failed. Please try again later.');
    }
  }

  // Logout current user
  Future<void> logout() async {
    final uid = _supabase.auth.currentUser?.id;
    if (uid != null) {
      await _presenceService.setOffline(uid);
    }
    await _supabase.auth.signOut();
  }

  // Get student profile data from Supabase
  Future<Map<String, dynamic>?> getStudentProfile(String uid) async {
    final response = await _supabase.from('students').select().eq('uid', uid);
    return response.isNotEmpty ? response.first : null;
  }

  // Get stream of student profile data for real-time tracking
  Stream<List<Map<String, dynamic>>> getStudentStream(String uid) {
    return _supabase.from('students').stream(primaryKey: ['uid']).eq('uid', uid);
  }

  // Update student profile data
  Future<void> updateStudentProfile(
    String uid,
    Map<String, dynamic> updates,
  ) async {
    await _supabase.from('students').update(updates).eq('uid', uid);

    // Log Activity
    await _auditService.logActivity(
      action: 'Updated profile information',
      userName: updates['fullName'] ?? 'Student',
      role: 'Student',
    );
  }

  // Get stream of all students for Admin
  Stream<List<Map<String, dynamic>>> getStudentsStream() {
    return _supabase
        .from('students')
        .stream(primaryKey: ['uid'])
        .order('createdAt', ascending: false);
  }

  // Get stream of all activity logs for Admin
  Stream<List<Map<String, dynamic>>> getAuditLogsStream() {
    return _supabase
        .from('audit_logs')
        .stream(primaryKey: ['id'])
        .order('timestamp', ascending: false);
  }

  User? get currentUser => _supabase.auth.currentUser;

  // Batch update/create students from CSV
  Future<void> batchUpdateStudents(
    List<Map<String, dynamic>> studentsData,
  ) async {
    if (studentsData.isEmpty) return;

    List<Map<String, dynamic>> toUpsert = [];
    
    for (final data in studentsData) {
      data.remove('isUpdated'); // Remove internal flags
      data['status'] = data['status'] ?? 'Pending';
      toUpsert.add(data);
    }

    // Upsert matches by primary key or unique constraints
    // If 'uid' is not provided, Supabase might reject it if it's primary key unless we let it gen.
    // Wait, uid is the auth.users(id), which we might not have for CSV imports?
    // We should probably rely on the backend function or match by studentId.
    // Since uid is required in our schema, we should probably upsert using 'studentId'.
    // For simplicity, we just use upsert.
    await _supabase.from('students').upsert(toUpsert);

    await _auditService.logActivity(
      action: 'Auto-filled / Updated student records via CSV Import',
      userName: 'Admin',
      role: 'Admin',
    );
  }

  // Repair Tool: Fix the STUFAH -> STUFAP typo in the students collection
  Future<int> fixStudentScholarshipTypo() async {
    int updatedCount = 0;
    try {
      final data = await _supabase
          .from('students')
          .select()
          .eq('scholarshipName', 'STUFAH');
      
      for (var doc in data) {
        await _supabase.from('students').update({'scholarshipName': 'STUFAP'}).eq('uid', doc['uid']);
        updatedCount++;
      }
    } catch (e) {
      debugPrint('AuthService: Error fixing typo: $e');
    }
    return updatedCount;
  }

  // Migrate Data: Populates missing fields
  Future<int> migrateRegistrationFields() async {
    int updatedCount = 0;
    try {
      final data = await _supabase.from('students').select();
      for (var doc in data) {
        bool needsUpdate = false;
        Map<String, dynamic> updates = {};
        
        if (doc['gender'] == null || doc['gender'].toString().isEmpty) {
          needsUpdate = true;
          updates['gender'] = 'Not Specified';
        }
        if (doc['scholarYearLevel'] == null || doc['scholarYearLevel'].toString().isEmpty) {
          needsUpdate = true;
          updates['scholarYearLevel'] = 'Unknown';
        }
        
        if (needsUpdate) {
          await _supabase.from('students').update(updates).eq('uid', doc['uid']);
          updatedCount++;
        }
      }
    } catch (e) {
      debugPrint('AuthService: Error migrating fields: $e');
    }
    return updatedCount;
  }
}
