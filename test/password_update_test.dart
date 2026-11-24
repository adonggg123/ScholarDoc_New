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
        isFalse,
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
    });
  });

  group('ChangePasswordScreen widget tests', () {
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

    testWidgets('validates form errors before invoking callback',
        (WidgetTester tester) async {
      bool called = false;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onUpdatePassword: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async {
              called = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final submitBtn = find.byKey(const Key('submit_change_password_button'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(called, isFalse);
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

      expect(called, isFalse);
      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('displays error banner when backend rejects current password',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordScreen(
            studentId: '2024-00123',
            onUpdatePassword: ({
              required String currentPassword,
              required String newPassword,
              required String confirmPassword,
            }) async {
              throw Exception(
                'Current password is incorrect. Please check and try again.',
              );
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

      expect(
        find.byKey(const Key('change_password_error_banner')),
        findsOneWidget,
      );
      expect(
        find.text('Current password is incorrect. Please check and try again.'),
        findsOneWidget,
      );
    });

    testWidgets('submits valid password update and pops route with true',
        (WidgetTester tester) async {
      String? capturedCurrent;
      String? capturedNew;
      String? capturedConfirm;
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
                          onUpdatePassword: ({
                            required String currentPassword,
                            required String newPassword,
                            required String confirmPassword,
                          }) async {
                            capturedCurrent = currentPassword;
                            capturedNew = newPassword;
                            capturedConfirm = confirmPassword;
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

      expect(capturedCurrent, equals('2024-00123'));
      expect(capturedNew, equals('Scholar@2026'));
      expect(capturedConfirm, equals('Scholar@2026'));
      expect(poppedResult, isTrue);
      expect(find.text('Open'), findsOneWidget);
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
