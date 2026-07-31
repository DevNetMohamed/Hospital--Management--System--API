import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsGuard } from 'libs/common/src/guards/permissions.guard';
import { Permissions } from 'libs/common/src/decorators/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from 'libs/common/src/guards/jwt-auth.guard';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('roles.create')
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @Permissions('roles.read')
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions('roles.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('roles.update')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.updateRole(id, updateRoleDto);
  }

  @Delete(':id')
  @Permissions('roles.delete')
  async softDeleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.softDeleteRole(id);
  }

  @Patch(':id/restore')
  @Permissions('roles.restore')
  async restoreRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.restoreRole(id);
  }
}
