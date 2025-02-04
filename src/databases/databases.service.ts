import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import {
  Permission,
  PermissionDocument,
} from 'src/permissions/schemas/permission.schema';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { ADMIN_ROLE, INIT_PERMISSIONS, USER_ROLE } from './sample';

@Injectable()
export class DatabasesService implements OnModuleInit {
  private readonly logger = new Logger(DatabasesService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Permission.name)
    private readonly permissionModel: SoftDeleteModel<PermissionDocument>,

    @InjectModel(Role.name)
    private readonly roleModel: SoftDeleteModel<RoleDocument>,

    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {}

  async onModuleInit() {
    const shouldInit = this.configService.get<string>('SHOULD_INIT') === 'true';
    if (!shouldInit) return;

    const [hasUsers, hasPermissions, hasRoles] = await Promise.all([
      this.userModel.exists({}),
      this.permissionModel.exists({}),
      this.roleModel.exists({}),
    ]);

    // Create permissions if not exists
    if (!hasPermissions) {
      await this.permissionModel.insertMany(INIT_PERMISSIONS);
    }

    // Create roles if not exists
    if (!hasRoles) {
      const permissions = await this.permissionModel.find({}).select('_id');

      await this.roleModel.insertMany([
        {
          name: ADMIN_ROLE,
          description: 'Admin có toàn quyền hệ thống',
          isActive: true,
          permissions: permissions,
        },
        {
          name: USER_ROLE,
          description: 'Người dùng/Ứng viên sử dụng hệ thống',
          isActive: true,
          permissions: [],
        },
      ]);
    }

    // Create users if not exists
    if (!hasUsers) {
      const [adminRole, userRole] = await Promise.all([
        this.roleModel.findOne({ name: ADMIN_ROLE }),
        this.roleModel.findOne({ name: USER_ROLE }),
      ]);

      const initPassword = this.configService.get<string>('INIT_PASSWORD');
      if (!initPassword) {
        throw new Error(
          'INIT_PASSWORD is not defined in environment variables',
        );
      }

      const hashedPassword = this.userService.hashPassword(initPassword);

      await this.userModel.bulkWrite([
        {
          insertOne: {
            document: {
              name: "I'm admin",
              email: 'admin@gmail.com',
              password: hashedPassword,
              age: 69,
              gender: 'MALE',
              address: 'Vietnam',
              role: adminRole?._id,
            },
          },
        },
        {
          insertOne: {
            document: {
              name: "I'm Hỏi Dân IT",
              email: 'hoidanit@gmail.com',
              password: hashedPassword,
              age: 96,
              gender: 'MALE',
              address: 'Vietnam',
              role: adminRole?._id,
            },
          },
        },
        {
          insertOne: {
            document: {
              name: "I'm normal user",
              email: 'user@gmail.com',
              password: hashedPassword,
              age: 69,
              gender: 'MALE',
              address: 'Vietnam',
              role: userRole?._id,
            },
          },
        },
      ]);
    }

    this.logger.log('>>> SAMPLE DATA INITIALIZED SUCCESSFULLY');
  }
}
