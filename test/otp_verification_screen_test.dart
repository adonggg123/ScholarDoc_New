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
    String? maskedEmail,
    String initialChannel = 'sms',
    bool smsAvailable = true,
    bool emailAvailable = true,
    String initialDeliveryStatus = 'sent',
    String? initialDeliveryMessage,
    String? initialDeliveryError,
    Map<String, int>? initialChannelCooldowns,
    int expiresIn = 300,
    int resendCooldown = 60,
  }) {
    return MaterialApp(
      home: OtpVerificationScreen(
        studentId: studentId,
        password: password,
        maskedPhone: maskedPhone,
        maskedEmail: maskedEmail,
        initialChannel: initialChannel,
        smsAvailable: smsAvailable,
        emailAvailable: emailAvailable,
        initialDeliveryStatus: initialDeliveryStatus,
        initialDeliveryMessage: initialDeliveryMessage,
        initialDeliveryError: initialDeliveryError,
        initialChannelCooldowns: initialChannelCooldowns,
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

    // Dual-channel selector options (SMS | Email)
    expect(find.byKey(const Key('otp_channel_sms')), findsOneWidget);
    expect(find.byKey(const Key('otp_channel_email')), findsOneWidget);
    expect(
      find.byKey(const Key('otp_delivery_status_banner')),
      findsOneWidget,
    );

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

  testWidgets('Email delivery mode renders Email OTP UI, status, and validation',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      createOtpTestWidget(
        initialChannel: 'email',
        maskedEmail: 'ja••••05@gmail.com',
        resendCooldown: 0,
      ),
    );

    expect(find.text('Email OTP Verification'), findsOneWidget);
    expect(find.text('ja••••05@gmail.com'), findsOneWidget);
    expect(
      find.textContaining('Email OTP Sent'),
      findsOneWidget,
    );
    expect(find.text('Resend Code via Email'), findsOneWidget);
    expect(
      find.text('Secured by ScholarDoc SMTP Security Gateway'),
      findsOneWidget,
    );

    await tester.tap(find.text('VERIFY & SIGN IN'));
    await tester.pump();

    expect(
      find.text('Please enter all 6 digits of the OTP sent to your email.'),
      findsOneWidget,
    );
  });

  testWidgets(
      'Switching channels updates per-channel cooldowns and blocks unlinked channels cleanly',
      (WidgetTester tester) async {
    // 1. Test unlinked Email channel validation
    await tester.pumpWidget(
      createOtpTestWidget(
        emailAvailable: false,
      ),
    );

    await tester.tap(find.byKey(const Key('otp_channel_email')));
    await tester.pump();

    expect(
      find.text(
        'No valid email address is registered on your account. Please verify via SMS.',
      ),
      findsOneWidget,
    );
    expect(find.text('SMS OTP Verification'), findsOneWidget);

    // 2. Test switching between active SMS & Email sessions with independent cooldowns
    await tester.pumpWidget(
      createOtpTestWidget(
        maskedEmail: 'sc••••23@ustp.edu.ph',
        initialChannel: 'sms',
        initialChannelCooldowns: {'sms': 28, 'email': 14},
      ),
    );

    expect(find.textContaining('Resend in 28s'), findsOneWidget);

    await tester.tap(find.byKey(const Key('otp_channel_email')));
    await tester.pump();

    expect(find.text('Email OTP Verification'), findsOneWidget);
    expect(find.text('sc••••23@ustp.edu.ph'), findsOneWidget);
    expect(find.textContaining('Resend in 14s'), findsOneWidget);
  });

  testWidgets('Failed delivery status shows recovery feedback and alternate switch CTA',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      createOtpTestWidget(
        initialChannel: 'sms',
        maskedEmail: 'ja••••05@gmail.com',
        initialDeliveryStatus: 'failed',
      ),
    );

    expect(
      find.text('SMS delivery delayed or failed'),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('otp_switch_alternate_action')),
      findsOneWidget,
    );
    expect(find.text('Try Email'), findsOneWidget);
  });
}
