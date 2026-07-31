import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard, PermissionsGuard } from 'libs/common/src';
import { Permissions } from 'libs/common/src';

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('permissions.create')
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @Permissions('permissions.read')
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @Permissions('permissions.read')
  async findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('permissions.update')
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @Permissions('permissions.delete')
  async softDelete(@Param('id') id: string) {
    return this.permissionsService.softDelete(id);
  }

  @Patch(':id/restore')
  @Permissions('permissions.restore')
  async restore(@Param('id') id: string) {
    return this.permissionsService.restore(id);
  }
}
