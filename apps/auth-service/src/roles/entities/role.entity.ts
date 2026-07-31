import { Entity, Column, OneToMany, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RolePermission } from '../../role-permissions/entities/role-permission.entity';
import { BaseEntity } from 'libs/common/src';

@Entity('roles')
@Index('UQ_ROLE_NAME_ACTIVE', ['name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: false })
  isSystem: boolean;

  // One Role has many Users
  @OneToMany(() => User, (user) => user.role)
  users?: User[];

  // One Role has many RolePermissions
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions?: RolePermission[];
}
