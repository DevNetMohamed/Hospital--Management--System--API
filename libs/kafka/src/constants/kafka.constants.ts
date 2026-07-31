export const KAFKA_SERVICE = 'KAFKA_SERVICE';

export const KAFKA_TOPICS = {
  ROLE_CREATED: 'auth.role.created',
  ROLE_UPDATED: 'auth.role.update',
  ROLE_DELETED: 'auth.role.softDelete',
  ROLE_RESTORED: 'auth.role.restored',
  PERMISSION_CREATED: 'permission.create',
  PERMISSION_UPDATED: 'permission.update',
  PERMISSION_DELETED: 'permission.delete',
  PERMISSION_RESTORED: 'permission.restored',
  ROLE_PERMISSIONS_UPDATED:'role.permission.updated',
  ROLE_PERMISSIONS_SYNCED:'role.permission.synced',
  USER_RESTORED: 'user.restored',
  USER_DELETED:'user-deleted',
  USER_PASSWORD_CHANGED:'user-password-changed',
  USER_UPDATED:'user-updated',
  USER_CREATED:'user-created',
  PASSWORD_RESET_REQUESTED: 'user.password-reset-requested',

} as const;

export type KafkaTopics = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
