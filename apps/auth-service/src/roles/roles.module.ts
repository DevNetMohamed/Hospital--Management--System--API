import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { KafkaModule } from 'libs/kafka/src';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role]),
    DatabaseModule,
    KafkaModule,
  ],
  providers: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
