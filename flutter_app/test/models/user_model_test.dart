import 'package:flutter_test/flutter_test.dart';
import 'package:efiling_app/models/user_model.dart';

void main() {
  group('UserModel', () {
    test('fromJson parses required and optional fields', () {
      final json = {
        'id': 'u1',
        'username': 'jdoe',
        'name': 'John Doe',
        'email': 'j@example.com',
        'role': 'SECTION_OFFICER',
        'departmentId': 'd1',
      };
      final u = UserModel.fromJson(json);
      expect(u.id, 'u1');
      expect(u.username, 'jdoe');
      expect(u.name, 'John Doe');
      expect(u.email, 'j@example.com');
      expect(u.role, 'SECTION_OFFICER');
      expect(u.departmentId, 'd1');
    });

    test('primaryRole returns first role from roles when present', () {
      final u = UserModel(
        id: 'u1',
        username: 'u',
        name: 'U',
        roles: ['ADMIN', 'SECTION_OFFICER'],
      );
      expect(u.primaryRole, 'ADMIN');
    });

    test('primaryRole returns role when roles is empty', () {
      final u = UserModel(
        id: 'u1',
        username: 'u',
        name: 'U',
        role: 'DIVISION_HEAD',
      );
      expect(u.primaryRole, 'DIVISION_HEAD');
    });

    test('primaryRole returns SECTION_OFFICER when both role and roles missing', () {
      final u = UserModel(id: 'u1', username: 'u', name: 'U');
      expect(u.primaryRole, 'SECTION_OFFICER');
    });

    test('hasRole returns true when role matches', () {
      final u = UserModel(
        id: 'u1',
        username: 'u',
        name: 'U',
        role: 'ADMIN',
      );
      expect(u.hasRole('ADMIN'), true);
      expect(u.hasRole('SECTION_OFFICER'), false);
    });

    test('hasRole returns true when roles list contains role', () {
      final u = UserModel(
        id: 'u1',
        username: 'u',
        name: 'U',
        roles: ['ADMIN', 'DIVISION_HEAD'],
      );
      expect(u.hasRole('ADMIN'), true);
      expect(u.hasRole('DIVISION_HEAD'), true);
      expect(u.hasRole('OTHER'), false);
    });

    test('hasAnyRole returns true if any role matches', () {
      final u = UserModel(
        id: 'u1',
        username: 'u',
        name: 'U',
        roles: ['SECTION_OFFICER'],
      );
      expect(u.hasAnyRole(['ADMIN', 'SECTION_OFFICER']), true);
      expect(u.hasAnyRole(['ADMIN', 'DIVISION_HEAD']), false);
    });

    test('toJson round-trips with fromJson', () {
      final json = {
        'id': 'u1',
        'username': 'jdoe',
        'name': 'John',
        'email': 'j@x.com',
        'role': 'ADMIN',
        'departmentId': 'd1',
      };
      final u = UserModel.fromJson(json);
      final out = u.toJson();
      expect(out['id'], u.id);
      expect(out['username'], u.username);
      expect(out['name'], u.name);
      expect(out['email'], u.email);
      expect(out['role'], u.role);
      expect(out['departmentId'], u.departmentId);
    });

    test('administeredDepartments and departmentalScopeDepartmentIds', () {
      final json = {
        'id': 'u1',
        'username': 'a',
        'name': 'A',
        'roles': ['DEPT_ADMIN'],
        'departmentId': 'primary',
        'administeredDepartments': [
          {'id': 'd1', 'name': 'Dept One', 'code': 'D1'},
          {'id': 'd2', 'name': 'Dept Two'},
        ],
      };
      final u = UserModel.fromJson(json);
      expect(u.administeredDepartments.length, 2);
      expect(u.administeredDepartments[0].id, 'd1');
      expect(u.administeredDepartments[0].name, 'Dept One');
      expect(u.departmentalScopeDepartmentIds, ['d1', 'd2']);
      expect(u.isDepartmentInScope('d1'), true);
      expect(u.isDepartmentInScope('primary'), false);
    });

    test('departmentalScope falls back to departmentId when M2M empty', () {
      final u = UserModel(
        id: 'u1',
        username: 'a',
        name: 'A',
        roles: ['APPROVAL_AUTHORITY'],
        departmentId: 'only',
      );
      expect(u.departmentalScopeDepartmentIds, ['only']);
    });
  });
}
