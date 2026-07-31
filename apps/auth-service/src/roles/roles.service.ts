import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { KafkaProducerService } from 'libs/kafka/src/KafkaProducerService';
import { ROLE_MESSAGES } from './constants/role-messages.constant';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    return this.runInTransaction(async (manager) => {
      const name = this.normalizeName(createRoleDto.name);
      await this.assertNameIsAvailable(manager, name);

      const role = manager.create(Role, {
        ...createRoleDto,
        name,
      });
      const savedRole = await manager.save(Role, role);

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_CREATED, {
        roleId: savedRole.id,
        name: savedRole.name,
        description: savedRole.description,
        createdAt: savedRole.createdAt,
      });

      return savedRole;
    }, ROLE_MESSAGES.CREATE_FAILED);
  }

  async findAll(): Promise<Role[]> {
    try {
      return await this.roleRepository.find();
    } catch {
      throw new InternalServerErrorException(ROLE_MESSAGES.FETCH_FAILED);
    }
  }

  async findOne(roleId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: {
        rolePermissions: true
      }
    });

    if (!role) {
      throw new NotFoundException(ROLE_MESSAGES.ROLE_NOT_FOUND);
    }
    return role;
  }

  async updateRole(
    roleId: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<Role> {
    return this.runInTransaction(async (manager) => {
      const role = await manager.findOne(Role, { where: { id: roleId } });
      if (!role) {
        throw new NotFoundException(ROLE_MESSAGES.ROLE_NOT_FOUND);
      }
      if (role.isSystem) {
        throw new BadRequestException(
          ROLE_MESSAGES.SYSTEM_ROLE_CANNOT_BE_MODIFIED,
        );
      }

      if (updateRoleDto.name) {
        const name = this.normalizeName(updateRoleDto.name);
        await this.assertNameIsAvailable(manager, name, roleId);
        role.name = name;
      }

      if (updateRoleDto.description !== undefined) {
        role.description = updateRoleDto.description;
      }

      const updatedRole = await manager.save(Role, role);

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_UPDATED, {
        roleId: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        updatedAt: new Date(),
      });

      return updatedRole;
    }, ROLE_MESSAGES.UPDATE_FAILED);
  }

  async softDeleteRole(roleId: string): Promise<{ message: string }> {
    return this.runInTransaction(async (manager) => {
      const role = await manager.findOne(Role, {
        where: { id: roleId },
        relations: { users: true },
      });

      if (!role) {
        throw new NotFoundException(ROLE_MESSAGES.ROLE_NOT_FOUND);
      }
      if (role.isSystem) {
        throw new BadRequestException(
          ROLE_MESSAGES.SYSTEM_ROLE_CANNOT_BE_MODIFIED,
        );
      }
      if (role.users && role.users.length > 0) {
        throw new ConflictException(ROLE_MESSAGES.roleInUse(role.users.length));
      }

      await manager.softRemove(Role, role);

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_DELETED, {
        roleId: role.id,
        name: role.name,
        deletedAt: new Date(),
      });

      return { message: ROLE_MESSAGES.DELETE_SUCCESS };
    }, ROLE_MESSAGES.DELETE_FAILED);
  }

  async restoreRole(roleId: string): Promise<Role> {
    return this.runInTransaction(async (manager) => {
      const role = await manager.findOne(Role, {
        where: { id: roleId },
        withDeleted: true,
      });

      if (!role) {
        throw new NotFoundException(ROLE_MESSAGES.ROLE_NOT_FOUND);
      }
      if (!role.deletedAt) {
        throw new BadRequestException(ROLE_MESSAGES.ROLE_NOT_DELETED);
      }

      await manager.restore(Role, roleId);
      const restoredRole = await manager.findOneOrFail(Role, {
        where: { id: roleId },
      });

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_RESTORED, {
        roleId: restoredRole.id,
        name: restoredRole.name,
        restoredAt: new Date(),
      });

      return restoredRole;
    }, ROLE_MESSAGES.RESTORE_FAILED);
  }

  // --------------------------------------------------------------------
  // Private helpers

  private normalizeName(name: string): string {
    return name.trim().toUpperCase();
  }

  private async assertNameIsAvailable(
    manager: EntityManager,
    name: string,
    excludeRoleId?: string,
  ): Promise<void> {
    const existing = await manager.findOne(Role, { where: { name } });
    if (existing && existing.id !== excludeRoleId) {
      throw new ConflictException(ROLE_MESSAGES.ROLE_ALREADY_EXISTS);
    }
  }

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
