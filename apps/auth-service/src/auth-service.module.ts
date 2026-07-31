import { Module } from '@nestjs/common';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermissionsModule } from './role-permissions/role-permissions.module';
import { DatabaseModule } from '@app/database';
import { KafkaModule } from 'libs/kafka/src';
import { AppConfigModule } from '@app/config';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule.register('auth'),
    KafkaModule.register({
      clientId: 'auth-service',
      consumerGroup: 'auth-service-consumer',
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}
