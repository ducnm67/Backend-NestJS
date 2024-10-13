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

  constructor(@InjectModel(Role.name) private RoleModel: SoftDeleteModel<RoleDocument>) { }

  async create(role: CreateRoleDto, user: IUser) {
    const roleIsExist = await this.RoleModel.findOne({ name: role.name })
    if (roleIsExist) {
      throw new BadRequestException(`Role ${role.name} đã tồn tại!`)
    }
    const newRole = await this.RoleModel.create({
      ...role,
      createdBy: { _id: user._id, email: user.email },
    })

    return {
      _id: newRole._id,
      createdAt: newRole.createdAt,
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    let offset = (+currentPage - 1) * (+limit);
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.RoleModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);


    const result = await this.RoleModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages,  //tổng số trang với điều kiện query
        total: totalItems // tổng số phần tử (số bản ghi)
      },
      result //kết quả query
    }
  }

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Not found role');
    }
    return await this.RoleModel.findOne({ _id: id })
      .populate({
        path: "permissions",
        select: { _id: 1, apiPath: 1, name: 1, method: 1, module: 1 }
      })
  }

  async update(id: string, role: UpdateRoleDto, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Not found role');
    }
    return await this.RoleModel.updateOne(
      { _id: id },
      {
        ...role,
        updatedBy: { _id: user._id, name: user.name }
      }
    )
  }

  async remove(id: string, user: IUser) {
    const foundRole = await this.RoleModel.findById(id)
    if (foundRole.name === ADMIN_ROLE) {
      throw new BadRequestException('Không thể xóa vai trò quản trị viên');
    }
    await this.RoleModel.updateOne(
      { _id: id },
      { deletedBy: { _id: user._id, name: user.name } }
    )
    return await this.RoleModel.softDelete({ _id: id });
  }
}
