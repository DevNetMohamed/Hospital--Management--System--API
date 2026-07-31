import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { DatabaseModule } from '@app/database';
import { KafkaModule } from 'libs/kafka/src';
import { AppConfigModule } from '@app/config';

@Module({
  imports: [

    TypeOrmModule.forFeature([User, Role]),
    DatabaseModule,
    KafkaModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
