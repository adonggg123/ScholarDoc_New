const fs = require('fs');

let c = fs.readFileSync('lib/services/auth_service.dart', 'utf8');
const target = "debugPrint('AuthService: school_students sync notice: $e');\r\n      }";

const addition = `
      // 2b. Synchronize updated fields into annex_form_2 table
      try {
        final annexPayload = <String, dynamic>{};
        final newEmail = _pickValidEmail([
          cleanDbPayload['email_address'],
          cleanDbPayload['email'],
        ]);
        if (newEmail.isNotEmpty) {
          annexPayload['email_address'] = newEmail;
        }

        final newPhone = _pickNonEmpty([
          cleanDbPayload['mobile_number'],
          cleanDbPayload['contactNumber'],
        ]);
        if (newPhone.isNotEmpty) {
          annexPayload['phone_number'] = newPhone;
        }

        final newBirthdate = _pickNonEmpty([
          cleanDbPayload['date_of_birth'],
          cleanDbPayload['birthdate'],
        ]);
        if (newBirthdate.isNotEmpty) {
          annexPayload['birthdate'] = newBirthdate;
        }

        final newCourse = _pickNonEmpty([
          cleanDbPayload['program_name'],
          cleanDbPayload['course'],
        ]);
        if (newCourse.isNotEmpty) {
          annexPayload['degree_program'] = newCourse;
        }

        final newYear = _pickNonEmpty([
          cleanDbPayload['year_level'],
          cleanDbPayload['year'],
        ]);
        if (newYear.isNotEmpty) {
          final match = RegExp(r'\\d+').firstMatch(newYear);
          annexPayload['year_level'] = match != null ? match.group(0) : newYear;
        }

        final newGender = _pickNonEmpty([
          cleanDbPayload['gender'],
        ]);
        if (newGender.isNotEmpty) {
          annexPayload['sex_at_birth'] = (newGender.toLowerCase().startsWith('m')) ? 'M' : 'F';
        }

        final newSa = _pickNonEmpty([
          cleanDbPayload['sa_number'],
          cleanDbPayload['saNumber'],
        ]);
        if (newSa.isNotEmpty && newSa.toUpperCase() != 'N/A') {
          annexPayload['tes_application_number'] = newSa;
        }

        if (annexPayload.isNotEmpty) {
          annexPayload['updated_at'] = nowIso;
          await _supabase
              .from('annex_form_2')
              .update(annexPayload)
              .eq('student_number', studentNo);
        }
      } catch (e) {
        debugPrint('AuthService: annex_form_2 sync notice: $e');
      }`;

if (!c.includes(target)) {
  console.error('Target string not found');
  process.exit(1);
}

c = c.replace(target, target + '\r\n' + addition);
fs.writeFileSync('lib/services/auth_service.dart', c, 'utf8');
console.log('Successfully updated lib/services/auth_service.dart');

