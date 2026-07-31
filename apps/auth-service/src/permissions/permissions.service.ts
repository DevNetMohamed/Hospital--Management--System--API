import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { KafkaProducerService } from 'libs/kafka/src/KafkaProducerService';
import { PERMISSION_MESSAGES } from './constants/permission-messages.constant';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    return this.runInTransaction(async (manager) => {
      const name = this.normalizeName(createPermissionDto.name);
      await this.assertNameIsAvailable(manager, name);

      const permission = manager.create(Permission, {
        ...createPermissionDto,
        name,
      });
      const savedPermission = await manager.save(Permission, permission);

      await this.kafkaProducer.publish(KAFKA_TOPICS.PERMISSION_CREATED, {
        permissionId: savedPermission.id,
        name: savedPermission.name,
        createdAt: savedPermission.createdAt,
      });

      return savedPermission;
    }, PERMISSION_MESSAGES.CREATE_FAILED);
  }

  async findAll(): Promise<Permission[]> {
    try {
      return await this.permissionRepository.find();
    } catch {
      throw new InternalServerErrorException(PERMISSION_MESSAGES.FETCH_FAILED);
    }
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(PERMISSION_MESSAGES.PERMISSION_NOT_FOUND);
    }
    return permission;
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    return this.runInTransaction(async (manager) => {
      const permission = await manager.findOne(Permission, { where: { id } });
      if (!permission) {
        throw new NotFoundException(PERMISSION_MESSAGES.PERMISSION_NOT_FOUND);
      }

      if (updatePermissionDto.name) {
        const name = this.normalizeName(updatePermissionDto.name);
        await this.assertNameIsAvailable(manager, name, id);
        permission.name = name;
      }

      if (updatePermissionDto.description !== undefined) {
        permission.description = updatePermissionDto.description;
      }

      if (updatePermissionDto.isActive !== undefined) {
        permission.isActive = updatePermissionDto.isActive;
      }

      const updatedPermission = await manager.save(Permission, permission);

      await this.kafkaProducer.publish(KAFKA_TOPICS.PERMISSION_UPDATED, {
        permissionId: updatedPermission.id,
        name: updatedPermission.name,
        isActive: updatedPermission.isActive,
        updatedAt: new Date(),
      });

      return updatedPermission;
    }, PERMISSION_MESSAGES.UPDATE_FAILED);
  }

  async softDelete(id: string): Promise<{ message: string }> {
    return this.runInTransaction(async (manager) => {
      const permission = await manager.findOne(Permission, { where: { id } });
      if (!permission) {
        throw new NotFoundException(PERMISSION_MESSAGES.PERMISSION_NOT_FOUND);
      }

      await manager.softRemove(Permission, permission);

      await this.kafkaProducer.publish(KAFKA_TOPICS.PERMISSION_DELETED, {
        permissionId: permission.id,
        deletedAt: new Date(),
      });

      return { message: PERMISSION_MESSAGES.DELETE_SUCCESS };
    }, PERMISSION_MESSAGES.DELETE_FAILED);
  }

  async restore(id: string): Promise<Permission> {
    return this.runInTransaction(async (manager) => {
      const permission = await manager.findOne(Permission, {
        where: { id },
        withDeleted: true,
      });

      if (!permission) {
        throw new NotFoundException(PERMISSION_MESSAGES.PERMISSION_NOT_FOUND);
      }
      if (!permission.deletedAt) {
        throw new BadRequestException(PERMISSION_MESSAGES.PERMISSION_NOT_DELETED);
      }

      await manager.restore(Permission, id);
      const restoredPermission = await manager.findOneOrFail(Permission, {
        where: { id },
      });

      await this.kafkaProducer.publish(KAFKA_TOPICS.PERMISSION_RESTORED, {
        permissionId: restoredPermission.id,
        name: restoredPermission.name,
        restoredAt: new Date(),
      });

      return restoredPermission;
    }, PERMISSION_MESSAGES.RESTORE_FAILED);
  }

  // --------------------------------------------------------------------
  // Private helpers


  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  private async assertNameIsAvailable(
    manager: EntityManager,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await manager.findOne(Permission, { where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(PERMISSION_MESSAGES.PERMISSION_ALREADY_EXISTS);
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