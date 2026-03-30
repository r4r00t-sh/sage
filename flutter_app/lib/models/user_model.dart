/// Department scope entry from `User.administeredDepartments` (M2M).
class AdministeredDepartmentRef {
  final String id;
  final String? name;
  final String? code;

  const AdministeredDepartmentRef({
    required this.id,
    this.name,
    this.code,
  });

  factory AdministeredDepartmentRef.fromJson(Map<String, dynamic> json) {
    return AdministeredDepartmentRef(
      id: json['id'] as String,
      name: json['name'] as String?,
      code: json['code'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        if (name != null) 'name': name,
        if (code != null) 'code': code,
      };
}

/// User model matching backend/Prisma and frontend store.
class UserModel {
  final String id;
  final String username;
  final String? email;
  final String name;
  final String? role;
  final List<String>? roles;
  final String? departmentId;
  final String? divisionId;
  final String? avatarKey;
  final List<AdministeredDepartmentRef> administeredDepartments;

  const UserModel({
    required this.id,
    required this.username,
    this.email,
    required this.name,
    this.role,
    this.roles,
    this.departmentId,
    this.divisionId,
    this.avatarKey,
    this.administeredDepartments = const [],
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawAd = json['administeredDepartments'] as List<dynamic>?;
    final administered = rawAd == null
        ? const <AdministeredDepartmentRef>[]
        : rawAd
            .whereType<Map>()
            .map((e) => AdministeredDepartmentRef.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ))
            .toList();
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String?,
      name: json['name'] as String,
      role: json['role'] as String?,
      roles: (json['roles'] as List<dynamic>?)?.cast<String>(),
      departmentId: json['departmentId'] as String?,
      divisionId: json['divisionId'] as String?,
      avatarKey: json['avatarKey'] as String?,
      administeredDepartments: administered,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'email': email,
        'name': name,
        'role': role,
        'roles': roles,
        'departmentId': departmentId,
        'divisionId': divisionId,
        'avatarKey': avatarKey,
        'administeredDepartments':
            administeredDepartments.map((d) => d.toJson()).toList(),
      };

  /// Primary role for navigation (same as frontend app-sidebar).
  String get primaryRole => (roles?.isNotEmpty == true) ? roles!.first : (role ?? 'SECTION_OFFICER');

  bool hasRole(String r) => roles?.contains(r) == true || role == r;
  bool hasAnyRole(List<String> list) => list.any(hasRole);

  /// Roles that use [administeredDepartments] / primary dept for org scope (matches backend).
  bool get hasMultiDepartmentRole =>
      hasAnyRole(['DEPT_ADMIN', 'APPROVAL_AUTHORITY']);

  /// Department IDs for inbox, admin filters, and department navigation (matches `getDepartmentalScopeDepartmentIds`).
  List<String> get departmentalScopeDepartmentIds {
    if (!hasMultiDepartmentRole) return [];
    final fromM2m = administeredDepartments.map((d) => d.id).toList();
    if (fromM2m.isNotEmpty) return fromM2m;
    if (departmentId != null) return [departmentId!];
    return [];
  }

  bool isDepartmentInScope(String departmentId) =>
      departmentalScopeDepartmentIds.contains(departmentId);

  /// Super Admin or Tech Panel (Developer) — full app / org-structure management.
  bool get hasGodRole => hasAnyRole(['DEVELOPER', 'SUPER_ADMIN']);

  /// Matches backend `DELETE /users/:id` authorization.
  bool get canPermanentlyDeleteUsers => hasAnyRole(['DEVELOPER', 'SUPER_ADMIN', 'SUPPORT']);
}
