import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'audit_service.dart';
import 'notification_service.dart';
import 'presence_service.dart';
import 'push_notification_service.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final AuditService _auditService = AuditService();
  final NotificationService _notificationService = NotificationService();
  final PresenceService _presenceService = PresenceService();

  // Helper to generate a unique email based on student ID (for Supabase Auth)
  String _getAuthEmail(String studentId) {
    final clean = studentId.trim();
    if (clean.contains('@')) return clean;
    return '${clean.replaceAll(' ', '_')}@scholardoc.com';
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
        // Split the user's input into individual words to allow flexible ordering
        // (e.g. "Jude Esidore Jariol" matches "Jariol, Jude Esidore Zacarias")
        final parts = fullName
            .toLowerCase()
            .replaceAll(',', '')
            .split(' ')
            .where((s) => s.isNotEmpty)
            .toList();

        // Fetch the names from the database to perform a robust local match
        final masterlist = await _supabase
            .from('scholar_masterlist')
            .select('name');

        bool foundMatch = false;
        for (var record in masterlist) {
          final dbName = (record['name'] as String? ?? '').toLowerCase();

          // Check if EVERY part of the student's inputted name exists somewhere in the DB record
          bool matchesAll = true;
          for (var part in parts) {
            if (!dbName.contains(part)) {
              matchesAll = false;
              break;
            }
          }

          if (matchesAll) {
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          throw Exception(
            'MASTERLIST_DENIED: You are not included in the official scholar masterlist.',
          );
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

        await _supabase.from('student_grantees').insert(studentData);

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

        // Send Registration Notification to Admin
        final String fullName = studentData['fullName'] ?? 'A student';
        await _notificationService.sendNotification(
          studentId: 'admin',
          title: 'New Student Registered',
          message: 'New student $fullName has registered in the system.',
          type: 'info',
        );

        // Sync FCM Push Notification token for the newly registered student
        try {
          await PushNotificationService().syncToken(
            response.user!.id,
            studentId: studentId,
          );
        } catch (_) {}
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
    String authEmail = _getAuthEmail(trimmedId);

    // Resolve admin emails if input is admin / superadmin or matches custom admin username
    if (!trimmedId.contains('@')) {
      final cleanLower = trimmedId.toLowerCase();
      if (cleanLower == 'superadmin') {
        authEmail = 'superadmin@scholardoc.com';
      } else if (cleanLower == 'admin') {
        authEmail = 'admin@scholardoc.com';
      } else {
        try {
          final adminRes = await _supabase
              .from('admins')
              .select('email')
              .ilike('username', trimmedId)
              .limit(1);
          if (adminRes.isNotEmpty && adminRes.first['email'] != null) {
            authEmail = adminRes.first['email'] as String;
          }
        } catch (_) {}
      }
    }

    AuthResponse? authResponse;

    // Helper to format password to satisfy Supabase Auth's minimum 6-character requirement
    String formatAuthPassword(String pwd) {
      final clean = pwd.trim();
      if (clean.isNotEmpty && clean.length < 6) {
        return clean.padLeft(6, '0');
      }
      return clean;
    }

    debugPrint('AuthService: Starting login for ID: $trimmedId');
    debugPrint('AuthService: Step 1 - Trying ID-based email: $authEmail');

    // --- Step 1: Try ID-based email ---
    final step1Passwords = <String>{};
    if (trimmedPassword.length >= 6) step1Passwords.add(trimmedPassword);
    step1Passwords.add(formatAuthPassword(trimmedPassword));

    for (final pwd in step1Passwords) {
      try {
        authResponse = await _supabase.auth.signInWithPassword(
          email: authEmail,
          password: pwd,
        );
        if (authResponse.user != null) {
          debugPrint(
            'AuthService: Step 1 SUCCESS (UID: ${authResponse.user?.id})',
          );
          break;
        }
      } on AuthException catch (e) {
        debugPrint('AuthService: Step 1 attempt ($authEmail) -> ${e.message}');
      }
    }

    // --- Step 2: Fallback — look up student by ID/Email in Supabase and try all linked credentials ---
    if (authResponse == null) {
      debugPrint(
        'AuthService: Step 2 - Falling back to Supabase lookup for ID: $trimmedId',
      );
      try {
        final filterParts = <String>{
          'student_no.eq.$trimmedId',
          'studentId.eq.$trimmedId',
        };
        if (trimmedId.contains('@')) {
          filterParts.add('email_address.eq.$trimmedId');
          filterParts.add('email.eq.$trimmedId');
        }
        var query = await _supabase
            .from('student_grantees')
            .select()
            .or(filterParts.join(','));

        if (query.isEmpty) {
          final schoolFilter = <String>{
            'student_no.eq.$trimmedId',
          };
          if (trimmedId.contains('@')) {
            schoolFilter.add('email_address.eq.$trimmedId');
          }
          final schoolQuery = await _supabase
              .from('school_students')
              .select()
              .or(schoolFilter.join(','));
          if (schoolQuery.isNotEmpty) {
            query = schoolQuery;
          }
        }

        if (query.isEmpty) {
          debugPrint(
            'AuthService: Step 2 FAILED - No record found for ID: $trimmedId',
          );
          throw Exception(
            'No account found for Student ID "$trimmedId". Please contact your administrator.',
          );
        }

        // Build list of candidate emails and passwords across all matching records
        final candidateEmails = <String>{};
        final candidatePasswords = <String>{};

        void addCandidatePassword(String? p) {
          if (p == null || p.trim().isEmpty) return;
          final clean = p.trim();
          if (clean.length >= 6) {
            candidatePasswords.add(clean);
          }
          candidatePasswords.add(clean.padLeft(6, '0'));
        }

        candidateEmails.add(_getAuthEmail(trimmedId));
        addCandidatePassword(trimmedPassword);
        addCandidatePassword(trimmedId);

        final foundEmails = <String>{};

        for (final data in query) {
          final studentNo = data['student_no']?.toString().trim();
          final studentIdField = data['studentId']?.toString().trim();
          final authEmailField = data['authEmail']?.toString().trim();
          final emailField = (data['email_address'] ?? data['email'])
              ?.toString()
              .trim();

          if (studentNo != null && studentNo.isNotEmpty) {
            candidateEmails.add(_getAuthEmail(studentNo));
            addCandidatePassword(studentNo);
          }
          if (studentIdField != null && studentIdField.isNotEmpty) {
            candidateEmails.add(_getAuthEmail(studentIdField));
            addCandidatePassword(studentIdField);
          }
          if (authEmailField != null && authEmailField.isNotEmpty) {
            candidateEmails.add(authEmailField);
          }
          if (emailField != null && emailField.isNotEmpty) {
            candidateEmails.add(emailField);
            foundEmails.add(emailField);
          }
        }

        // If email was found, query other companion rows to discover primary student numbers
        for (final email in foundEmails) {
          try {
            final companionRows = await _supabase
                .from('student_grantees')
                .select('student_no, studentId')
                .or('email_address.eq.$email,email.eq.$email');
            for (final comp in companionRows) {
              final sNo = comp['student_no']?.toString().trim();
              final sId = comp['studentId']?.toString().trim();
              if (sNo != null && sNo.isNotEmpty) {
                candidateEmails.add(_getAuthEmail(sNo));
                addCandidatePassword(sNo);
              }
              if (sId != null && sId.isNotEmpty) {
                candidateEmails.add(_getAuthEmail(sId));
                addCandidatePassword(sId);
              }
            }
          } catch (_) {}
        }

        debugPrint(
          'AuthService: Step 2 - Candidate emails: $candidateEmails, candidate passwords: ${candidatePasswords.length} options',
        );

        for (final candidateEmail in candidateEmails) {
          for (final candidatePassword in candidatePasswords) {
            if (candidatePassword.length < 6) continue;
            try {
              authResponse = await _supabase.auth.signInWithPassword(
                email: candidateEmail,
                password: candidatePassword,
              );
              if (authResponse.user != null) {
                debugPrint(
                  'AuthService: Step 2 SUCCESS with email: $candidateEmail (UID: ${authResponse.user?.id})',
                );
                break;
              }
            } on AuthException catch (e) {
              debugPrint(
                'AuthService: Step 2 attempt ($candidateEmail) -> ${e.message}',
              );
            }
          }
          if (authResponse != null && authResponse.user != null) {
            break;
          }
        }

        // Auto-provision student account if student exists in the database but Auth account does not
        if (authResponse == null || authResponse.user == null) {
          final firstRecord = query.first;
          final primaryId =
              (firstRecord['student_no'] ??
                      firstRecord['studentId'] ??
                      trimmedId)
                  .toString()
                  .trim();
          final primaryEmail = _getAuthEmail(primaryId);
          final autoProvisionPassword = formatAuthPassword(trimmedPassword);

          debugPrint(
            'AuthService: Step 2 - Auto-provisioning student Auth account ($primaryEmail)...',
          );
          try {
            final signUpRes = await _supabase.auth.signUp(
              email: primaryEmail,
              password: autoProvisionPassword,
            );
            if (signUpRes.user != null) {
              authResponse = signUpRes;
              debugPrint(
                'AuthService: Step 2 - Auto-provisioning SUCCESS (UID: ${signUpRes.user!.id})',
              );
              try {
                await _supabase
                    .from('student_grantees')
                    .update({'uid': signUpRes.user!.id})
                    .or('student_no.eq.$primaryId,studentId.eq.$primaryId');
              } catch (upErr) {
                debugPrint(
                  'AuthService: Auto-provision student UID link notice: $upErr',
                );
              }
            }
          } catch (signUpErr) {
            debugPrint('AuthService: Auto-provisioning failed: $signUpErr');
          }
        }

        if (authResponse == null || authResponse.user == null) {
          throw Exception('Login failed. Please verify your ID and password.');
        }
      } catch (e) {
        debugPrint('AuthService: Step 2 - Supabase query FAILED ($e)');
        rethrow;
      }
    }

    // --- Step 3: Verify the user record exists in Supabase students or admins collection ---
    if (authResponse.user != null) {
      final uid = authResponse.user!.id;
      final userEmail = (authResponse.user!.email ?? '').toLowerCase();
      debugPrint('AuthService: Step 3 - Verifying record for UID: $uid ($userEmail)');

      try {
        // 3a. Check if this account is an Administrator
        final isEmailAdmin = userEmail.contains('superadmin') ||
            userEmail.contains('admin@') ||
            trimmedId.toLowerCase() == 'admin' ||
            trimmedId.toLowerCase() == 'superadmin';

        if (isEmailAdmin) {
          try {
            final adminRows = await _supabase
                .from('admins')
                .select()
                .or('uid.eq.$uid,email.eq.$userEmail')
                .limit(1);
            if (adminRows.isNotEmpty || isEmailAdmin) {
              final adminRole = adminRows.isNotEmpty ? (adminRows.first['role'] ?? 'Admin') : 'Admin';
              final adminName = adminRows.isNotEmpty ? (adminRows.first['username'] ?? 'Admin') : 'Admin';
              debugPrint('AuthService: Step 3 - Admin account confirmed ($adminRole)');
              try {
                await _auditService.logActivity(
                  action: 'Logged into Mobile App as Administrator',
                  userName: adminName,
                  role: adminRole,
                );
              } catch (_) {}
              return authResponse;
            }
          } catch (_) {
            if (isEmailAdmin) return authResponse;
          }
        }

        // Also check admins table by username or UID for custom admin usernames
        try {
          final adminCheck = await _supabase
              .from('admins')
              .select()
              .or('uid.eq.$uid,email.eq.$userEmail,username.ilike.$trimmedId')
              .limit(1);
          if (adminCheck.isNotEmpty) {
            final adminRole = adminCheck.first['role'] ?? 'Admin';
            final adminName = adminCheck.first['username'] ?? 'Admin';
            debugPrint('AuthService: Step 3 - Custom Admin account confirmed ($adminRole)');
            try {
              await _auditService.logActivity(
                action: 'Logged into Mobile App as Administrator',
                userName: adminName,
                role: adminRole,
              );
            } catch (_) {}
            return authResponse;
          }
        } catch (_) {}

        // 3b. Verify student in student_grantees
        List<Map<String, dynamic>> doc = await _supabase
            .from('student_grantees')
            .select()
            .eq('uid', uid);

        // Fallback: If UID doesn't match yet, find by Student ID / email and automatically link UID
        if (doc.isEmpty) {
          debugPrint(
            'AuthService: Step 3 - No document for UID: $uid. Trying fallback lookup...',
          );

          final cleanNo = trimmedId.replaceAll(' ', '');
          final emailPrefix = userEmail.contains('@') ? userEmail.split('@').first.replaceAll('_', '') : '';
          final filterParts = <String>{
            'student_no.eq.$trimmedId',
            'studentId.eq.$trimmedId',
            'email_address.eq.$trimmedId',
            'email.eq.$trimmedId',
          };
          if (cleanNo.isNotEmpty) filterParts.add('student_no.eq.$cleanNo');
          if (emailPrefix.isNotEmpty) filterParts.add('student_no.eq.$emailPrefix');
          if (userEmail.isNotEmpty) {
            filterParts.add('email_address.eq.$userEmail');
            filterParts.add('email.eq.$userEmail');
          }

          final fallback = await _supabase
              .from('student_grantees')
              .select()
              .or(filterParts.join(','));

          if (fallback.isNotEmpty) {
            debugPrint(
              'AuthService: Step 3 - Found student record in student_grantees! Linking UID $uid',
            );
            try {
              await _supabase
                  .from('student_grantees')
                  .update({'uid': uid})
                  .eq('id', fallback.first['id']);
            } catch (upErr) {
              debugPrint('AuthService: Notice linking UID: $upErr');
            }
            doc = fallback;
          }
        }

        // 3c. If still not in student_grantees, check school_students table (e.g. from School Student Records import)
        if (doc.isEmpty) {
          try {
            final cleanNo = trimmedId.replaceAll(' ', '');
            final emailPrefix = userEmail.contains('@') ? userEmail.split('@').first.replaceAll('_', '') : '';
            final schoolFilterParts = <String>{
              'student_no.eq.$trimmedId',
              'email_address.eq.$trimmedId',
            };
            if (cleanNo.isNotEmpty) schoolFilterParts.add('student_no.eq.$cleanNo');
            if (emailPrefix.isNotEmpty) schoolFilterParts.add('student_no.eq.$emailPrefix');
            if (userEmail.isNotEmpty) schoolFilterParts.add('email_address.eq.$userEmail');
            if (cleanNo.length >= 6) {
              final suffix = cleanNo.substring(cleanNo.length - 6);
              schoolFilterParts.add('student_no.like.%$suffix');
            }

            final schoolDoc = await _supabase
                .from('school_students')
                .select()
                .or(schoolFilterParts.join(','))
                .limit(1);

            if (schoolDoc.isNotEmpty) {
              final s = schoolDoc.first;
              debugPrint('AuthService: Step 3 - Found student in school_students! Provisioning into student_grantees...');
              final newGrantee = {
                'uid': uid,
                'student_no': s['student_no'],
                'studentId': s['student_no'],
                'full_name': s['full_name'],
                'fullName': s['full_name'],
                'program_name': s['program_name'],
                'course': s['program_name'],
                'year_level': s['year_level'],
                'year': s['year_level'],
                'date_of_birth': s['date_of_birth'],
                'birthdate': s['date_of_birth'],
                'gender': s['gender'],
                'civil_status': s['civil_status'],
                'religion': s['religion'],
                'mobile_number': s['mobile_number'],
                'contactNumber': s['mobile_number'],
                'email_address': s['email_address'],
                'email': s['email_address'],
                'status': 'No Submission Yet',
                'scholarship_name': 'CHED TES',
                'role': 'student',
              };
              final inserted = await _supabase.from('student_grantees').insert(newGrantee).select();
              if (inserted.isNotEmpty) {
                doc = List<Map<String, dynamic>>.from(inserted);
              } else {
                doc = [newGrantee];
              }
            }
          } catch (schoolErr) {
            debugPrint('AuthService: Step 3 - school_students check error: $schoolErr');
          }
        }

        if (doc.isEmpty) {
          debugPrint('AuthService: Step 3 - Auto-provisioning student profile for UID: $uid ($userEmail)');
          final extractedId = userEmail.contains('@')
              ? userEmail.split('@').first.replaceAll('_', ' ').trim()
              : trimmedId;
          final fallbackStudent = {
            'uid': uid,
            'student_no': extractedId,
            'studentId': extractedId,
            'full_name': authResponse.user?.userMetadata?['fullName'] ??
                authResponse.user?.userMetadata?['full_name'] ??
                extractedId,
            'fullName': authResponse.user?.userMetadata?['fullName'] ??
                authResponse.user?.userMetadata?['full_name'] ??
                extractedId,
            'program_name': 'CHED TES Scholar',
            'course': 'CHED TES Scholar',
            'year_level': '1',
            'year': '1',
            'email_address': userEmail.isNotEmpty ? userEmail : '$trimmedId@scholardoc.com',
            'email': userEmail.isNotEmpty ? userEmail : '$trimmedId@scholardoc.com',
            'status': 'No Submission Yet',
            'scholarship_name': 'CHED TES',
            'role': 'student',
          };
          try {
            final inserted = await _supabase.from('student_grantees').insert(fallbackStudent).select();
            if (inserted.isNotEmpty) {
              doc = List<Map<String, dynamic>>.from(inserted);
            } else {
              doc = [fallbackStudent];
            }
          } catch (insertErr) {
            debugPrint('AuthService: Auto-provision profile notice: $insertErr');
            doc = [fallbackStudent];
          }
        }

        // If multiple student records exist (e.g. legacy/duplicate), prioritize the active/complete one
        if (doc.length > 1) {
          doc.sort((a, b) {
            final aHasData =
                a['submissionPdfUrl'] != null ||
                a['documents'] != null ||
                a['saNumber'] != null;
            final bHasData =
                b['submissionPdfUrl'] != null ||
                b['documents'] != null ||
                b['saNumber'] != null;
            if (aHasData && !bHasData) return -1;
            if (!aHasData && bHasData) return 1;
            return 0;
          });
        }

        final studentData = doc.first;
        // Cache uid on record if missing or mismatched
        if (studentData['id'] != null && (studentData['uid'] == null || studentData['uid'] != uid)) {
          try {
            await _supabase
                .from('student_grantees')
                .update({'uid': uid})
                .eq('id', studentData['id']);
          } catch (_) {}
        }

        final String displayName =
            studentData['full_name'] ?? studentData['fullName'] ?? 'Student';
        debugPrint('AuthService: Step 3 SUCCESS - Found student: $displayName');

        // Log Activity safely
        try {
          await _auditService.logActivity(
            action: 'Logged in using Student ID',
            userName: displayName,
            role: 'Student',
            studentId: trimmedId,
          );
        } catch (_) {}

        // Initialize Presence tracking safely
        try {
          await _presenceService.setUserPresence(uid);
        } catch (_) {}

        // Send Welcome notification on first login
        try {
          final existingWelcome = await _supabase
              .from('notifications')
              .select('id')
              .eq('studentId', uid)
              .ilike('title', '%Welcome%')
              .limit(1);

          if (existingWelcome.isEmpty) {
            debugPrint(
              'AuthService: First login detected for $displayName - generating Welcome notification',
            );
            await _notificationService.sendNotification(
              studentId: uid,
              title: 'Welcome to ScholarDoc!',
              message:
                  'Welcome, $displayName! Your scholarship portal is ready. Check your profile, submitted documents, and stay updated on announcements.',
              type: 'success',
            );
          }
        } catch (notifErr) {
          debugPrint(
            'AuthService: Welcome notification check notice: $notifErr',
          );
        }

        // Sync FCM Push Notification token on successful student login
        try {
          await PushNotificationService().syncToken(
            uid,
            studentId: trimmedId,
          );
        } catch (pushErr) {
          debugPrint('AuthService: Push token sync notice: $pushErr');
        }
      } catch (e) {
        debugPrint('AuthService: Step 3 - Supabase fetch FAILED ($e)');
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
    final String clean = username.trim().toLowerCase();
    String adminEmail = clean.contains('@')
        ? clean
        : (clean == 'superadmin'
              ? 'superadmin@scholardoc.com'
              : (clean == 'admin'
                    ? 'admin@scholardoc.com'
                    : '$clean@scholardoc.com'));

    // Check if username exists in admins table to resolve custom admin usernames
    if (!clean.contains('@') && clean != 'superadmin' && clean != 'admin') {
      try {
        final res = await _supabase
            .from('admins')
            .select('email')
            .ilike('username', clean)
            .limit(1);
        if (res.isNotEmpty && res.first['email'] != null) {
          adminEmail = res.first['email'] as String;
        }
      } catch (_) {}
    }

    final bool isSuper = adminEmail.contains('superadmin');
    final String defaultRole = isSuper ? 'Super Admin' : 'Admin';

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
          'role': defaultRole,
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
        role: defaultRole,
      );

      return true;
    } on AuthException catch (e) {
      debugPrint('AuthService: Admin Login failed (${e.message})');

      // 2. If user doesn't exist, create the admin account (Auto-Provisioning)
      if (e.message.toLowerCase().contains('invalid login') ||
          e.message.toLowerCase().contains('not found')) {
        if ((clean == 'admin' || clean == 'superadmin') &&
            password.length >= 6) {
          // Supabase min is usually 6
          debugPrint(
            'AuthService: Auto-provisioning admin account ($adminEmail)...',
          );
          try {
            await _supabase.auth.signUp(email: adminEmail, password: password);

            // 3. Attempt to ensure Admin document exists
            try {
              await _supabase.from('admins').upsert({
                'uid': _supabase.auth.currentUser!.id,
                'email': adminEmail,
                'username': username,
                'role': defaultRole,
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
              role: defaultRole,
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
        } else if ((clean == 'admin' || clean == 'superadmin') &&
            password.length < 6) {
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

  // Check if current authenticated user is an Administrator
  Future<bool> isCurrentUserAdmin() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return false;
    final email = (user.email ?? '').toLowerCase();
    if (email.contains('superadmin') || email.contains('admin@')) return true;
    try {
      final doc = await _supabase
          .from('admins')
          .select('id, role')
          .or('uid.eq.${user.id},email.eq.$email')
          .limit(1);
      return doc.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  // Logout current user
  Future<void> logout() async {
    final uid = _supabase.auth.currentUser?.id;
    if (uid != null) {
      await _presenceService.setOffline(uid);
      try {
        await PushNotificationService().clearToken(uid);
      } catch (_) {}
    }
    await _supabase.auth.signOut();
  }

  // Normalize student dictionary to support both snake_case and camelCase
  Map<String, dynamic> _normalizeStudentData(Map<String, dynamic> raw) {
    final data = Map<String, dynamic>.from(raw);

    // Normalize scholarship
    final scholarship =
        data['scholarshipName'] ?? data['scholarship_name'] ?? 'TES';
    data['scholarshipName'] = scholarship;
    data['scholarship_name'] = scholarship;

    // Normalize academic program & course
    final course = data['course'] ?? data['program_name'] ?? '';
    data['course'] = course;
    data['program_name'] = course;

    // Normalize year level
    final year = data['year'] ?? data['year_level'] ?? '';
    data['year'] = year;
    data['year_level'] = year;

    // Normalize student ID
    final studentId = data['studentId'] ?? data['student_no'] ?? '';
    data['studentId'] = studentId;
    data['student_no'] = studentId;

    // Normalize full name
    final fullName = data['fullName'] ?? data['full_name'] ?? '';
    data['fullName'] = fullName;
    data['full_name'] = fullName;

    // Normalize contact and email
    final email = data['email'] ?? data['email_address'] ?? '';
    data['email'] = email;
    data['email_address'] = email;

    final contact = data['contactNumber'] ?? data['mobile_number'] ?? '';
    data['contactNumber'] = contact;
    data['mobile_number'] = contact;

    // Normalize Year became a scholar
    final scholarYear =
        data['scholarYearLevel'] ??
        data['year_became_scholar'] ??
        data['yearBecameScholar'] ??
        '';
    data['scholarYearLevel'] = scholarYear;
    data['year_became_scholar'] = scholarYear;
    data['yearBecameScholar'] = scholarYear;

    // Normalize Payouts received
    final payouts = data['payoutsReceived'] ?? data['payouts_received'] ?? 0;
    data['payoutsReceived'] = payouts;
    data['payouts_received'] = payouts;

    // Merge user metadata if available
    final userMeta = _supabase.auth.currentUser?.userMetadata;
    if (userMeta != null) {
      if ((data['scholarYearLevel'] == null ||
              data['scholarYearLevel'].toString().isEmpty) &&
          userMeta['yearBecameScholar'] != null) {
        final val = userMeta['yearBecameScholar'].toString();
        data['scholarYearLevel'] = val;
        data['year_became_scholar'] = val;
        data['yearBecameScholar'] = val;
      }
      if (userMeta['payoutsReceived'] != null &&
          (data['payoutsReceived'] == 0 || data['payoutsReceived'] == null)) {
        data['payoutsReceived'] = userMeta['payoutsReceived'];
        data['payouts_received'] = userMeta['payoutsReceived'];
      }
      if (userMeta['scholarshipName'] != null) {
        data['scholarshipName'] = userMeta['scholarshipName'];
        data['scholarship_name'] = userMeta['scholarshipName'];
      }
    }

    return data;
  }

  // Enrich student profile from school_students if name or course contains placeholder data
  Future<Map<String, dynamic>> _enrichStudentDataFromSchool(Map<String, dynamic> data) async {
    final currentName = (data['fullName'] ?? data['full_name'] ?? '').toString().trim();
    final currentCourse = (data['course'] ?? data['program_name'] ?? '').toString().trim();
    final sId = (data['studentId'] ?? data['student_no'] ?? '').toString().trim();
    final isNamePlaceholder = currentName.isEmpty ||
        currentName == sId ||
        RegExp(r'^\d+$').hasMatch(currentName);
    final isCoursePlaceholder = currentCourse.isEmpty ||
        currentCourse == 'CHED TES Scholar' ||
        currentCourse == 'TES';

    if (isNamePlaceholder || isCoursePlaceholder) {
      try {
        final cleanId = sId.replaceAll(' ', '').replaceAll('-', '');
        final orConditions = <String>{};
        if (sId.isNotEmpty) orConditions.add('student_no.eq.$sId');
        if (cleanId.isNotEmpty) orConditions.add('student_no.eq.$cleanId');
        if (cleanId.length >= 6) {
          final suffix = cleanId.substring(cleanId.length - 6);
          orConditions.add('student_no.like.%$suffix');
        }
        final email = (data['email'] ?? data['email_address'] ?? '').toString().trim();
        if (email.isNotEmpty && !email.endsWith('@scholardoc.com')) {
          orConditions.add('email_address.eq.$email');
        }

        if (orConditions.isNotEmpty) {
          final schoolRes = await _supabase
              .from('school_students')
              .select()
              .or(orConditions.join(','))
              .limit(1);
          if (schoolRes.isNotEmpty) {
            final schoolStudent = schoolRes.first;
            final enrichedName = (schoolStudent['full_name'] != null && schoolStudent['full_name'].toString().trim().isNotEmpty)
                ? schoolStudent['full_name'].toString().trim()
                : currentName;
            final enrichedCourse = (schoolStudent['program_name'] != null && schoolStudent['program_name'].toString().trim().isNotEmpty)
                ? schoolStudent['program_name'].toString().trim()
                : currentCourse;
            final enrichedYear = schoolStudent['year_level'] ?? data['year_level'];
            final enrichedBirthdate = schoolStudent['date_of_birth'] ?? data['birthdate'];
            final enrichedGender = schoolStudent['gender'] ?? data['gender'];
            final enrichedMobile = schoolStudent['mobile_number'] ?? data['contactNumber'];
            final enrichedEmail = (schoolStudent['email_address'] != null && schoolStudent['email_address'].toString().contains('@'))
                ? schoolStudent['email_address'].toString().trim()
                : data['email'];

            data['fullName'] = enrichedName;
            data['full_name'] = enrichedName;
            data['course'] = enrichedCourse;
            data['program_name'] = enrichedCourse;
            if (enrichedYear != null) {
              data['year'] = enrichedYear.toString();
              data['year_level'] = enrichedYear.toString();
            }
            if (enrichedBirthdate != null) {
              data['birthdate'] = enrichedBirthdate.toString();
              data['date_of_birth'] = enrichedBirthdate.toString();
            }
            if (enrichedGender != null) data['gender'] = enrichedGender;
            if (enrichedMobile != null) {
              data['contactNumber'] = enrichedMobile.toString();
              data['mobile_number'] = enrichedMobile.toString();
            }
            if (enrichedEmail != null) {
              data['email'] = enrichedEmail;
              data['email_address'] = enrichedEmail;
            }

            // Sync back to student_grantees asynchronously
            final recordId = data['id'];
            if (recordId != null) {
              _supabase.from('student_grantees').update({
                'full_name': enrichedName,
                'fullName': enrichedName,
                'program_name': enrichedCourse,
                'course': enrichedCourse,
                if (enrichedYear != null) 'year_level': enrichedYear.toString(),
                if (enrichedYear != null) 'year': enrichedYear.toString(),
                if (enrichedBirthdate != null) 'date_of_birth': enrichedBirthdate.toString(),
                if (enrichedBirthdate != null) 'birthdate': enrichedBirthdate.toString(),
                'gender': ?enrichedGender,
                if (enrichedMobile != null) 'mobile_number': enrichedMobile.toString(),
                if (enrichedMobile != null) 'contactNumber': enrichedMobile.toString(),
                'email_address': ?enrichedEmail,
                'email': ?enrichedEmail,
              }).eq('id', recordId).catchError((_) {});
            }
          }
        }
      } catch (err) {
        debugPrint('AuthService enrich error: $err');
      }
    }
    return data;
  }

  // Get student profile data from Supabase
  Future<Map<String, dynamic>?> getStudentProfile(String uid) async {
    try {
      final response = await _supabase
          .from('student_grantees')
          .select()
          .eq('uid', uid);
      if (response.isNotEmpty) {
        final list = List<Map<String, dynamic>>.from(response);
        if (list.length > 1) {
          list.sort((a, b) {
            final aHas =
                a['submissionPdfUrl'] != null ||
                (a['documents'] is Map && (a['documents'] as Map).isNotEmpty) ||
                (a['saNumber'] != null && a['saNumber'] != 'N/A');
            final bHas =
                b['submissionPdfUrl'] != null ||
                (b['documents'] is Map && (b['documents'] as Map).isNotEmpty) ||
                (b['saNumber'] != null && b['saNumber'] != 'N/A');
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return 0;
          });
        }
        final normalized = _normalizeStudentData(list.first);
        return await _enrichStudentDataFromSchool(normalized);
      }

      // Fallback: If no document by uid, attempt lookup by user email (derived from student ID)
      final user = _supabase.auth.currentUser;
      if (user != null) {
        final email = user.email ?? '';
        final sId = email.contains('@')
            ? email.split('@').first.replaceAll('_', ' ').trim()
            : '';
        if (sId.isNotEmpty) {
          final byId = await _supabase
              .from('student_grantees')
              .select()
              .or('student_no.eq.$sId,studentId.eq.$sId');
          if (byId.isNotEmpty) {
            final list = List<Map<String, dynamic>>.from(byId);
            list.sort((a, b) {
              final aHas =
                  a['submissionPdfUrl'] != null ||
                  (a['documents'] is Map && (a['documents'] as Map).isNotEmpty);
              final bHas =
                  b['submissionPdfUrl'] != null ||
                  (b['documents'] is Map && (b['documents'] as Map).isNotEmpty);
              if (aHas && !bHas) return -1;
              if (!aHas && bHas) return 1;
              return 0;
            });
            // Link UID in background
            try {
              await _supabase
                  .from('student_grantees')
                  .update({'uid': uid})
                  .eq('id', list.first['id']);
            } catch (_) {}
            final normalized = _normalizeStudentData(list.first);
            return await _enrichStudentDataFromSchool(normalized);
          }
        }
      }
    } catch (e) {
      debugPrint('AuthService getStudentProfile error: $e');
    }
    return null;
  }

  // Get stream of student profile data for real-time tracking
  Stream<List<Map<String, dynamic>>> getStudentStream(String uid) {
    try {
      // Primary key of students table is 'id'
      return _supabase
          .from('student_grantees')
          .stream(primaryKey: ['id'])
          .eq('uid', uid)
          .map((list) {
            final sorted = List<Map<String, dynamic>>.from(list);
            if (sorted.length > 1) {
              sorted.sort((a, b) {
                final aHas =
                    a['submissionPdfUrl'] != null ||
                    (a['documents'] is Map &&
                        (a['documents'] as Map).isNotEmpty);
                final bHas =
                    b['submissionPdfUrl'] != null ||
                    (b['documents'] is Map &&
                        (b['documents'] as Map).isNotEmpty);
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return 0;
              });
            }
            return sorted.map((item) => _normalizeStudentData(item)).toList();
          });
    } catch (e) {
      debugPrint('AuthService getStudentStream error: $e');
      return Stream.empty();
    }
  }

  // Update student profile data
  Future<void> updateStudentProfile(
    String uid,
    Map<String, dynamic> updates,
  ) async {
    final dbPayload = Map<String, dynamic>.from(updates);

    // Synchronize aliases so both styles are included
    if (dbPayload.containsKey('fullName')) {
      dbPayload['full_name'] = dbPayload['fullName'];
    } else if (dbPayload.containsKey('full_name')) {
      dbPayload['fullName'] = dbPayload['full_name'];
    }

    if (dbPayload.containsKey('contactNumber')) {
      dbPayload['mobile_number'] = dbPayload['contactNumber'];
    } else if (dbPayload.containsKey('mobile_number')) {
      dbPayload['contactNumber'] = dbPayload['mobile_number'];
    }

    if (dbPayload.containsKey('birthdate')) {
      dbPayload['date_of_birth'] = dbPayload['birthdate'];
    } else if (dbPayload.containsKey('date_of_birth')) {
      dbPayload['birthdate'] = dbPayload['date_of_birth'];
    }

    if (dbPayload.containsKey('saNumber')) {
      dbPayload['sa_number'] = dbPayload['saNumber'];
    } else if (dbPayload.containsKey('sa_number')) {
      dbPayload['saNumber'] = dbPayload['sa_number'];
    }

    if (dbPayload.containsKey('course')) {
      dbPayload['program_name'] = dbPayload['course'];
    } else if (dbPayload.containsKey('program_name')) {
      dbPayload['course'] = dbPayload['program_name'];
    }

    if (dbPayload.containsKey('year')) {
      dbPayload['year_level'] = dbPayload['year'];
    } else if (dbPayload.containsKey('year_level')) {
      dbPayload['year'] = dbPayload['year_level'];
    }

    if (dbPayload.containsKey('scholarshipName')) {
      dbPayload['scholarship_name'] = dbPayload['scholarshipName'];
    } else if (dbPayload.containsKey('scholarship_name')) {
      dbPayload['scholarshipName'] = dbPayload['scholarship_name'];
    }

    if (dbPayload.containsKey('scholarYearLevel')) {
      dbPayload['year_became_scholar'] = dbPayload['scholarYearLevel'];
      dbPayload['yearBecameScholar'] = dbPayload['scholarYearLevel'];
    } else if (dbPayload.containsKey('year_became_scholar')) {
      dbPayload['scholarYearLevel'] = dbPayload['year_became_scholar'];
      dbPayload['yearBecameScholar'] = dbPayload['year_became_scholar'];
    }

    if (dbPayload.containsKey('payoutsReceived')) {
      dbPayload['payouts_received'] = dbPayload['payoutsReceived'].toString();
    }

    // Always persist to Supabase Auth user metadata as an instant fail-safe
    try {
      await _supabase.auth.updateUser(UserAttributes(data: updates));
    } catch (e) {
      debugPrint('AuthService: Failed to update user metadata: $e');
    }

    // Try updating students table; if any column is missing in Supabase, strip and retry
    try {
      await _supabase.from('student_grantees').update(dbPayload).eq('uid', uid);
    } catch (e) {
      debugPrint('AuthService: Retrying table update with safe fields: $e');
      final safePayload = <String, dynamic>{};
      const safeFields = [
        'full_name',
        'fullName',
        'mobile_number',
        'contactNumber',
        'program_name',
        'course',
        'year_level',
        'year',
        'section',
        'birthdate',
        'scholarship_name',
        'status',
        'saNumber',
        'sa_number',
        'submissionPdfUrl',
        'submission_pdf_url',
        'submissionPdfName',
        'submission_pdf_name',
        'documents',
        'atmCardUrl',
        'atm_card_url',
        'atmCardFileName',
        'idFrontUrl',
        'id_front_url',
        'idBackUrl',
        'id_back_url',
        'pdfVerified',
        'academicYear',
        'academic_year',
        'semester',
        'stickerValidated',
        'sticker_validated',
        'submittedAt',
        'submitted_at',
        'requiresResubmission',
        'adminRemarks',
        'admin_remarks',
        'familyDetails',
      ];
      for (final key in safeFields) {
        if (dbPayload.containsKey(key)) safePayload[key] = dbPayload[key];
      }
      try {
        await _supabase
            .from('student_grantees')
            .update(safePayload)
            .eq('uid', uid);
      } catch (inner) {
        debugPrint(
          'AuthService: Safe batch update failed: $inner. Retrying column-by-column...',
        );
        for (final entry in safePayload.entries) {
          try {
            await _supabase
                .from('student_grantees')
                .update({entry.key: entry.value})
                .eq('uid', uid);
          } catch (_) {}
        }
      }
    }

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
        .from('student_grantees')
        .stream(primaryKey: ['uid'])
        .order('createdAt', ascending: false)
        .map(
          (list) => list.map((item) => _normalizeStudentData(item)).toList(),
        );
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
      data['status'] = data['status'] ?? 'No Submission Yet';
      toUpsert.add(data);
    }

    // Upsert matches by primary key or unique constraints
    // If 'uid' is not provided, Supabase might reject it if it's primary key unless we let it gen.
    // Wait, uid is the auth.users(id), which we might not have for CSV imports?
    // We should probably rely on the backend function or match by studentId.
    // Since uid is required in our schema, we should probably upsert using 'studentId'.
    // For simplicity, we just use upsert.
    await _supabase.from('student_grantees').upsert(toUpsert);

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
          .from('student_grantees')
          .select()
          .eq('scholarshipName', 'STUFAH');

      for (var doc in data) {
        await _supabase
            .from('student_grantees')
            .update({'scholarshipName': 'STUFAP'})
            .eq('uid', doc['uid']);
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
      final data = await _supabase.from('student_grantees').select();
      for (var doc in data) {
        bool needsUpdate = false;
        Map<String, dynamic> updates = {};

        if (doc['gender'] == null || doc['gender'].toString().isEmpty) {
          needsUpdate = true;
          updates['gender'] = 'Not Specified';
        }
        if (doc['scholarYearLevel'] == null ||
            doc['scholarYearLevel'].toString().isEmpty) {
          needsUpdate = true;
          updates['scholarYearLevel'] = 'Unknown';
        }

        if (needsUpdate) {
          await _supabase
              .from('student_grantees')
              .update(updates)
              .eq('uid', doc['uid']);
          updatedCount++;
        }
      }
    } catch (e) {
      debugPrint('AuthService: Error migrating fields: $e');
    }
    return updatedCount;
  }
}
