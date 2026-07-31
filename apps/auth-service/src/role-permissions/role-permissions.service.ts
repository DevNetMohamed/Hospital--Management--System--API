import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { ROLE_PERMISSION_MESSAGES } from './constants/role-permission-messages.constant';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { KafkaProducerService } from 'libs/kafka/src/KafkaProducerService';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    await this.validateRoleExists(roleId);

    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: {
        permission: true
      },
    });

    return rolePermissions.map((rp) => rp.permission).filter(Boolean);
  }

  async assignPermissionsToRole(
    roleId: string,
    assignDto: AssignPermissionsDto,
  ): Promise<RolePermission[]> {
    const uniqueIds = this.deduplicateIds(assignDto.permissionIds);

    return this.runInTransaction(async (manager) => {
      await this.validateRoleExists(roleId, manager);
      await this.validatePermissionsExist(uniqueIds, manager);

      const existing = await manager.find(RolePermission, {
        where: { roleId },
      });
      const existingSet = new Set(existing.map((rp) => rp.permissionId));
      const toAdd = uniqueIds.filter((id) => !existingSet.has(id));

      if (toAdd.length === 0) return existing;

      const newEntities = toAdd.map((permissionId) =>
        manager.create(RolePermission, { roleId, permissionId }),
      );

      const saved = await manager.save(RolePermission, newEntities);

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_PERMISSIONS_UPDATED, {
        roleId,
        addedPermissionIds: toAdd,
        updatedAt: new Date(),
      });

      return saved;
    }, ROLE_PERMISSION_MESSAGES.ASSIGN_FAILED);
  }

  async syncRolePermissions(
    roleId: string,
    syncDto: SyncPermissionsDto,
  ): Promise<RolePermission[]> {
    const uniqueIds = this.deduplicateIds(syncDto.permissionIds);

    return this.runInTransaction(async (manager) => {
      await this.validateRoleExists(roleId, manager);

      if (uniqueIds.length > 0) {
        await this.validatePermissionsExist(uniqueIds, manager);
      }

      await manager.softDelete(RolePermission, { roleId });

      const saved =
        uniqueIds.length === 0
          ? []
          : await manager.save(
              RolePermission,
              uniqueIds.map((permissionId) =>
                manager.create(RolePermission, { roleId, permissionId }),
              ),
            );

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_PERMISSIONS_SYNCED, {
        roleId,
        assignedPermissionIds: uniqueIds,
        updatedAt: new Date(),
      });

      return saved;
    }, ROLE_PERMISSION_MESSAGES.SYNC_FAILED);
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<{ message: string }> {
    return this.runInTransaction(async (manager) => {

      const result = await manager.softDelete(RolePermission, {
        roleId,
        permissionId,
      });

      if (!result.affected) {
        throw new NotFoundException(ROLE_PERMISSION_MESSAGES.MAPPING_NOT_FOUND);
      }

      await this.kafkaProducer.publish(KAFKA_TOPICS.ROLE_PERMISSIONS_UPDATED, {
        roleId,
        removedPermissionId: permissionId,
        updatedAt: new Date(),
      });

      return { message: ROLE_PERMISSION_MESSAGES.REMOVE_SUCCESS };
    }, ROLE_PERMISSION_MESSAGES.REMOVE_FAILED);
  }

  // --------------------------------------------------------------------
  // Private helpers

  private deduplicateIds(ids: string[]): string[] {
    return Array.from(new Set(ids));
  }

  private async validateRoleExists(
    roleId: string,
    manager?: EntityManager,
  ): Promise<Role> {
    const repo = manager ? manager.getRepository(Role) : this.roleRepository;
    const role = await repo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(ROLE_PERMISSION_MESSAGES.ROLE_NOT_FOUND);
    }
    return role;
  }

  private async validatePermissionsExist(
    permissionIds: string[],
    manager?: EntityManager,
  ): Promise<Permission[]> {
    if (permissionIds.length === 0) return [];
    const repo = manager
      ? manager.getRepository(Permission)
      : this.permissionRepository;
    const permissions = await repo.find({ where: { id: In(permissionIds) } });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException(
        ROLE_PERMISSION_MESSAGES.PERMISSIONS_INVALID,
      );
    }
    return permissions;
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
