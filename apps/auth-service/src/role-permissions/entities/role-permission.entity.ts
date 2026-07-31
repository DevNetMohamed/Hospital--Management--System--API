import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { BaseEntity } from 'libs/common/src';

@Entity('role_permissions')
@Index('UQ_ROLE_PERMISSION_ACTIVE', ['roleId', 'permissionId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class RolePermission extends BaseEntity {
  @Column({ type: 'uuid' })
  roleId: string;

  @Column({ type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;
}
