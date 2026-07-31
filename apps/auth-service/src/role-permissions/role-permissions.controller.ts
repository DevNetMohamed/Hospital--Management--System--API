import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from 'libs/common/src';

@Controller('roles/:roleId/permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  @Get()
  @Permissions('roles.permissions.read')
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.rolePermissionsService.getRolePermissions(roleId);
  }

  @Post()
  @Permissions('roles.permissions.assign')
  async assignPermissions(
    @Param('roleId') roleId: string,
    @Body() assignDto: AssignPermissionsDto,
  ) {
    return this.rolePermissionsService.assignPermissionsToRole(
      roleId,
      assignDto,
    );
  }

  @Put('sync')
  @Permissions('roles.permissions.assign')
  async syncPermissions(
    @Param('roleId') roleId: string,
    @Body() assignDto: AssignPermissionsDto,
  ) {
    return this.rolePermissionsService.syncRolePermissions(roleId, assignDto);
  }

  @Delete(':permissionId')
  @Permissions('roles.permissions.remove')
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolePermissionsService.removePermissionFromRole(
      roleId,
      permissionId,
    );
  }
}
