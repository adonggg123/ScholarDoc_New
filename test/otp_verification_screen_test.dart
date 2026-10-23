import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tesdoc_project/screens/auth/otp_verification_screen.dart';

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

  Widget createOtpTestWidget({
    String studentId = '2023304850',
    String password = '2023304850',
    String maskedPhone = '0985 •••• 627',
    int expiresIn = 300,
    int resendCooldown = 60,
  }) {
    return MaterialApp(
      home: OtpVerificationScreen(
        studentId: studentId,
        password: password,
        maskedPhone: maskedPhone,
        expiresIn: expiresIn,
        resendCooldown: resendCooldown,
      ),
    );
  }

  testWidgets('OtpVerificationScreen displays all core 2FA UI components',
      (WidgetTester tester) async {
    await tester.pumpWidget(createOtpTestWidget());

    // Header and titles
    expect(find.text('SMS OTP Verification'), findsOneWidget);
    expect(find.text('FIRST LOGIN 2FA VERIFICATION'), findsOneWidget);
    expect(find.text('0985 •••• 627'), findsOneWidget);

    // 6 input digit text fields
    expect(find.byType(TextFormField), findsNWidgets(6));

    // Expiration and resend indicators
    expect(find.textContaining('Code expires in'), findsOneWidget);
    expect(find.textContaining('Resend in 60s'), findsOneWidget);

    // Action buttons
    expect(find.text('VERIFY & SIGN IN'), findsOneWidget);
    expect(find.text('Use different Student ID'), findsOneWidget);

    // Semaphore footnote
    expect(find.text('Secured by Semaphore SMS Gateway'), findsOneWidget);

    // Pump forward by 5 seconds to test countdown
    await tester.pump(const Duration(seconds: 5));
    expect(find.textContaining('Resend in 55s'), findsOneWidget);
  });

  testWidgets('Validation error displayed if user enters fewer than 6 digits',
      (WidgetTester tester) async {
    await tester.pumpWidget(createOtpTestWidget());

    // Tap verify without entering all 6 digits
    await tester.tap(find.text('VERIFY & SIGN IN'));
    await tester.pump();

    expect(
      find.text('Please enter all 6 digits of the OTP sent to your phone.'),
      findsOneWidget,
    );
  });

  testWidgets('Resend button enables when cooldown expires',
      (WidgetTester tester) async {
    // Start with 2 seconds cooldown
    await tester.pumpWidget(createOtpTestWidget(resendCooldown: 2));

    expect(find.textContaining('Resend in 2s'), findsOneWidget);

    // Advance timer past cooldown
    await tester.pump(const Duration(seconds: 3));

    // Resend button should now be active
    expect(find.text('Resend Code via SMS'), findsOneWidget);
  });
}
