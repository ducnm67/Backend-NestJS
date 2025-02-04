import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/users/user.interface';
import aqp from 'api-query-params';
import mongoose from 'mongoose';
import { ADMIN_ROLE } from 'src/databases/sample';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private roleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async create(role: CreateRoleDto, user: IUser) {
    const roleIsExist = await this.roleModel
      .findOne({ name: role.name })
      .lean();
    if (roleIsExist) {
      throw new BadRequestException(`Role ${role.name} đã tồn tại!`);
    }

    const newRole = await this.roleModel.create({
      ...role,
      createdBy: { _id: user._id, email: user.email },
    });

    return {
      _id: newRole._id,
      createdAt: newRole.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (+currentPage - 1) * +limit;
    const defaultLimit = +limit || 10;

    // Tính tổng số bản ghi bằng countDocuments() thay vì find().length
    const totalItems = await this.roleModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.roleModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .lean() // Dùng lean() để giảm tải bộ nhớ
      .exec();

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Không tìm thấy vai trò');
    }

    const role = await this.roleModel
      .findOne({ _id: id })
      .populate({
        path: 'permissions',
        select: { _id: 1, apiPath: 1, name: 1, method: 1, module: 1 },
      })
      .lean();

    if (!role) {
      throw new BadRequestException('Không tìm thấy vai trò');
    }

    return role;
  }

  async update(id: string, role: UpdateRoleDto, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Không tìm thấy vai trò');
    }

    const updatedRole = await this.roleModel.updateOne(
      { _id: id },
      {
        ...role,
        updatedBy: { _id: user._id, name: user.name },
      },
    );

    if (updatedRole.modifiedCount === 0) {
      throw new BadRequestException('Không có thay đổi nào được thực hiện');
    }

    return { message: 'Vai trò đã được cập nhật thành công' };
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Không tìm thấy vai trò');
    }

    const foundRole = await this.roleModel.findById(id).lean();
    if (foundRole?.name === ADMIN_ROLE) {
      throw new BadRequestException('Không thể xóa vai trò quản trị viên');
    }

    await this.roleModel.updateOne(
      { _id: id },
      { deletedBy: { _id: user._id, name: user.name } },
    );

    const result = await this.roleModel.softDelete({ _id: id });

    if (!result) {
      throw new BadRequestException('Không thể xóa vai trò');
    }

    return { message: 'Vai trò đã bị xóa thành công' };
  }
}
