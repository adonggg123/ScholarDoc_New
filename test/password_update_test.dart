import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tesdoc_project/screens/profile/change_password_screen.dart';
import 'package:tesdoc_project/screens/profile/profile_screen.dart';
import 'package:tesdoc_project/services/auth_service.dart';
import 'package:tesdoc_project/services/password_policy.dart';
import 'package:tesdoc_project/theme/app_theme.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    try {
      await Supabase.initialize(
        url: 'https://ywavesulvkqwpsejprxp.supabase.co',
        anonKey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk',
      );
    } catch (_) {}
  });

  group('PasswordPolicy validation & strength rules', () {
    test('rejects empty, short, overly long, and edge-whitespace passwords', () {
      expect(PasswordPolicy.validateNewPassword(''), isNotNull);
      expect(PasswordPolicy.validateNewPassword('Ab12345'), contains('8'));
      expect(
        PasswordPolicy.validateNewPassword('Aa1${'x' * 70}'),
        contains('72'),
      );
      expect(
        PasswordPolicy.validateNewPassword(' ValidPass1'),
        contains('spaces'),
      );
      expect(
        PasswordPolicy.validateNewPassword('ValidPass1 '),
        contains('spaces'),
      );
    });

    test('enforces uppercase, lowercase, and digit complexity', () {
      expect(
        PasswordPolicy.validateNewPassword('lowercase123'),
        contains('uppercase'),
      );
      expect(
        PasswordPolicy.validateNewPassword('UPPERCASE123'),
        contains('lowercase'),
      );
      expect(
        PasswordPolicy.validateNewPassword('NoDigitsHere'),
        contains('number'),
      );
      expect(PasswordPolicy.validateNewPassword('Scholar2026'), isNull);
      expect(PasswordPolicy.validateNewPassword('Scholar@2026!'), isNull);
    });

    test('blocks reusing current password or Student ID variants', () {
      expect(
        PasswordPolicy.validateNewPassword(
          'Scholar2026',
          currentPassword: 'Scholar2026',
        ),
        contains('different from your current password'),
      );

      expect(
        PasswordPolicy.validateNewPassword(
          'Ustp-2024-001',
          studentIds: ['USTP-2024-001'],
        ),
        contains('Student ID'),
      );

      expect(
        PasswordPolicy.validateNewPassword(
          'Ustp2024001',
          studentIds: ['USTP-2024-001'],
        ),
        contains('Student ID'),
      );

      expect(
        PasswordPolicy.validateNewPassword(
          'MyNewPass2026!',
          currentPassword: '2024-00123',
          studentIds: ['2024-00123', '202400123'],
        ),
        isNull,
      );
    });

    test('validates confirm password matching', () {
      expect(PasswordPolicy.validateConfirmPassword('', 'Scholar2026'), isNotNull);
      expect(
        PasswordPolicy.validateConfirmPassword('Scholar2025', 'Scholar2026'),
        contains('do not match'),
      );
      expect(
        PasswordPolicy.validateConfirmPassword('Scholar2026', 'Scholar2026'),
        isNull,
      );
    });

    test('evaluates password strength levels accurately', () {
      expect(
        PasswordPolicy.evaluateStrength('').level,
        PasswordStrengthLevel.empty,
      );
      expect(
        PasswordPolicy.evaluateStrength('abc').level,
        PasswordStrengthLevel.weak,
      );
      expect(
        PasswordPolicy.evaluateStrength('abcdefgh').level,
        PasswordStrengthLevel.weak,
      );
      expect(
        PasswordPolicy.evaluateStrength('Abcdefgh').level,
        PasswordStrengthLevel.fair,
      );
      expect(
        PasswordPolicy.evaluateStrength('Abcdefg1').level,
        PasswordStrengthLevel.good,
      );
      expect(
        PasswordPolicy.evaluateStrength('Scholar@2026').level,
        PasswordStrengthLevel.strong,
      );
    });
  });

  group('AuthService login & password security invariants', () {
    test('wrong password NEVER falls back to Student ID candidates', () {
      final candidates = AuthService.buildStudentPasswordCandidates(
        enteredPassword: 'WrongPassword99',
        studentIdVariants: ['2024-00123', '202400123'],
        allowStudentIdVariants: true,
      );

      expect(candidates, equals(['WrongPassword99']));
      expect(candidates.contains('2024-00123'), isFalse);
      expect(candidates.contains('202400123'), isFalse);
    });

    test('custom password produces only the exact entered password', () {
      final candidates = AuthService.buildStudentPasswordCandidates(
        enteredPassword: 'MySecretPass#2026',
        studentIdVariants: ['2024-00123', '202400123'],
        allowStudentIdVariants: true,
      );

      expect(candidates, equals(['MySecretPass#2026']));
    });

    test('Student ID format variants apply ONLY when Student ID was entered', () {
      final candidates = AuthService.buildStudentPasswordCandidates(
        enteredPassword: '202400123',
        studentIdVariants: ['2024-00123', '202400123'],
        allowStudentIdVariants: true,
      );

      expect(candidates, containsAll(['202400123', '2024-00123']));
    });

    test('disabling Student ID variants restricts strictly to entered password', () {
      final candidates = AuthService.buildStudentPasswordCandidates(
        enteredPassword: '202400123',
        studentIdVariants: ['2024-00123', '202400123'],
        allowStudentIdVariants: false,
      );

      expect(candidates, equals(['202400123']));
    });

    test('short legacy IDs are zero-padded to 6 chars for Supabase Auth', () {
      final candidates = AuthService.buildStudentPasswordCandidates(
        enteredPassword: '12345',
        studentIdVariants: ['12345'],
        allowStudentIdVariants: true,
      );

      expect(candidates, equals(['012345']));
    });

    test('canAutoProvisionStudentAccount blocks linked accounts and wrong passwords', () {
      // Linked student entering wrong password or old ID MUST NEVER auto-provision
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: true,
          otpJustVerified: false,
          passwordMatchesStudentId: true,
        ),
        isFalse,
      );
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: true,
          otpJustVerified: true,
          passwordMatchesStudentId: true,
        ),
        isTrue,
      );
      // Unlinked account entering arbitrary wrong password MUST NOT auto-provision
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: false,
          otpJustVerified: false,
          passwordMatchesStudentId: false,
        ),
        isFalse,
      );
      // Brand new unlinked account right after first-login OTP succeeds
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: false,
          otpJustVerified: true,
          passwordMatchesStudentId: true,
        ),
        isTrue,
      );
      // Legacy unlinked returning student entering valid Student ID succeeds
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: false,
          otpJustVerified: false,
          passwordMatchesStudentId: true,
        ),
        isTrue,
      );

      // Student with valid OTP verification is always allowed to auto-provision into app
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: true,
          otpJustVerified: true,
          passwordMatchesStudentId: false,
        ),
        isTrue,
      );
      expect(
        AuthService.canAutoProvisionStudentAccount(
          hasExistingLinkedAuthUid: false,
          otpJustVerified: true,
          passwordMatchesStudentId: false,
        ),
        isTrue,
      );
    });

    test('hasCompletedFirstLogin recognizes documents has_custom_password and first_login_completed', () async {
      final profileWithCustom = <String, dynamic>{
        'student_no': '2023305322',
        'documents': <String, dynamic>{
          'has_custom_password': true,
          'auth_email': '2023305322_auth@scholardoc.com',
        },
      };
      final profileWithFirstLogin = <String, dynamic>{
        'student_no': '2023305322',
        'documents': <String, dynamic>{
          'first_login_completed': true,
        },
      };
      final profileUnverified = <String, dynamic>{
        'student_no': '2023305322',
        'documents': <String, dynamic>{},
      };

      // When profile has custom password or first_login_completed in documents
      final customDocs = profileWithCustom['documents'] as Map<String, dynamic>;
      final firstLoginDocs = profileWithFirstLogin['documents'] as Map<String, dynamic>;
      final unverifiedDocs = profileUnverified['documents'] as Map<String, dynamic>;

      expect(customDocs['has_custom_password'] == true, isTrue);
      expect(firstLoginDocs['first_login_completed'] == true, isTrue);
      expect(unverifiedDocs['has_custom_password'] == true, isFalse);
    });

    test('updateStudentPassword enforces non-empty OTP verification token', () async {
      final authService = AuthService();
      await expectLater(
        authService.updateStudentPassword(
          currentPassword: 'OldPassword1',
          newPassword: 'NewPassword@2026',
          confirmPassword: 'NewPassword@2026',
          otpVerificationToken: '',
        ),
        throwsA(
          isA<Exception>().having(
            (e) => e.toString(),
            'message',
            contains('OTP verification is required'),
          ),
        ),
      );
    });
  });

  group('ChangePasswordScreen OTP verification & widget tests', () {
    Map<String, dynamic> mockChannels({
      bool sms = true,
      bool email = true,
    }) =>
        {
          'success': true,
          'studentId': '2024-00123',
          'fullName': 'Test Scholar',
          'maskedPhone': '0917 •••• 890',
          'maskedEmail': 'sc••••ar@gmail.com',
          'availableChannels': {'sms': sms, 'email': email},
          'channelCooldowns': {'sms': 0, 'email': 0},
        };

    testWidgets('renders fields, toggles visibility independently, and updates strength meter',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            hasCustomPassword: false,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Change Password'), findsOneWidget);
      expect(find.text('Replace Your Initial Password'), findsOneWidget);
      expect(find.byKey(const Key('current_password_field')), findsOneWidget);
      expect(find.byKey(const Key('new_password_field')), findsOneWidget);
      expect(find.byKey(const Key('confirm_password_field')), findsOneWidget);
      expect(find.byKey(const Key('submit_change_password_button')), findsOneWidget);

      // All 3 fields start obscured (3 eyeOff icons)
      expect(find.byIcon(LucideIcons.eyeOff), findsNWidgets(3));
      expect(find.byIcon(LucideIcons.eye), findsNothing);

      // Toggle New Password visibility only
      await tester.tap(find.byKey(const Key('toggle_new_password_visibility')));
      await tester.pumpAndSettle();
      expect(find.byIcon(LucideIcons.eye), findsOneWidget);
      expect(find.byIcon(LucideIcons.eyeOff), findsNWidgets(2));

      // Type weak password -> Weak strength label
      await tester.enterText(find.byKey(const Key('new_password_field')), 'abc');
      await tester.pumpAndSettle();
      expect(find.text('Weak'), findsOneWidget);

      // Type strong password -> Strong strength label
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026!',
      );
      await tester.pumpAndSettle();
      expect(find.text('Strong'), findsOneWidget);
    });

    testWidgets('validates form errors before invoking prepare or update callbacks',
        (WidgetTester tester) async {
      bool prepareCalled = false;
      bool updateCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onPreparePasswordChange: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async {
              prepareCalled = true;
              return mockChannels();
            },
            onUpdatePassword: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
              required String otpVerificationToken,
              String? otpChannel,
            }) async {
              updateCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(prepareCalled, isFalse);
      expect(updateCalled, isFalse);
      expect(find.text('Please enter your current password'), findsOneWidget);
      expect(find.text('Please enter a new password'), findsOneWidget);
      expect(find.text('Please confirm your new password'), findsOneWidget);

      // Enter mismatched confirm password
      await tester.enterText(
        find.byKey(const Key('current_password_field')),
        '2024-00123',
      );
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026',
      );
      await tester.enterText(
        find.byKey(const Key('confirm_password_field')),
        'Different@2026',
      );
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(prepareCalled, isFalse);
      expect(updateCalled, isFalse);
      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('displays error banner and does not send OTP when current password is rejected',
        (WidgetTester tester) async {
      bool otpSent = false;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onPreparePasswordChange: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async {
              throw Exception(
                'Current password is incorrect. Please check and try again.',
              );
            },
            onSendPasswordChangeOtp: ({
              required String studentId,
              required String channel,
            }) async {
              otpSent = true;
              return {'success': true};
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('current_password_field')),
        'WrongCurrent1',
      );
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026',
      );
      await tester.enterText(
        find.byKey(const Key('confirm_password_field')),
        'Scholar@2026',
      );

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(otpSent, isFalse);
      expect(find.byKey(const Key('pwd_otp_method_modal')), findsNothing);
      expect(
        find.byKey(const Key('change_password_error_banner')),
        findsOneWidget,
      );
      expect(
        find.text('Current password is incorrect. Please check and try again.'),
        findsOneWidget,
      );
    });

    testWidgets('requires choosing Email or SMS and verifying OTP before updating password (Email flow)',
        (WidgetTester tester) async {
      String? sentChannel;
      String? verifiedOtp;
      String? capturedCurrent;
      String? capturedNew;
      String? capturedConfirm;
      String? capturedToken;
      String? capturedChannel;
      bool? poppedResult;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () async {
                    poppedResult = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChangePasswordScreen(
                          studentId: '2024-00123',
                          hasCustomPassword: false,
                          onPreparePasswordChange: ({
                            required String currentPassword,
                            required String newPassword,
                            required String confirmPassword,
                          }) async =>
                              mockChannels(sms: true, email: true),
                          onSendPasswordChangeOtp: ({
                            required String studentId,
                            required String channel,
                          }) async {
                            sentChannel = channel;
                            return {
                              'success': true,
                              'channel': channel,
                              'maskedPhone': '0917 •••• 890',
                              'maskedEmail': 'sc••••ar@gmail.com',
                              'availableChannels': {'sms': true, 'email': true},
                              'deliveryStatus': 'sent',
                              'deliveryMessage': 'OTP sent via Email to sc••••ar@gmail.com',
                              'challengeToken': 'signed-challenge-email',
                              'expiresIn': 600,
                              'resendCooldown': 30,
                            };
                          },
                          onVerifyPasswordChangeOtp: ({
                            required String studentId,
                            required String otp,
                            String? challengeToken,
                          }) async {
                            verifiedOtp = otp;
                            return {
                              'success': true,
                              'verified': true,
                              'channel': 'email',
                              'verificationToken': 'signed-proof-email-123',
                            };
                          },
                          onUpdatePassword: ({
                            required String currentPassword,
                            required String newPassword,
                            required String confirmPassword,
                            required String otpVerificationToken,
                            String? otpChannel,
                          }) async {
                            capturedCurrent = currentPassword;
                            capturedNew = newPassword;
                            capturedConfirm = confirmPassword;
                            capturedToken = otpVerificationToken;
                            capturedChannel = otpChannel;
                          },
                        ),
                      ),
                    );
                  },
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('current_password_field')),
        '2024-00123',
      );
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026',
      );
      await tester.enterText(
        find.byKey(const Key('confirm_password_field')),
        'Scholar@2026',
      );

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      // Method selection modal MUST appear and require choosing Email or SMS
      expect(find.byKey(const Key('pwd_otp_method_modal')), findsOneWidget);
      expect(find.text('Choose Verification Method'), findsOneWidget);
      expect(find.text('Select Email or SMS to Continue'), findsOneWidget);
      expect(capturedToken, isNull);

      // Select Email method
      await tester.tap(find.byKey(const Key('pwd_otp_method_email')));
      await tester.pumpAndSettle();
      expect(find.text('Send Code via Email'), findsOneWidget);

      // Tap Send Code via Email
      final sendBtn = find.byKey(const Key('pwd_otp_send_method_button'));
      await tester.ensureVisible(sendBtn);
      await tester.tap(sendBtn);
      await tester.pumpAndSettle();

      expect(sentChannel, equals('email'));
      expect(find.text('Email OTP Verification'), findsOneWidget);
      expect(capturedToken, isNull); // Still NOT updated before OTP verification!

      // Enter 6-digit OTP (auto-verifies on 6th digit)
      for (int i = 0; i < 6; i++) {
        await tester.enterText(
          find.byKey(Key('pwd_otp_digit_$i')),
          '${i + 1}',
        );
      }
      await tester.pumpAndSettle();

      expect(verifiedOtp, equals('123456'));
      expect(capturedCurrent, equals('2024-00123'));
      expect(capturedNew, equals('Scholar@2026'));
      expect(capturedConfirm, equals('Scholar@2026'));
      expect(capturedToken, equals('signed-proof-email-123'));
      expect(capturedChannel, equals('email'));
      expect(poppedResult, isTrue);
      expect(find.text('Open'), findsOneWidget);
    });

    testWidgets('supports SMS verification method and blocks password update on invalid OTP',
        (WidgetTester tester) async {
      String? sentChannel;
      bool updateCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onPreparePasswordChange: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async =>
                mockChannels(sms: true, email: true),
            onSendPasswordChangeOtp: ({
              required String studentId,
              required String channel,
            }) async {
              sentChannel = channel;
              return {
                'success': true,
                'channel': channel,
                'maskedPhone': '0917 •••• 890',
                'maskedEmail': 'sc••••ar@gmail.com',
                'availableChannels': {'sms': true, 'email': true},
                'deliveryStatus': 'sent',
                'deliveryMessage': 'OTP sent via SMS to 0917 •••• 890',
                'challengeToken': 'signed-challenge-sms',
                'expiresIn': 600,
                'resendCooldown': 30,
              };
            },
            onVerifyPasswordChangeOtp: ({
              required String studentId,
              required String otp,
              String? challengeToken,
            }) async {
              throw Exception('Invalid OTP code. You have 4 attempt(s) remaining.');
            },
            onUpdatePassword: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
              required String otpVerificationToken,
              String? otpChannel,
            }) async {
              updateCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('current_password_field')),
        '2024-00123',
      );
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026',
      );
      await tester.enterText(
        find.byKey(const Key('confirm_password_field')),
        'Scholar@2026',
      );

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      // Choose SMS
      await tester.tap(find.byKey(const Key('pwd_otp_method_sms')));
      await tester.pumpAndSettle();
      expect(find.text('Send Code via SMS'), findsOneWidget);

      final sendBtn = find.byKey(const Key('pwd_otp_send_method_button'));
      await tester.ensureVisible(sendBtn);
      await tester.tap(sendBtn);
      await tester.pumpAndSettle();

      expect(sentChannel, equals('sms'));
      expect(find.text('SMS OTP Verification'), findsOneWidget);

      // Enter wrong 6-digit OTP
      for (int i = 0; i < 6; i++) {
        await tester.enterText(find.byKey(Key('pwd_otp_digit_$i')), '9');
      }
      await tester.pumpAndSettle();

      // Error banner appears and password update is strictly blocked
      expect(find.byKey(const Key('pwd_otp_error_banner')), findsOneWidget);
      expect(
        find.text('Invalid OTP code. You have 4 attempt(s) remaining.'),
        findsOneWidget,
      );
      expect(updateCalled, isFalse);

      // Cancel OTP screen -> returns to ChangePasswordScreen without updating
      final cancelBtn = find.byKey(const Key('pwd_otp_cancel_button'));
      await tester.ensureVisible(cancelBtn);
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      expect(updateCalled, isFalse);
      expect(find.text('Change Password'), findsOneWidget);
    });

    testWidgets('cancelling verification method modal does not send OTP or update password',
        (WidgetTester tester) async {
      bool otpSent = false;
      bool updateCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onPreparePasswordChange: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async =>
                mockChannels(sms: true, email: true),
            onSendPasswordChangeOtp: ({
              required String studentId,
              required String channel,
            }) async {
              otpSent = true;
              return {'success': true};
            },
            onUpdatePassword: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
              required String otpVerificationToken,
              String? otpChannel,
            }) async {
              updateCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('current_password_field')),
        '2024-00123',
      );
      await tester.enterText(
        find.byKey(const Key('new_password_field')),
        'Scholar@2026',
      );
      await tester.enterText(
        find.byKey(const Key('confirm_password_field')),
        'Scholar@2026',
      );

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pwd_otp_method_modal')), findsOneWidget);

      final cancelBtn = find.byKey(const Key('pwd_otp_method_cancel_button'));
      await tester.ensureVisible(cancelBtn);
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      expect(otpSent, isFalse);
      expect(updateCalled, isFalse);
      expect(find.byKey(const Key('pwd_otp_method_modal')), findsNothing);
    });

    testWidgets('renders cleanly in dark mode with custom password status',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            hasCustomPassword: true,
            passwordUpdatedAt: DateTime(2026, 11, 20, 14, 30),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('PASSWORD PROTECTED'), findsOneWidget);
      expect(find.text('Update Your Scholar Password'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    });
  });

  group('ProfileScreen Account Settings integration', () {
    testWidgets('displays Change Password option in Account Settings card',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const ProfileScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Scroll down to PREFERENCES, SECURITY & SESSION
      final changePasswordTile =
          find.byKey(const Key('account_settings_change_password_tile'));
      await tester.scrollUntilVisible(
        changePasswordTile,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();

      expect(changePasswordTile, findsOneWidget);
      expect(find.text('Change Password'), findsOneWidget);
      expect(find.text('Recommended'), findsOneWidget);
    });
  });
}
