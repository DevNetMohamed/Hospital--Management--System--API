// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   JoinColumn,
// } from 'typeorm';
// import { Role } from '../../roles/entities/role.entity';
// import { BaseEntity } from 'libs/common/src';

// @Entity('users')
// export class User extends BaseEntity {
//   @Column({
//     unique: true,
//   })
//   email: string;

//   @Column()
//   password: string;

//   @Column()
//   firstName: string;

//   @Column()
//   lastName: string;

//   @ManyToOne(() => Role, (role) => role.users, {
//     eager: true,
//     nullable: false,
//   })
//   @JoinColumn({
//     name: 'roleId',
//   })
//   role: Role;

//   roleId: string;
// }



import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { BaseEntity } from 'libs/common/src';

@Entity('users')
@Index('UQ_USER_EMAIL_ACTIVE', ['email'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class User extends BaseEntity {

  @Column()
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, (role) => role.users, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: 'roleId' })
  role: Role;
}