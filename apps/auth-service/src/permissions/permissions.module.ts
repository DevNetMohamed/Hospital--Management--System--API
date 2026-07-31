import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { KafkaModule } from 'libs/kafka/src';
import { DatabaseModule } from '@app/database';
@Module({
    imports: [TypeOrmModule.forFeature([Permission]), DatabaseModule, KafkaModule],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],

})
export class PermissionsModule {}
