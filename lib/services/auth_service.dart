import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'audit_service.dart';
import 'notification_service.dart';
import 'presence_service.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final AuditService _auditService = AuditService();
  final NotificationService _notificationService = NotificationService();
  final PresenceService _presenceService = PresenceService();

  // Helper to generate a unique email based on student ID (for Firebase Auth)
  String _getAuthEmail(String studentId) {
    return '${studentId.trim().replaceAll(' ', '_')}@scholardoc.local';
  }

  // Sign up student
  Future<UserCredential?> registerStudent({
    required String gmail, // Used for notifications, not login
    required String studentId,
    required Map<String, dynamic> studentData,
  }) async {
    try {
      final String authEmail = _getAuthEmail(studentId);
      final String authPassword = studentId.trim();

      // 1. Create user in Firebase Auth using ID as Password
      UserCredential userCredential = await _auth.createUserWithEmailAndPassword(
        email: authEmail,
        password: authPassword,
      );

      // 2. Save student details to Firestore under 'students' collection
      if (userCredential.user != null) {
        studentData['uid'] = userCredential.user!.uid;
        studentData['authEmail'] = authEmail; // Track the internal auth email
        studentData['createdAt'] = FieldValue.serverTimestamp();
        
        await _firestore
            .collection('students')
            .doc(userCredential.user!.uid)
            .set(studentData);
            
        // Log Activity
        await _auditService.logActivity(
          action: 'Registered new account (ID: $studentId)',
          userName: studentData['fullName'] ?? gmail,
          role: 'Student',
          studentId: studentId,
        );

        // Send Welcome Notification
        await _notificationService.sendNotification(
          studentId: userCredential.user!.uid,
          title: 'Welcome to ScholarDoc!',
          message: 'Your account has been created successfully. Use your Student ID ($studentId) to login next time.',
          type: 'success',
        );
      }

      return userCredential;
    } on FirebaseAuthException {
      rethrow;
    } catch (e) {
      throw Exception('Registration failed: ${e.toString()}');
    }
  }

  // Login student
  Future<UserCredential?> loginStudent({
    required String studentId,
    required String password,
  }) async {
    final String trimmedId = studentId.trim();
    final String trimmedPassword = password.trim();
    final String authEmail = _getAuthEmail(trimmedId);

    UserCredential? userCredential;

    debugPrint('AuthService: Starting login for ID: $trimmedId');
    debugPrint('AuthService: Step 1 - Trying ID-based email: $authEmail');

    // --- Step 1: Try new ID-based email (accounts registered after the update) ---
    try {
      userCredential = await _auth.signInWithEmailAndPassword(
        email: authEmail,
        password: trimmedPassword,
      );
      debugPrint('AuthService: Step 1 SUCCESS (UID: ${userCredential.user?.uid})');
    } on FirebaseAuthException catch (e) {
      debugPrint('AuthService: Step 1 FAILED (${e.code})');
      if (e.code != 'user-not-found' && e.code != 'wrong-password' && e.code != 'invalid-credential') {
        rethrow;
      }
      // Fall through to legacy fallback below
    }

    // --- Step 2: Fallback — look up student by ID in Firestore and try their Gmail ---
    if (userCredential == null) {
      debugPrint('AuthService: Step 2 - Falling back to Firestore lookup');
      try {
        // IMPORTANT: This query will fail if Firestore rules require authentication
        // and the user is currently anonymous. 
        final query = await _firestore
            .collection('students')
            .where('studentId', isEqualTo: trimmedId)
            .limit(1)
            .get();

        if (query.docs.isEmpty) {
          debugPrint('AuthService: Step 2 FAILED - No record found for ID: $trimmedId');
          throw Exception('No account found for Student ID "$trimmedId". Please register first.');
        }

        final data = query.docs.first.data();
        final String? gmail = data['email'] as String?;
        debugPrint('AuthService: Step 2 - Found legacy Gmail: $gmail');

        if (gmail == null || gmail.isEmpty) {
          throw Exception('Account data is incomplete. Please contact your administrator.');
        }

        // Try logging in with the original Gmail + password
        try {
          userCredential = await _auth.signInWithEmailAndPassword(
            email: gmail,
            password: trimmedPassword,
          );
          debugPrint('AuthService: Step 2 SUCCESS (UID: ${userCredential.user?.uid})');
        } on FirebaseAuthException catch (e) {
          debugPrint('AuthService: Step 2 - Login with Gmail FAILED (${e.code})');
          throw Exception('Login failed. Please verify your ID and password.');
        }
      } on FirebaseException catch (e) {
        debugPrint('AuthService: Step 2 - Firestore query FAILED (${e.code}: ${e.message})');
        if (e.code == 'permission-denied') {
          throw Exception('Access denied. This might be due to security rules or App Check enforcement.');
        }
        rethrow;
      }
    }

    // --- Step 3: Verify the user record exists in Firestore students collection ---
    if (userCredential.user != null) {
      final uid = userCredential.user!.uid;
      debugPrint('AuthService: Step 3 - Verifying record for UID: $uid');
      
      try {
        final DocumentSnapshot doc = await _firestore
            .collection('students')
            .doc(uid)
            .get();

        if (!doc.exists) {
          debugPrint('AuthService: Step 3 FAILED - No document for UID: $uid');
          await _auth.signOut();
          throw Exception('Student record not found. Please register first.');
        }

        final studentData = doc.data() as Map<String, dynamic>;
        debugPrint('AuthService: Step 3 SUCCESS - Found student: ${studentData['fullName']}');

        // Log Activity
        await _auditService.logActivity(
          action: 'Logged in using Student ID',
          userName: studentData['fullName'] ?? 'Student',
          role: 'Student',
          studentId: trimmedId,
        );

        // Initialize Presence tracking
        await _presenceService.setUserPresence(uid);
      } on FirebaseException catch (e) {
        debugPrint('AuthService: Step 3 - Firestore fetch FAILED (${e.code}: ${e.message})');
        await _auth.signOut();
        if (e.code == 'permission-denied') {
          throw Exception('Access denied to your profile. Please check App Check or Firestore Rules.');
        }
        rethrow;
      }
    }

    return userCredential;
  }

  // Admin login (Using real Firebase Auth)
  Future<bool> loginAdmin({
    required String username,
    required String password,
  }) async {
    // We transform the username 'Admin' to 'admin@scholardoc.local'
    final String adminEmail = username.toLowerCase() == 'admin' 
        ? 'admin@scholardoc.local' 
        : '${username.toLowerCase()}@scholardoc.local';
    
    debugPrint('AuthService: Attempting Admin Login for $adminEmail');
    
    try {
      // 1. Attempt to sign in
      await _auth.signInWithEmailAndPassword(
        email: adminEmail,
        password: password,
      );
      debugPrint('AuthService: Admin Login SUCCESS');
      
      // 3. Attempt to ensure Admin document exists (Non-blocking, as rules might be restrictive)
      try {
        await _firestore.collection('admins').doc(_auth.currentUser!.uid).set({
          'email': adminEmail,
          'username': username,
          'role': 'Admin',
          'lastLogin': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      } catch (e) {
        debugPrint('AuthService: Note - Admin role doc could not be updated: $e');
      }

      // Log Admin Activity
      await _auditService.logActivity(
        action: 'Logged into Admin Dashboard',
        userName: username,
        role: 'Admin',
      );
      
      return true;
    } on FirebaseAuthException catch (e) {
      debugPrint('AuthService: Admin Login failed (${e.code})');
      
      // 2. If user doesn't exist, create the admin account (Auto-Provisioning)
      if (e.code == 'user-not-found' || e.code == 'invalid-credential') {
        if (username.toLowerCase() == 'admin' && password.length >= 8) {
          debugPrint('AuthService: Auto-provisioning admin account ($adminEmail)...');
          try {
            await _auth.createUserWithEmailAndPassword(
              email: adminEmail,
              password: password,
            );
            
            // 3. Attempt to ensure Admin document exists (Non-blocking)
            try {
              await _firestore.collection('admins').doc(_auth.currentUser!.uid).set({
                'email': adminEmail,
                'username': username,
                'role': 'Admin',
                'lastLogin': FieldValue.serverTimestamp(),
              }, SetOptions(merge: true));
            } catch (e) {
              debugPrint('AuthService: Note - Admin role doc could not be created: $e');
            }

            debugPrint('AuthService: Admin successfully provisioned with Firestore document.');
            
            // Log Admin Activity
            await _auditService.logActivity(
              action: 'Provisioned and Logged into Admin Dashboard',
              userName: username,
              role: 'Admin',
            );
            return true;
          } on FirebaseAuthException catch (createErr) {
            debugPrint('AuthService: Admin Provisioning failed: ${createErr.code}');
            if (createErr.code == 'email-already-in-use') {
              throw Exception('That password is incorrect for this Admin account.');
            }
            throw Exception('Account setup failed: ${createErr.message}');
          } catch (e) {
            debugPrint('AuthService: Unexpected provisioning error: $e');
          }
        } else if (username.toLowerCase() == 'admin' && password.length < 8) {
          throw Exception('The Admin password must be at least 8 characters.');
        }
      }
      
      if (e.code == 'wrong-password' || e.code == 'invalid-credential') {
        throw Exception('Invalid Admin credentials. Please check your username and password.');
      } else if (e.code == 'user-not-found') {
        throw Exception('Admin account not recognized.');
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
    final uid = _auth.currentUser?.uid;
    if (uid != null) {
      await _presenceService.setOffline(uid);
    }
    await _auth.signOut();
  }

  // Get student profile data from Firestore
  Future<DocumentSnapshot> getStudentProfile(String uid) {
    return _firestore.collection('students').doc(uid).get();
  }

  // Get stream of student profile data for real-time tracking
  Stream<DocumentSnapshot> getStudentStream(String uid) {
    return _firestore.collection('students').doc(uid).snapshots();
  }

  // Update student profile data
  Future<void> updateStudentProfile(String uid, Map<String, dynamic> updates) async {
    await _firestore.collection('students').doc(uid).update(updates);
    
    // Log Activity
    await _auditService.logActivity(
      action: 'Updated profile information',
      userName: updates['fullName'] ?? 'Student',
      role: 'Student',
    );
  }

  // Get stream of all students for Admin
  Stream<QuerySnapshot> getStudentsStream() {
    return _firestore
        .collection('students')
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  // Get stream of all activity logs for Admin
  Stream<QuerySnapshot> getAuditLogsStream() {
    return _firestore
        .collection('audit_logs')
        .orderBy('timestamp', descending: true)
        .snapshots();
  }

  User? get currentUser => _auth.currentUser;

  // Data Migration: Set default values for new registration fields
  Future<int> migrateRegistrationFields() async {
    int updatedCount = 0;
    try {
      final students = await _firestore.collection('students').get();
      
      for (var doc in students.docs) {
        final data = doc.data();
        bool needsUpdate = false;
        Map<String, dynamic> updates = {};

        // 1. Gender heuristic
        if (data['gender'] == null || data['gender'].toString().isEmpty || data['gender'] == 'N/A') {
          String fullName = (data['fullName'] ?? '').toString().trim().toLowerCase();
          String firstName = fullName.split(' ').first;
          String gender = 'Male'; // Default
          
          // Heuristic: common female name patterns
          final femaleEndings = ['a', 'e', 'i', 'y', 'ah', 'ie', 'elle', 'ina'];
          if (femaleEndings.any((ending) => firstName.endsWith(ending)) || 
              firstName.contains('mary') || 
              firstName.contains('maria') ||
              firstName.contains('princess') ||
              firstName.contains('angel')) {
            gender = 'Female';
          }
          
          updates['gender'] = gender;
          needsUpdate = true;
        }

        // 2. Scholar Year Level
        if (data['scholarYearLevel'] == null || data['scholarYearLevel'] == 'N/A') {
          updates['scholarYearLevel'] = data['year'] ?? '1st Year';
          needsUpdate = true;
        }

        // 3. Payouts Received
        if (data['payoutsReceived'] == null) {
          int p = 0;
          String yl = updates['scholarYearLevel'] ?? data['scholarYearLevel'] ?? '1st Year';
          if (yl.contains('2nd')) p = 1;
          else if (yl.contains('3rd')) p = 2;
          else if (yl.contains('4th') || yl.contains('5th')) p = 3;
          updates['payoutsReceived'] = p;
          needsUpdate = true;
        }

        // 4. Parents Edu Status
        Map<String, dynamic> family = Map<String, dynamic>.from(data['familyDetails'] ?? {});
        bool familyNeedsUpdate = false;
        
        if (family['fatherEduStatus'] == null || family['fatherEduStatus'] == 'N/A') {
          family['fatherEduStatus'] = 'Non-graduate';
          familyNeedsUpdate = true;
        }
        
        if (family['motherEduStatus'] == null || family['motherEduStatus'] == 'N/A') {
          family['motherEduStatus'] = 'Non-graduate';
          familyNeedsUpdate = true;
        }
        
        if (familyNeedsUpdate) {
          updates['familyDetails'] = family;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await doc.reference.update(updates);
          updatedCount++;
        }
      }
      return updatedCount;
    } catch (e) {
      debugPrint('Migration Error: $e');
      rethrow;
    }
  }

  // Repair Tool: Find students with STUFAH and update to STUFAP
  Future<int> fixStudentScholarshipTypo() async {
    int updatedCount = 0;
    try {
      final snapshot = await _firestore
          .collection('students')
          .where('scholarshipName', isEqualTo: 'STUFAH')
          .get();
      
      for (var doc in snapshot.docs) {
        await doc.reference.update({'scholarshipName': 'STUFAP'});
        updatedCount++;
      }
    } catch (e) {
      debugPrint('AuthService: Error fixing student scholarship typo: $e');
    }
    return updatedCount;
  }


  // Batch update/create students from CSV
  Future<void> batchUpdateStudents(List<Map<String, dynamic>> studentsData) async {
    if (studentsData.isEmpty) return;

    final WriteBatch batch = _firestore.batch();
    
    for (final data in studentsData) {
      final uid = data['uid'];
      if (uid != null && uid.toString().isNotEmpty) {
        // Update existing
        final docRef = _firestore.collection('students').doc(uid);
        // Remove internal flags before saving
        data.remove('isUpdated');
        batch.update(docRef, data);
      } else {
        // Create new
        final docRef = _firestore.collection('students').doc();
        data['uid'] = docRef.id;
        data['createdAt'] = FieldValue.serverTimestamp();
        data['status'] = data['status'] ?? 'Pending';
        data.remove('isUpdated');
        batch.set(docRef, data);
      }
    }

    await batch.commit();

    await _auditService.logActivity(
      action: 'Auto-filled / Updated  student records via CSV Import',
      userName: 'Admin',
      role: 'Admin',
    );
  }
}
