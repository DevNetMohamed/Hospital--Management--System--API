import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
