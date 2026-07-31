import { Module } from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service';
import { RolePermissionsController } from './role-permissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from './entities/role-permission.entity';
import { KafkaModule } from 'libs/kafka/src';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [
    TypeOrmModule.forFeature([RolePermission, Role, Permission]),
    DatabaseModule,
    KafkaModule,
  ],
  providers: [RolePermissionsService],
  controllers: [RolePermissionsController],
  exports: [RolePermissionsService],
})
export class RolePermissionsModule {}
