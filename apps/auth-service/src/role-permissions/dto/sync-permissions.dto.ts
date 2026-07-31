import { IsArray, IsUUID } from 'class-validator';

export class SyncPermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
