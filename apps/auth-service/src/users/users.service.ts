import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-Password.dto';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { KafkaProducerService } from 'libs/kafka/src/KafkaProducerService';
import { USER_MESSAGES } from './constants/User-messages.constant';

const SALT_ROUNDS = 10;

export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<SafeUser> {
    return this.runInTransaction(async (manager) => {
      const email = this.normalizeEmail(createUserDto.email);
      await this.assertEmailIsAvailable(manager, email);
      await this.assertRoleExists(manager, createUserDto.roleId);

      const passwordHash = await bcrypt.hash(
        createUserDto.password,
        SALT_ROUNDS,
      );

      const user = manager.create(User, {
        ...createUserDto,
        email,
        password: passwordHash,
      });
      const savedUser = await manager.save(User, user);

      await this.kafkaProducer.publish(KAFKA_TOPICS.USER_CREATED, {
        userId: savedUser.id,
        email: savedUser.email,
        roleId: savedUser.roleId,
        createdAt: savedUser.createdAt,
      });

      return this.toSafeUser(savedUser);
    }, USER_MESSAGES.CREATE_FAILED);
  }

  async findAll(): Promise<SafeUser[]> {
    try {
      const users = await this.userRepository.find();
      return users.map((user) => this.toSafeUser(user));
    } catch {
      throw new InternalServerErrorException(USER_MESSAGES.FETCH_FAILED);
    }
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
    }
    return this.toSafeUser(user);
  }

  /**
   * Used by AuthService's login flow. Deliberately throws the same generic
   * message whether the email doesn't exist or the password is wrong - never
   * reveal which one it was. Soft-deleted users are excluded automatically
   * (no `withDeleted: true` here), so a deactivated account can't log in.
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<SafeUser> {
    const normalizedEmail = this.normalizeEmail(email);

    // `password` has `select: false` and `role` has `eager: true` on the
    // entity - `eager` only applies to repository find methods, not
    // QueryBuilder, so the role relation needs an explicit join here to come
    // back populated (AuthService needs `user.role.name` for the JWT payload).
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(USER_MESSAGES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(USER_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.toSafeUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<SafeUser> {
    return this.runInTransaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
      }

      if (updateUserDto.email) {
        const email = this.normalizeEmail(updateUserDto.email);
        await this.assertEmailIsAvailable(manager, email, id);
        user.email = email;
      }

      if (updateUserDto.roleId) {
        await this.assertRoleExists(manager, updateUserDto.roleId);
        user.roleId = updateUserDto.roleId;
      }

      if (updateUserDto.firstName !== undefined) {
        user.firstName = updateUserDto.firstName;
      }

      if (updateUserDto.lastName !== undefined) {
        user.lastName = updateUserDto.lastName;
      }

      const updatedUser = await manager.save(User, user);

      await this.kafkaProducer.publish(KAFKA_TOPICS.USER_UPDATED, {
        userId: updatedUser.id,
        email: updatedUser.email,
        roleId: updatedUser.roleId,
        updatedAt: new Date(),
      });

      return this.toSafeUser(updatedUser);
    }, USER_MESSAGES.UPDATE_FAILED);
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.runInTransaction(async (manager) => {
      // `password` has `select: false` on the entity, so it must be opted
      // into explicitly here - a plain findOne would come back without it.
      const user = await manager
        .createQueryBuilder(User, 'user')
        .addSelect('user.password')
        .where('user.id = :id', { id })
        .getOne();

      if (!user) {
        throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        throw new BadRequestException(
          USER_MESSAGES.CURRENT_PASSWORD_INCORRECT,
        );
      }

      user.password = await bcrypt.hash(
        changePasswordDto.newPassword,
        SALT_ROUNDS,
      );
      await manager.save(User, user);

      await this.kafkaProducer.publish(KAFKA_TOPICS.USER_PASSWORD_CHANGED, {
        userId: user.id,
        changedAt: new Date(),
      });

      return { message: USER_MESSAGES.PASSWORD_CHANGED_SUCCESS };
    }, USER_MESSAGES.CHANGE_PASSWORD_FAILED);
  }

  async softDelete(id: string): Promise<{ message: string }> {
    return this.runInTransaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
      }

      await manager.softRemove(User, user);

      await this.kafkaProducer.publish(KAFKA_TOPICS.USER_DELETED, {
        userId: user.id,
        deletedAt: new Date(),
      });

      return { message: USER_MESSAGES.DELETE_SUCCESS };
    }, USER_MESSAGES.DELETE_FAILED);
  }

  async restore(id: string): Promise<SafeUser> {
    return this.runInTransaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
      }
      if (!user.deletedAt) {
        throw new BadRequestException(USER_MESSAGES.USER_NOT_DELETED);
      }

      await manager.restore(User, id);
      const restoredUser = await manager.findOneOrFail(User, {
        where: { id },
      });

      await this.kafkaProducer.publish(KAFKA_TOPICS.USER_RESTORED, {
        userId: restoredUser.id,
        email: restoredUser.email,
        restoredAt: new Date(),
      });

      return this.toSafeUser(restoredUser);
    }, USER_MESSAGES.RESTORE_FAILED);
  }

  // --------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toSafeUser(user: User): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private async assertEmailIsAvailable(
    manager: EntityManager,
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await manager.findOne(User, { where: { email } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(USER_MESSAGES.EMAIL_ALREADY_EXISTS);
    }
  }

  private async assertRoleExists(
    manager: EntityManager,
    roleId: string,
  ): Promise<void> {
    const role = await manager.findOne(Role, { where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(USER_MESSAGES.ROLE_NOT_FOUND);
    }
  }

  /**
   * Same pattern as RolesService / PermissionsService / RolePermissionsService:
   * commit on success, roll back on any error, rethrow known domain errors
   * as-is, and convert anything unexpected into a generic 500.
   */
  private async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
    fallbackMessage: string,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (this.isKnownDomainError(error)) {
        throw error;
      }
      throw new InternalServerErrorException(fallbackMessage);
    } finally {
      await queryRunner.release();
    }
  }

  private isKnownDomainError(error: unknown): boolean {
    return (
      error instanceof NotFoundException ||
      error instanceof ConflictException ||
      error instanceof BadRequestException
    );
  }
}