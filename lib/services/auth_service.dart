import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'audit_service.dart';
import 'notification_service.dart';
import 'presence_service.dart';
import 'push_notification_service.dart';
import 'sms_service.dart';
import '../config/api_config.dart';

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

  /// Default server URL dynamically resolved via ApiConfig
  static String get serverBaseUrl => ApiConfig.baseUrl;

  /// Initiates student login:
  /// - Admin / SuperAdmin users bypass OTP verification.
  /// - Student Grantees are validated against the backend scholarship database.
  /// - On the student's first login, validates that Student ID is used as the initial password
  ///   and dispatches a 6-digit OTP to their registered mobile number via Semaphore SMS.
  /// - On subsequent logins, allows direct login without OTP prompt.
  Future<Map<String, dynamic>> initiateStudentLogin({
    required String studentId,
    required String password,
  }) async {
    final cleanId = studentId.trim();
    final cleanLower = cleanId.toLowerCase();
    final cleanPwd = password.trim();

    // 1. Admins and SuperAdmins bypass student SMS OTP verification
    final bool isAdmin = cleanLower == 'admin' ||
        cleanLower == 'superadmin' ||
        cleanLower.contains('admin@') ||
        cleanId.contains('@scholardoc.com');

    if (isAdmin) {
      return {
        'requiresOtp': false,
        'isAdmin': true,
        'studentId': cleanId,
        'message': 'Admin login',
      };
    }

    // 2. Call backend /api/auth/student-login with responsive timeout across candidate URLs
    final candidates = <String>{serverBaseUrl, ...ApiConfig.candidateUrls}.toList();
    dynamic lastConnectionError;

    for (final candidate in candidates) {
      if (candidate.isEmpty && !kIsWeb) continue;
      try {
        final uri = Uri.parse('$candidate/api/auth/student-login');
        final res = await http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'studentId': cleanId,
            'password': cleanPwd,
          }),
        ).timeout(const Duration(milliseconds: 2500));

        // Confirmed working candidate
        if (candidate.isNotEmpty) {
          ApiConfig.setWorkingBaseUrl(candidate);
        }

        final data = jsonDecode(res.body);

        if (res.statusCode == 200) {
          return Map<String, dynamic>.from(data);
        } else if (res.statusCode == 403) {
          final msg = data['message'] ??
              'Access denied. Student ID "$cleanId" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.';
          throw Exception(msg);
        } else if (res.statusCode == 401) {
          final msg = data['error'] ??
              'Invalid initial credentials. On your first login, please enter your Student ID as both your username and password.';
          throw Exception(msg);
        } else if (res.statusCode == 429) {
          final msg = data['error'] ?? 'Rate limit exceeded. Please try again shortly.';
          throw Exception(msg);
        } else {
          final msg = data['error'] ?? data['message'] ?? 'Login failed (${res.statusCode})';
          throw Exception(msg);
        }
      } catch (e) {
        if (e.toString().contains('Access denied') ||
            e.toString().contains('Invalid initial credentials') ||
            e.toString().contains('Rate limit') ||
            e.toString().contains('No valid Philippine mobile number')) {
          rethrow;
        }
        lastConnectionError = e;
      }
    }

    debugPrint('AuthService.initiateStudentLogin notice (falling back to direct Supabase): $lastConnectionError');

    // 3. Fallback: Direct Supabase verification when backend server is offline or unreachable
    final cleanNo = cleanId.replaceAll('-', '').replaceAll(' ', '');
    final filterParts = <String>{
      'student_no.eq.$cleanId',
      'studentId.eq.$cleanId',
    };
    if (cleanNo.isNotEmpty && cleanNo != cleanId) {
      filterParts.add('student_no.eq.$cleanNo');
      filterParts.add('studentId.eq.$cleanNo');
    }
    if (cleanId.contains('@')) {
      filterParts.add('email_address.eq.$cleanId');
      filterParts.add('email.eq.$cleanId');
    }

    final query = await _supabase
        .from('student_grantees')
        .select()
        .or(filterParts.join(','));

    if (query.isEmpty) {
      throw Exception(
        'Access denied. Student ID "$cleanId" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.',
      );
    }

    final grantee = query.first;
    // Strict First-Login Check: Only consider completed if explicitly verified via first_login_completed or otp_verified_at
    final isFirstCompleted = grantee['first_login_completed'] == true ||
        grantee['otp_verified_at'] != null;

    if (isFirstCompleted) {
      debugPrint('AuthService: Returning student verified directly via Supabase for $cleanId');
      return {
        'success': true,
        'requiresOtp': false,
        'isFirstLogin': false,
        'studentId': cleanId,
        'message': 'Returning student grantee. Standard login permitted (direct database fallback).',
      };
    }

    // First Login check: Initial password must match Student ID
    final studentNo = (grantee['student_no'] ?? grantee['studentId'] ?? '').toString().trim();
    final matchesInitialId = cleanPwd == cleanId ||
        (cleanNo.isNotEmpty && cleanPwd == cleanNo) ||
        (studentNo.isNotEmpty && cleanPwd == studentNo);

    if (!matchesInitialId) {
      throw Exception(
        'Invalid initial credentials. On your first login, please enter your Student ID as both your username and password.',
      );
    }

    // Resolve masked phone for UI
    final rawPhone = (grantee['mobile_number'] ?? grantee['contactNumber'] ?? '').toString();
    String maskedPhone = 'your registered phone';
    final cleanDigits = rawPhone.replaceAll(RegExp(r'\D'), '');
    if (cleanDigits.length == 11) {
      maskedPhone = '${cleanDigits.substring(0, 4)} •••• ${cleanDigits.substring(8)}';
    } else if (cleanDigits.length > 4) {
      maskedPhone = '${cleanDigits.substring(0, 2)} •••• ${cleanDigits.substring(cleanDigits.length - 2)}';
    }

    debugPrint('AuthService: First-login credentials matched via Supabase for $cleanId -> requiresOtp: true');
    return {
      'success': true,
      'requiresOtp': true,
      'isFirstLogin': true,
      'studentId': cleanId,
      'maskedPhone': maskedPhone,
      'expiresIn': 300,
      'resendCooldown': 60,
      'message': 'A one-time password (OTP) is required for first-time login verification.',
    };
  }

  /// Verifies the SMS OTP on the backend:
  /// - Enforces single-use, expiration (5 mins), and max 5 attempts.
  /// - If backend validation passes, proceeds to complete Supabase Auth session.
  Future<AuthResponse?> verifyLoginOtp({
    required String studentId,
    required String otp,
    required String password,
  }) async {
    final cleanId = studentId.trim();
    final cleanOtp = otp.trim();
    final candidates = <String>{serverBaseUrl, ...ApiConfig.candidateUrls}.toList();
    dynamic lastErr;

    for (final candidate in candidates) {
      if (candidate.isEmpty && !kIsWeb) continue;
      try {
        final uri = Uri.parse('$candidate/api/auth/otp/verify');
        final res = await http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'studentId': cleanId,
            'otp': cleanOtp,
            'password': password.trim(),
          }),
        ).timeout(const Duration(seconds: 4));

        if (candidate.isNotEmpty) {
          ApiConfig.setWorkingBaseUrl(candidate);
        }

        final data = jsonDecode(res.body);

        if (res.statusCode == 200 && data['verified'] == true) {
          debugPrint('AuthService: Backend OTP verification SUCCESS for $cleanId');
          // Complete the Supabase Auth login with the verified student credentials
          return await loginStudent(
            studentId: cleanId,
            password: password.trim(),
          );
        }

        final errMsg = data['error'] ?? data['message'] ?? 'OTP verification failed';
        throw Exception(errMsg);
      } catch (e) {
        if (e.toString().contains('Invalid OTP code') ||
            e.toString().contains('expired') ||
            e.toString().contains('Maximum') ||
            e.toString().contains('remaining')) {
          rethrow;
        }
        lastErr = e;
      }
    }

    debugPrint('AuthService.verifyLoginOtp error: $lastErr');
    throw Exception(lastErr?.toString() ?? 'OTP verification failed. Please check your connection.');
  }

  /// Requests a new OTP via Semaphore SMS with rate limit handling (60s cooldown).
  Future<Map<String, dynamic>> resendLoginOtp({
    required String studentId,
  }) async {
    final cleanId = studentId.trim();
    final candidates = <String>{serverBaseUrl, ...ApiConfig.candidateUrls}.toList();
    dynamic lastErr;

    for (final candidate in candidates) {
      if (candidate.isEmpty && !kIsWeb) continue;
      try {
        final uri = Uri.parse('$candidate/api/auth/otp/resend');
        final res = await http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'studentId': cleanId,
          }),
        ).timeout(const Duration(seconds: 4));

        if (candidate.isNotEmpty) {
          ApiConfig.setWorkingBaseUrl(candidate);
        }

        final data = jsonDecode(res.body);

        if (res.statusCode == 200) {
          return Map<String, dynamic>.from(data);
        }

        final errMsg = data['error'] ?? data['message'] ?? 'Failed to resend OTP';
        throw Exception(errMsg);
      } catch (e) {
        if (e.toString().contains('wait') ||
            e.toString().contains('Rate limit') ||
            e.toString().contains('Access denied')) {
          rethrow;
        }
        lastErr = e;
      }
    }

    debugPrint('AuthService.resendLoginOtp error: $lastErr');
    throw Exception(lastErr?.toString() ?? 'Failed to resend OTP. Please check your connection.');
  }

  /// Resets a student's first-login status (convenience helper for testing & coordinators).
  Future<bool> resetStudentFirstLogin({required String studentId}) async {
    try {
      final uri = Uri.parse('$serverBaseUrl/api/auth/otp/reset-first-login');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'studentId': studentId.trim()}),
      ).timeout(const Duration(seconds: 6));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Signs out of Supabase Auth
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
    } catch (e) {
      debugPrint('AuthService.signOut notice: $e');
    }
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
          phone: studentData['contactNumber'] ?? studentData['mobile_number'],
          studentNo: studentId,
        );

        // Send Registration Notification to Super Admin
        final String fullName = studentData['fullName'] ?? 'A student';
        await _notificationService.sendNotification(
          studentId: 'superadmin',
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
    final cleanLower = trimmedId.toLowerCase();
    bool isAdmin = cleanLower == 'admin' ||
        cleanLower == 'superadmin' ||
        cleanLower.contains('admin@');

    // Resolve admin emails if input is admin / superadmin or matches custom admin username
    if (!trimmedId.contains('@')) {
      if (cleanLower == 'superadmin') {
        authEmail = 'superadmin@scholardoc.com';
        isAdmin = true;
      } else if (cleanLower == 'admin') {
        authEmail = 'admin@scholardoc.com';
        isAdmin = true;
      } else {
        try {
          final adminRes = await _supabase
              .from('admins')
              .select('email')
              .ilike('username', trimmedId)
              .limit(1);
          if (adminRes.isNotEmpty && adminRes.first['email'] != null) {
            authEmail = adminRes.first['email'] as String;
            isAdmin = true;
          }
        } catch (_) {}
      }
    } else {
      if (!isAdmin) {
        try {
          final adminRes = await _supabase
              .from('admins')
              .select('email')
              .ilike('email', trimmedId)
              .limit(1);
          if (adminRes.isNotEmpty && adminRes.first['email'] != null) {
            authEmail = adminRes.first['email'] as String;
            isAdmin = true;
          }
        } catch (_) {}
      }
    }

    // Helper to format password to satisfy Supabase Auth's minimum 6-character requirement
    String formatAuthPassword(String pwd) {
      final clean = pwd.trim();
      if (clean.isNotEmpty && clean.length < 6) {
        return clean.padLeft(6, '0');
      }
      return clean;
    }

    AuthResponse? authResponse;
    List<Map<String, dynamic>> matchingRecords = [];
    bool isFromGranteesTable = false;

    // --- Mandatory Pre-check for Students: Must exist in student_grantees table ---
    if (!isAdmin) {
      // 1a. Secure Backend Validation against student_grantees table
      try {
        final validateUrl = Uri.parse('$serverBaseUrl/api/auth/validate-grantee');
        final res = await http.post(
          validateUrl,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'identifier': trimmedId}),
        ).timeout(const Duration(seconds: 4));

        if (res.statusCode == 200 || res.statusCode == 403) {
          final data = jsonDecode(res.body);
          if (data is Map && data['isEligible'] == false) {
            final errorMsg = data['message'] ??
                'Access denied. Student ID "$trimmedId" is not registered as an eligible grantee in the scholarship database.';
            debugPrint('AuthService: Backend eligibility check REJECTED: $errorMsg');
            throw Exception(errorMsg);
          }
        }
      } catch (backendErr) {
        if (backendErr.toString().contains('Access denied')) {
          rethrow;
        }
        debugPrint('AuthService: Backend verification notice (fallback to direct query): $backendErr');
      }

      // 1b. Direct Supabase query strictly on student_grantees table (NO school_students fallback)
      final cleanNo = trimmedId.replaceAll('-', '').replaceAll(' ', '');
      final filterParts = <String>{
        'student_no.eq.$trimmedId',
        'studentId.eq.$trimmedId',
      };
      if (cleanNo.isNotEmpty && cleanNo != trimmedId) {
        filterParts.add('student_no.eq.$cleanNo');
        filterParts.add('studentId.eq.$cleanNo');
      }
      if (trimmedId.contains('@')) {
        filterParts.add('email_address.eq.$trimmedId');
        filterParts.add('email.eq.$trimmedId');
      }

      final query = await _supabase
          .from('student_grantees')
          .select()
          .or(filterParts.join(','));

      // If NOT in student_grantees table, CANNOT login!
      if (query.isEmpty) {
        debugPrint(
          'AuthService: Login REJECTED - Student ID "$trimmedId" not found in student_grantees.',
        );
        throw Exception(
          'Access denied. Student ID "$trimmedId" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.',
        );
      }

      matchingRecords = List<Map<String, dynamic>>.from(query);
      isFromGranteesTable = true;
    }

    if (isAdmin) {
      // --- Admin login flow ---
      final step1Passwords = <String>{};
      if (trimmedPassword.length >= 6) step1Passwords.add(trimmedPassword);
      step1Passwords.add(formatAuthPassword(trimmedPassword));

      for (final pwd in step1Passwords) {
        try {
          authResponse = await _supabase.auth.signInWithPassword(
            email: authEmail,
            password: pwd,
          );
          if (authResponse.user != null) break;
        } catch (_) {}
      }
    } else {
      // --- Student login flow ---
      final firstRecord = matchingRecords.first;
      final primaryStudentNo = (firstRecord['student_no'] ??
              firstRecord['studentId'] ??
              trimmedId)
          .toString()
          .trim();

      // STRICT SECURITY GATE: Enforce OTP verification on student first login
      final bool firstLoginDone = firstRecord['first_login_completed'] == true || firstRecord['otp_verified_at'] != null;
      if (!firstLoginDone) {
        bool isBackendVerified = false;
        final candidates = <String>{serverBaseUrl, ...ApiConfig.candidateUrls}.toList();
        for (final candidate in candidates) {
          if (candidate.isEmpty && !kIsWeb) continue;
          try {
            final uri = Uri.parse('$candidate/api/auth/otp/status?studentId=${Uri.encodeComponent(trimmedId)}');
            final statusRes = await http.get(uri).timeout(const Duration(milliseconds: 1800));
            if (statusRes.statusCode == 200) {
              final data = jsonDecode(statusRes.body);
              if (data['firstLoginCompleted'] == true) {
                isBackendVerified = true;
                if (candidate.isNotEmpty) ApiConfig.setWorkingBaseUrl(candidate);
                break;
              }
            }
          } catch (_) {}
        }

        if (!isBackendVerified) {
          throw Exception(
            'First-login SMS OTP verification required. Please verify the 6-digit code sent to your registered mobile number.',
          );
        }
      }

      final primaryEmail = _getAuthEmail(primaryStudentNo);

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

      candidateEmails.add(primaryEmail);
      candidateEmails.add(_getAuthEmail(trimmedId));
      addCandidatePassword(trimmedPassword);
      addCandidatePassword(trimmedId);
      addCandidatePassword(primaryStudentNo);

      for (final data in matchingRecords) {
        final sNo = data['student_no']?.toString().trim();
        final sId = data['studentId']?.toString().trim();
        final authEmailField = data['authEmail']?.toString().trim();
        final emailField = (data['email_address'] ?? data['email'])
            ?.toString()
            .trim();

        if (sNo != null && sNo.isNotEmpty) {
          candidateEmails.add(_getAuthEmail(sNo));
          addCandidatePassword(sNo);
        }
        if (sId != null && sId.isNotEmpty) {
          candidateEmails.add(_getAuthEmail(sId));
          addCandidatePassword(sId);
        }
        if (authEmailField != null && authEmailField.isNotEmpty) {
          candidateEmails.add(authEmailField);
        }
        if (emailField != null && emailField.isNotEmpty) {
          candidateEmails.add(emailField);
        }
      }

      debugPrint(
        'AuthService: Student candidate emails: $candidateEmails, candidate passwords: ${candidatePasswords.length} options',
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
                'AuthService: Student login SUCCESS with email: $candidateEmail (UID: ${authResponse.user?.id})',
              );
              break;
            }
          } on AuthException catch (e) {
            debugPrint(
              'AuthService: Student login attempt ($candidateEmail) -> ${e.message}',
            );
          }
        }
        if (authResponse != null && authResponse.user != null) {
          break;
        }
      }

      // Auto-provision student account if student exists in the database but Auth account does not
      if (authResponse == null || authResponse.user == null) {
        final autoProvisionPassword = formatAuthPassword(
          trimmedPassword.isNotEmpty ? trimmedPassword : primaryStudentNo,
        );

        debugPrint(
          'AuthService: Auto-provisioning student Auth account ($primaryEmail)...',
        );
        try {
          final signUpRes = await _supabase.auth.signUp(
            email: primaryEmail,
            password: autoProvisionPassword,
          );
          if (signUpRes.user != null) {
            authResponse = signUpRes;
            debugPrint(
              'AuthService: Auto-provisioning SUCCESS (UID: ${signUpRes.user!.id})',
            );
            if (isFromGranteesTable) {
              try {
                await _supabase
                    .from('student_grantees')
                    .update({'uid': signUpRes.user!.id})
                    .or('student_no.eq.$primaryStudentNo,studentId.eq.$primaryStudentNo');
              } catch (upErr) {
                debugPrint(
                  'AuthService: Auto-provision student UID link notice: $upErr',
                );
              }
            }
          }
        } catch (signUpErr) {
          debugPrint('AuthService: Auto-provisioning error: $signUpErr');
          final errStr = signUpErr.toString().toLowerCase();
          if (errStr.contains('already registered') ||
              errStr.contains('user already exists')) {
            throw Exception(
              'Incorrect password for Student ID "$trimmedId". Please enter your registered password.',
            );
          }
        }
      }
    }

    if (authResponse == null || authResponse.user == null) {
      throw Exception('Login failed. Please verify your ID and password.');
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

        bool isGranteeRecord = doc.isNotEmpty;

        // Fallback: If UID doesn't match yet, find by Student ID / email in student_grantees and automatically link UID
        if (doc.isEmpty) {
          debugPrint(
            'AuthService: Step 3 - No document for UID: $uid. Trying fallback lookup in student_grantees...',
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
            isGranteeRecord = true;
          }
        }

        if (doc.isEmpty) {
          debugPrint('AuthService: Step 3 REJECTED - No student grantee record in student_grantees for UID: $uid ($userEmail)');
          try {
            await _supabase.auth.signOut();
          } catch (_) {}
          throw Exception(
            'Access denied. Student ID "$trimmedId" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.',
          );
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
        // Cache uid on record in student_grantees ONLY if this record actually belongs to student_grantees
        if (isGranteeRecord && studentData['id'] != null && (studentData['uid'] == null || studentData['uid'] != uid)) {
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
          final String? studentPhone = studentData['mobile_number'] ??
              studentData['contactNumber'] ??
              studentData['phone_number'];

          final existingWelcome = await _supabase
              .from('notifications')
              .select('id')
              .eq('studentId', uid)
              .ilike('title', '%Welcome%')
              .limit(1);

          final existingWelcomeSms = await _supabase
              .from('sms_logs')
              .select('id')
              .or('grantee_uid.eq.$uid,student_id.eq.$trimmedId')
              .ilike('message', '%Welcome%')
              .limit(1);

          if (existingWelcome.isEmpty) {
            debugPrint(
              'AuthService: First login detected for $displayName - generating Welcome notification & SMS',
            );
            await _notificationService.sendNotification(
              studentId: uid,
              title: 'Welcome to ScholarDoc!',
              message:
                  'Welcome, $displayName! Your scholarship portal is ready. Check your profile, submitted documents, and stay updated on announcements.',
              type: 'success',
              phone: studentPhone,
              studentNo: trimmedId,
            );
          } else if (existingWelcomeSms.isEmpty) {
            // In-app notification already exists, but Welcome SMS was never delivered to student phone
            debugPrint(
              'AuthService: Welcome SMS pending delivery for $displayName ($studentPhone) - dispatching SMS',
            );
            final String smsContent =
                '[ScholarDoc] Welcome to ScholarDoc!: Welcome, $displayName! Your scholarship portal is ready. Check your profile, submitted documents, and stay updated on announcements.';
            await SmsService().sendStudentSms(
              studentId: trimmedId,
              phone: studentPhone,
              title: 'Welcome to ScholarDoc!',
              message: smsContent,
              eventType: 'success',
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
    NotificationService.reset();
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

    final fam = (data['familyDetails'] is Map) ? (data['familyDetails'] as Map) : {};

    // Normalize section
    final sectionVal = (data['section'] ?? fam['section'] ?? fam['section_name'] ?? '').toString();
    data['section'] = sectionVal;

    // Normalize Year became a scholar
    final scholarYear =
        data['scholarYearLevel'] ??
        data['year_became_scholar'] ??
        data['yearBecameScholar'] ??
        fam['scholarYearLevel'] ??
        fam['year_became_scholar'] ??
        fam['yearBecameScholar'] ??
        '';
    data['scholarYearLevel'] = scholarYear;
    data['year_became_scholar'] = scholarYear;
    data['yearBecameScholar'] = scholarYear;

    // Normalize Payouts received without forcing dummy 0
    final rawPayouts = data['payoutsReceived'] ??
        data['payouts_received'] ??
        fam['payoutsReceived'] ??
        fam['payouts_received'];
    data['payoutsReceived'] = rawPayouts;
    data['payouts_received'] = rawPayouts?.toString();

    // Merge user metadata if available
    final userMeta = _supabase.auth.currentUser?.userMetadata;
    if (userMeta != null) {
      if ((data['section'] == null || data['section'].toString().isEmpty) && userMeta['section'] != null) {
        data['section'] = userMeta['section'].toString();
      }
      if ((data['scholarYearLevel'] == null ||
              data['scholarYearLevel'].toString().isEmpty) &&
          userMeta['yearBecameScholar'] != null) {
        final val = userMeta['yearBecameScholar'].toString();
        data['scholarYearLevel'] = val;
        data['year_became_scholar'] = val;
        data['yearBecameScholar'] = val;
      }
      if (userMeta['payoutsReceived'] != null &&
          data['payoutsReceived'] == null) {
        data['payoutsReceived'] = userMeta['payoutsReceived'];
        data['payouts_received'] = userMeta['payoutsReceived'].toString();
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

      // Fallback: If no document by uid, attempt lookup by student ID, email, or user metadata
      final user = _supabase.auth.currentUser;
      if (user != null) {
        final email = (user.email ?? '').trim();
        final sId = email.contains('@')
            ? email.split('@').first.replaceAll('_', ' ').trim()
            : '';
        final cleanSid = sId.replaceAll(' ', '');

        final filterParts = <String>{};
        if (sId.isNotEmpty) {
          filterParts.add('student_no.eq.$sId');
          filterParts.add('studentId.eq.$sId');
        }
        if (cleanSid.isNotEmpty && cleanSid != sId) {
          filterParts.add('student_no.eq.$cleanSid');
          filterParts.add('studentId.eq.$cleanSid');
        }
        if (email.isNotEmpty) {
          filterParts.add('email_address.eq.$email');
          filterParts.add('email.eq.$email');
        }

        final metaStudentId = (user.userMetadata?['studentId'] ?? user.userMetadata?['student_no'])?.toString().trim();
        if (metaStudentId != null && metaStudentId.isNotEmpty) {
          filterParts.add('student_no.eq.$metaStudentId');
          filterParts.add('studentId.eq.$metaStudentId');
        }

        final metaEmail = (user.userMetadata?['email'] ?? user.userMetadata?['gmail'])?.toString().trim();
        if (metaEmail != null && metaEmail.isNotEmpty) {
          filterParts.add('email_address.eq.$metaEmail');
          filterParts.add('email.eq.$metaEmail');
        }

        final metaName = (user.userMetadata?['fullName'] ?? user.userMetadata?['full_name'])?.toString().trim();
        if (metaName != null && metaName.isNotEmpty) {
          filterParts.add('full_name.ilike.$metaName');
          filterParts.add('fullName.ilike.$metaName');
        }

        if (filterParts.isNotEmpty) {
          final byId = await _supabase
              .from('student_grantees')
              .select()
              .or(filterParts.join(','));
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
            // Link UID in background so future lookups and getStudentStream succeed instantly
            try {
              await _supabase
                  .from('student_grantees')
                  .update({'uid': uid})
                  .eq('id', list.first['id']);
            } catch (_) {}
            final normalized = _normalizeStudentData(list.first);
            return await _enrichStudentDataFromSchool(normalized);
          } else {
            // If not found in student_grantees, check school_students (read-only)
            try {
              final schoolFilter = <String>{};
              if (sId.isNotEmpty) schoolFilter.add('student_no.eq.$sId');
              if (cleanSid.isNotEmpty) schoolFilter.add('student_no.eq.$cleanSid');
              if (email.isNotEmpty) schoolFilter.add('email_address.eq.$email');
              if (metaStudentId != null && metaStudentId.isNotEmpty) schoolFilter.add('student_no.eq.$metaStudentId');
              if (metaEmail != null && metaEmail.isNotEmpty) schoolFilter.add('email_address.eq.$metaEmail');
              if (metaName != null && metaName.isNotEmpty) schoolFilter.add('full_name.ilike.$metaName');

              if (schoolFilter.isNotEmpty) {
                final schoolRes = await _supabase
                    .from('school_students')
                    .select()
                    .or(schoolFilter.join(','))
                    .limit(1);
                if (schoolRes.isNotEmpty) {
                  final normalized = _normalizeStudentData(schoolRes.first);
                  return normalized;
                }
              }
            } catch (_) {}
          }
        }

        // Final in-memory fallback from user metadata so profile never returns null for logged-in user
        final fallbackName = metaName ?? (sId.isNotEmpty ? sId : 'Scholar');
        return {
          'uid': uid,
          'fullName': fallbackName,
          'full_name': fallbackName,
          'email': email.isNotEmpty ? email : (metaEmail ?? ''),
          'email_address': email.isNotEmpty ? email : (metaEmail ?? ''),
          'student_no': sId,
          'studentId': sId,
          'status': 'No Submission Yet',
          'scholarship_name': 'CHED TES',
          'role': 'student',
        };
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

    // Ensure scholarYearLevel and payoutsReceived are also embedded in familyDetails JSON so they persist reliably
    Map<String, dynamic> famDetails = {};
    if (dbPayload['familyDetails'] is Map) {
      famDetails = Map<String, dynamic>.from(dbPayload['familyDetails'] as Map);
    } else {
      try {
        final existingRes = await _supabase
            .from('student_grantees')
            .select('familyDetails')
            .eq('uid', uid)
            .maybeSingle();
        if (existingRes != null && existingRes['familyDetails'] is Map) {
          famDetails = Map<String, dynamic>.from(existingRes['familyDetails'] as Map);
        }
      } catch (_) {}
    }

    if (updates.containsKey('scholarYearLevel') || updates.containsKey('yearBecameScholar')) {
      final sYear = (updates['scholarYearLevel'] ?? updates['yearBecameScholar'])?.toString();
      if (sYear != null && sYear.isNotEmpty) {
        famDetails['scholarYearLevel'] = sYear;
        famDetails['yearBecameScholar'] = sYear;
        famDetails['year_became_scholar'] = sYear;
      } else {
        famDetails.remove('scholarYearLevel');
        famDetails.remove('yearBecameScholar');
        famDetails.remove('year_became_scholar');
      }
    }
    if (updates.containsKey('payoutsReceived') || updates.containsKey('payouts_received')) {
      final pVal = updates['payoutsReceived'] ?? updates['payouts_received'];
      if (pVal != null && pVal.toString().isNotEmpty) {
        famDetails['payoutsReceived'] = pVal;
        famDetails['payouts_received'] = pVal.toString();
      } else {
        famDetails.remove('payoutsReceived');
        famDetails.remove('payouts_received');
      }
    }

    if (updates.containsKey('section')) {
      final secVal = updates['section']?.toString().trim();
      if (secVal != null && secVal.isNotEmpty) {
        famDetails['section'] = secVal;
      } else {
        famDetails.remove('section');
      }
    }

    dbPayload['familyDetails'] = famDetails;

    // Ensure documents JSON object is properly populated with banking and verification attachments
    Map<String, dynamic> docsPayload = {};
    if (dbPayload['documents'] is Map) {
      docsPayload = Map<String, dynamic>.from(dbPayload['documents'] as Map);
    } else {
      try {
        final existingDocsRes = await _supabase
            .from('student_grantees')
            .select('documents')
            .eq('uid', uid)
            .maybeSingle();
        if (existingDocsRes != null && existingDocsRes['documents'] is Map) {
          docsPayload = Map<String, dynamic>.from(existingDocsRes['documents'] as Map);
        }
      } catch (_) {}
    }

    // Preserve ATM Card Proof in documents
    if (dbPayload.containsKey('atmCardUrl') || dbPayload.containsKey('atm_card_url')) {
      final aUrl = dbPayload['atmCardUrl'] ?? dbPayload['atm_card_url'];
      if (aUrl != null) {
        docsPayload['atmCardUrl'] = aUrl;
        docsPayload['atm_card_url'] = aUrl;
      }
    }
    if (dbPayload.containsKey('atmCardFileName') || dbPayload.containsKey('atm_card_file_name')) {
      final aName = dbPayload['atmCardFileName'] ?? dbPayload['atm_card_file_name'];
      if (aName != null) {
        docsPayload['atmCardFileName'] = aName;
        docsPayload['atm_card_file_name'] = aName;
      }
    }

    // Preserve Deposit Slip Proof in documents
    if (dbPayload.containsKey('depositSlipUrl') || dbPayload.containsKey('deposit_slip_url')) {
      final dUrl = dbPayload['depositSlipUrl'] ?? dbPayload['deposit_slip_url'];
      if (dUrl != null) {
        docsPayload['depositSlipUrl'] = dUrl;
        docsPayload['deposit_slip_url'] = dUrl;
      }
    }
    if (dbPayload.containsKey('depositSlipFileName') || dbPayload.containsKey('deposit_slip_file_name')) {
      final dName = dbPayload['depositSlipFileName'] ?? dbPayload['deposit_slip_file_name'];
      if (dName != null) {
        docsPayload['depositSlipFileName'] = dName;
        docsPayload['deposit_slip_file_name'] = dName;
      }
    }

    if (dbPayload.containsKey('atmProofType') || dbPayload.containsKey('atm_proof_type')) {
      final pType = dbPayload['atmProofType'] ?? dbPayload['atm_proof_type'];
      if (pType != null) {
        docsPayload['atmProofType'] = pType;
        docsPayload['atm_proof_type'] = pType;
      }
    }

    dbPayload['documents'] = docsPayload;

    // Remove keys that are not individual table columns on student_grantees so PostgREST update will succeed
    dbPayload.remove('section');
    dbPayload.remove('depositSlipUrl');
    dbPayload.remove('deposit_slip_url');
    dbPayload.remove('depositSlipFileName');
    dbPayload.remove('deposit_slip_file_name');
    dbPayload.remove('atmProofType');
    dbPayload.remove('atm_proof_type');
    dbPayload.remove('requires_resubmission');

    // Always persist to Supabase Auth user metadata as an instant fail-safe
    try {
      await _supabase.auth.updateUser(UserAttributes(data: updates));
    } catch (e) {
      debugPrint('AuthService: Failed to update user metadata: $e');
    }

    // Determine student identifiers to update all companion tables and records
    String? studentNo;
    String? studentEmail;
    try {
      final currentRes = await _supabase
          .from('student_grantees')
          .select('student_no, studentId, email_address, email')
          .eq('uid', uid)
          .maybeSingle();
      if (currentRes != null) {
        studentNo = (currentRes['student_no'] ?? currentRes['studentId'])?.toString().trim();
        studentEmail = (currentRes['email_address'] ?? currentRes['email'])?.toString().trim();
      }
    } catch (_) {}

    // 1. Update student_grantees by UID
    try {
      await _supabase.from('student_grantees').update(dbPayload).eq('uid', uid);
    } catch (e) {
      debugPrint('AuthService: Retrying student_grantees update with safe fields: $e');
      final safePayload = <String, dynamic>{};
      const safeFields = [
        'full_name', 'fullName', 'mobile_number', 'contactNumber', 'program_name', 'course',
        'year_level', 'year', 'birthdate', 'gender', 'scholarship_name', 'status',
        'saNumber', 'sa_number', 'submissionPdfUrl', 'submission_pdf_url', 'submissionPdfName',
        'submission_pdf_name', 'atmCardUrl', 'atm_card_url', 'atmCardFileName', 'idFrontUrl',
        'id_front_url', 'idBackUrl', 'id_back_url', 'documents', 'familyDetails', 'submittedAt',
        'submitted_at', 'requiresResubmission', 'adminRemarks', 'admin_remarks', 'pdfVerified',
        'academicYear', 'academic_year', 'semester', 'stickerValidated', 'sticker_validated',
        'idValidationStatus', 'id_validation_status', 'saVerificationStatus', 'sa_verification_status'
      ];
      for (final key in safeFields) {
        if (dbPayload.containsKey(key)) safePayload[key] = dbPayload[key];
      }
      try {
        await _supabase.from('student_grantees').update(safePayload).eq('uid', uid);
      } catch (_) {}
    }

    // 2. Synchronize by student_no across student_grantees and school_students
    if (studentNo != null && studentNo.isNotEmpty && studentNo != 'N/A') {
      try {
        await _supabase.from('student_grantees').update(dbPayload).or('student_no.eq.$studentNo,studentId.eq.$studentNo');
      } catch (_) {}

      try {
        final schoolPayload = <String, dynamic>{};
        if (dbPayload.containsKey('full_name')) schoolPayload['full_name'] = dbPayload['full_name'];
        if (dbPayload.containsKey('mobile_number')) schoolPayload['mobile_number'] = dbPayload['mobile_number'];
        if (dbPayload.containsKey('date_of_birth')) schoolPayload['date_of_birth'] = dbPayload['date_of_birth'];
        if (dbPayload.containsKey('gender')) schoolPayload['gender'] = dbPayload['gender'];
        if (dbPayload.containsKey('program_name')) schoolPayload['program_name'] = dbPayload['program_name'];
        if (dbPayload.containsKey('year_level')) schoolPayload['year_level'] = dbPayload['year_level'];
        if (schoolPayload.isNotEmpty) {
          await _supabase.from('school_students').update(schoolPayload).eq('student_no', studentNo);
        }
      } catch (_) {}
    }

    // 3. Synchronize by email across student_grantees
    if (studentEmail != null && studentEmail.isNotEmpty && !studentEmail.endsWith('@scholardoc.com')) {
      try {
        await _supabase.from('student_grantees').update(dbPayload).or('email_address.eq.$studentEmail,email.eq.$studentEmail');
      } catch (_) {}
    }

    final studentDisplayName = (dbPayload['fullName'] ?? dbPayload['full_name'] ?? 'Student').toString();

    // 5. Notify Super Admin system and student directly via real-time notification
    try {
      await _supabase.from('notifications').insert([{
        'studentId': 'superadmin',
        'title': 'Student Profile Updated',
        'message': '$studentDisplayName updated their personal information.',
        'type': 'info',
        'isRead': false,
        'timestamp': DateTime.now().toIso8601String()
      }]);
    } catch (_) {}

    try {
      await _notificationService.sendNotification(
        studentId: uid,
        title: 'Profile Updated',
        message: 'Your personal information has been updated successfully.',
        type: 'success',
      );
    } catch (_) {}

    // 6. Automatically clear any existing missing requirements notice for this student
    try {
      await _notificationService.clearMissingRequirementsNotifications(uid);
    } catch (_) {}

    // 6. Log Activity in System Audit Log
    await _auditService.logActivity(
      action: 'Updated personal information',
      userName: studentDisplayName,
      role: 'Student',
      studentId: studentNo,
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
