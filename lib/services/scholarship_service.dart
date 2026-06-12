import 'package:supabase_flutter/supabase_flutter.dart';

class Scholarship {
  final String id;
  final String name;
  final String description;
  final bool isActive;
  final List<String> requiredDocuments;

  Scholarship({
    required this.id,
    required this.name,
    required this.description,
    required this.isActive,
    required this.requiredDocuments,
  });

  factory Scholarship.fromMap(Map<String, dynamic> data) {
    return Scholarship(
      id: data['id']?.toString() ?? '',
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      isActive: data['isActive'] ?? true,
      requiredDocuments: List<String>.from(data['requiredDocuments'] ?? []),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'description': description,
      'isActive': isActive,
      'requiredDocuments': requiredDocuments,
    };
  }
}

class ScholarshipService {
  final SupabaseClient _supabase = Supabase.instance.client;

  // Get active scholarships
  Stream<List<Scholarship>> getActiveScholarships() {
    return _supabase
        .from('scholarships')
        .stream(primaryKey: ['id'])
        .eq('isActive', true)
        .map((data) => data.map((map) => Scholarship.fromMap(map)).toList());
  }

  // Get all scholarships
  Stream<List<Scholarship>> getAllScholarships() {
    return _supabase
        .from('scholarships')
        .stream(primaryKey: ['id'])
        .map((data) => data.map((map) => Scholarship.fromMap(map)).toList());
  }

  // Get a single scholarship by ID
  Future<Scholarship?> getScholarshipById(String id) async {
    try {
      final data = await _supabase.from('scholarships').select().eq('id', id);
      if (data.isNotEmpty) {
        return Scholarship.fromMap(data.first);
      }
    } catch (e) {
      print('Error fetching scholarship by ID: $e');
    }
    return null;
  }

  // Add a scholarship
  Future<void> addScholarship(Scholarship scholarship) async {
    await _supabase.from('scholarships').insert(scholarship.toMap());
  }

  // Update a scholarship
  Future<void> updateScholarship(String id, Map<String, dynamic> updates) async {
    await _supabase.from('scholarships').update(updates).eq('id', id);
  }

  // Delete a scholarship
  Future<void> deleteScholarship(String id) async {
    await _supabase.from('scholarships').delete().eq('id', id);
  }

  Future<void> initializeDefaults() async {
    try {
      final data = await _supabase.from('scholarships').select().limit(1);
      if (data.isEmpty) {
        final defaults = [
          Scholarship(
            id: '',
            name: 'TES',
            description: 'Tertiary Education Subsidy',
            isActive: true,
            requiredDocuments: [
              'SA Number',
              'ID Front & Back + Signatures (PDF)',
            ],
          ),
          Scholarship(
            id: '',
            name: 'TDP',
            description: 'Tulong Dunong Program',
            isActive: true,
            requiredDocuments: [
              'SA Number',
              'ID Front & Back + Signatures (PDF)',
            ],
          ),
          Scholarship(
            id: '',
            name: 'DBP',
            description: 'DBP Rise Scholarship Program',
            isActive: true,
            requiredDocuments: [
              'SA Number',
              'ID Front & Back + Signatures (PDF)',
            ],
          ),
          Scholarship(
            id: '',
            name: 'SANTEH',
            description: 'SANTEH Aquaculture S&T Foundation',
            isActive: true,
            requiredDocuments: [
              'SA Number',
              'ID Front & Back + Signatures (PDF)',
            ],
          ),
          Scholarship(
            id: '',
            name: 'STUFAP',
            description: 'Student Financial Assistance Program',
            isActive: true,
            requiredDocuments: [
              'SA Number',
              'ID Front & Back + Signatures (PDF)',
            ],
          ),
        ];

        for (var s in defaults) {
          await addScholarship(s);
        }
      }
    } catch (e) {
      print('ScholarshipService: error during init: $e');
    }
  }

  // Update all existing scholarships' requirements
  Future<int> resetAllScholarshipRequirements() async {
    int updatedCount = 0;
    try {
      final data = await _supabase.from('scholarships').select();
      for (var doc in data) {
        await _supabase.from('scholarships').update({
          'requiredDocuments': [
            'SA Number',
            'ID Front & Back + Signatures (PDF)',
          ],
        }).eq('id', doc['id']);
        updatedCount++;
      }
    } catch (e) {
      print('ScholarshipService: Error resetting requirements: $e');
    }
    return updatedCount;
  }

  // Repair Tool: Fix the STUFAH -> STUFAP typo in the scholarships collection
  Future<int> fixScholarshipTypo() async {
    int updatedCount = 0;
    try {
      final data = await _supabase
          .from('scholarships')
          .select()
          .eq('name', 'STUFAH');
      
      for (var doc in data) {
        await _supabase.from('scholarships').update({'name': 'STUFAP'}).eq('id', doc['id']);
        updatedCount++;
      }
    } catch (e) {
      print('ScholarshipService: Error fixing typo: $e');
    }
    return updatedCount;
  }
}
