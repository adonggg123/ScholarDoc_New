import 'package:cloud_firestore/cloud_firestore.dart';

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

  factory Scholarship.fromFirestore(DocumentSnapshot doc) {
    Map data = doc.data() as Map<String, dynamic>;
    return Scholarship(
      id: doc.id,
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
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Get active scholarships
  Stream<List<Scholarship>> getActiveScholarships() {
    return _firestore
        .collection('scholarships')
        .where('isActive', isEqualTo: true)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => Scholarship.fromFirestore(doc)).toList());
  }

  // Get all scholarships
  Stream<List<Scholarship>> getAllScholarships() {
    return _firestore
        .collection('scholarships')
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => Scholarship.fromFirestore(doc)).toList());
  }

  // Get a single scholarship by ID
  Future<Scholarship?> getScholarshipById(String id) async {
    try {
      final doc = await _firestore.collection('scholarships').doc(id).get();
      if (doc.exists) {
        return Scholarship.fromFirestore(doc);
      }
    } catch (e) {
      print('Error fetching scholarship by ID: $e');
    }
    return null;
  }

  // Add a scholarship
  Future<void> addScholarship(Scholarship scholarship) async {
    await _firestore.collection('scholarships').add(scholarship.toMap());
  }

  // Update a scholarship
  Future<void> updateScholarship(String id, Map<String, dynamic> updates) async {
    await _firestore.collection('scholarships').doc(id).update(updates);
  }

  // Delete a scholarship
  Future<void> deleteScholarship(String id) async {
    await _firestore.collection('scholarships').doc(id).delete();
  }

  Future<void> initializeDefaults() async {
    try {
      final snapshot = await _firestore.collection('scholarships').get();
      if (snapshot.docs.isEmpty) {
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
      print('ScholarshipService: Permission denied or error during init: $e');
    }
  }

  // Update all existing scholarships' requirements in Firestore
  Future<int> resetAllScholarshipRequirements() async {
    int updatedCount = 0;
    try {
      final snapshot = await _firestore.collection('scholarships').get();
      for (var doc in snapshot.docs) {
        await doc.reference.update({
          'requiredDocuments': [
            'SA Number',
            'ID Front & Back + Signatures (PDF)',
          ],
        });
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
      final snapshot = await _firestore
          .collection('scholarships')
          .where('name', isEqualTo: 'STUFAH')
          .get();
      
      for (var doc in snapshot.docs) {
        await doc.reference.update({'name': 'STUFAP'});
        updatedCount++;
      }
    } catch (e) {
      print('ScholarshipService: Error fixing typo: $e');
    }
    return updatedCount;
  }
}
