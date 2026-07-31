import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService, SafeUser } from '../users/users.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { LoginDto } from './dto/login.dto';
import { Permission } from '../permissions/entities/permission.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolePermissionsService: RolePermissionsService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.validateCredentials(
      loginDto.email,
      loginDto.password,
    );

    const rolePermissions =
      await this.rolePermissionsService.getRolePermissions(user.roleId);

    const payload = this.buildJwtPayload(user, rolePermissions);

    const accessToken = await this.generateAccessToken(payload);

    return {
      accessToken,
      user,
    };
  }

  private buildJwtPayload(
    user: SafeUser,
    permissions: Permission[],
  ): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: this.extractPermissionNames(permissions),
    };
  }

  private extractPermissionNames(permissions: Permission[]): string[] {
    return permissions.map((permission) => permission.name);
  }

  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
