import { Entity, Column, OneToMany } from 'typeorm';
import { RolePermission } from '../../role-permissions/entities/role-permission.entity';
import { BaseEntity } from 'libs/common/src';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Column({
    unique: true,
    length: 100,
  })
  name: string;

  @Column({
    nullable: true,
    length: 255,
  })
  description?: string;

  @Column({
    default: true,
  })
  isActive: boolean;

  // One Permission belongs to many RolePermissions
  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions?: RolePermission[];
}