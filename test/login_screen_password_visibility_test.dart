import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tesdoc_project/screens/auth/login_screen.dart';

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

  testWidgets('Password visibility toggle displays correct eye icons and toggles obscureText', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: LoginScreen(),
      ),
    );
    await tester.pumpAndSettle();

    // Find the password TextField using its hint text '••••••••'
    final passwordFieldFinder = find.byWidgetPredicate(
      (widget) => widget is TextField && widget.decoration?.hintText == '••••••••',
    );
    expect(passwordFieldFinder, findsOneWidget);

    bool isPasswordObscured() {
      final textField = tester.widget<TextField>(passwordFieldFinder);
      return textField.obscureText;
    }

    // 1. Initial State: password should be obscured (hidden)
    // Suffix icon MUST be Eye-Off (hidden password)
    expect(isPasswordObscured(), isTrue, reason: 'Password should initially be obscured');
    expect(find.byIcon(LucideIcons.eyeOff), findsOneWidget, reason: 'Initial icon should be Eye-Off when password is hidden');
    expect(find.byIcon(LucideIcons.eye), findsNothing, reason: 'Eye icon should not be visible when password is hidden');

    // 2. Tap the visibility toggle button
    final eyeOffIconFinder = find.byIcon(LucideIcons.eyeOff);
    final toggleButtonFinder = find.ancestor(
      of: eyeOffIconFinder,
      matching: find.byType(IconButton),
    );
    expect(toggleButtonFinder, findsOneWidget);
    await tester.tap(toggleButtonFinder);
    await tester.pumpAndSettle();

    // Password should now be visible (not obscured)
    // Suffix icon MUST be Eye (visible password)
    expect(isPasswordObscured(), isFalse, reason: 'Password should be visible after toggle');
    expect(find.byIcon(LucideIcons.eye), findsOneWidget, reason: 'Icon should be Eye when password is visible');
    expect(find.byIcon(LucideIcons.eyeOff), findsNothing, reason: 'Eye-Off icon should not be shown when password is visible');

    // 3. Tap the toggle button again to hide password
    final eyeIconFinder = find.byIcon(LucideIcons.eye);
    final toggleButtonFinder2 = find.ancestor(
      of: eyeIconFinder,
      matching: find.byType(IconButton),
    );
    await tester.tap(toggleButtonFinder2);
    await tester.pumpAndSettle();

    // Password should now be hidden again (obscured)
    // Suffix icon MUST revert to Eye-Off (hidden password)
    expect(isPasswordObscured(), isTrue, reason: 'Password should be obscured again');
    expect(find.byIcon(LucideIcons.eyeOff), findsOneWidget, reason: 'Icon should revert to Eye-Off when hidden');
    expect(find.byIcon(LucideIcons.eye), findsNothing, reason: 'Eye icon should not be displayed when password is hidden');
  });
}
