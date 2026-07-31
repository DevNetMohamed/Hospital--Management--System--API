export const ROLE_MESSAGES = {
  ROLE_NOT_FOUND: 'Role not found',
  ROLE_ALREADY_EXISTS: 'Role name already exists',
  ROLE_NOT_DELETED: 'Role is not deleted',
  SYSTEM_ROLE_CANNOT_BE_MODIFIED: 'System roles cannot be modified or deleted',
  DELETE_SUCCESS: 'Role soft-deleted successfully',
  RESTORE_SUCCESS: 'Role restored successfully',
  CREATE_FAILED: 'Failed to create role',
  UPDATE_FAILED: 'Failed to update role',
  DELETE_FAILED: 'Failed to delete role',
  RESTORE_FAILED: 'Failed to restore role',
  FETCH_FAILED: 'Failed to fetch roles',
  roleInUse: (count: number) =>
    `Cannot delete role because it is currently assigned to ${count} active user(s)`,
};
