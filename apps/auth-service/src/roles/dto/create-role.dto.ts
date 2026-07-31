import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, {
    message: 'name must contain only uppercase letters and underscores',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
