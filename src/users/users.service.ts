import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User as UserM, UserDocument } from './schemas/user.schema';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from './user.interface';
import aqp from 'api-query-params';

@Injectable()
export class UsersService {
  constructor(@InjectModel(UserM.name) private userModel: SoftDeleteModel<UserDocument>) { }

  getHashPassword = (password: string) => {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  }

  async create(userData: CreateUserDto | RegisterUserDto, user?: IUser) {
    const email = userData.email
    const isExsit = await this.userModel.findOne({ email })
    if (isExsit) {
      throw new BadRequestException(`Email '${email}' đã tồn tại trên hệ thống. Vui lòng sử dụng email khác !`)
    }

    const passwordHashed = this.getHashPassword(userData.password);
    const role = 'role' in userData ? userData.role : 'user';

    return await this.userModel.create(
      {
        ...userData,
        password: passwordHashed,
        role: role,
        createdBy: user ? {
          _id: user._id,
          email: user.email
        } : null
      })
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    let offset = (+currentPage - 1) * (+limit);
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);


    const result = await this.userModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .select('-password') // Loại trừ trường password
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
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('>>> Invalid ID');
    }

    const user = await this.userModel.findById(id)
      .select('-password')
      .exec();
    if (!user) {
      throw new Error('>>> User not found');
    }
    return user;
  }

  async findOneByUsername(username: string) {
    return await this.userModel.findOne({
      email: username,
    }).exec();
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash)
  }

  async update(updateUserDto: UpdateUserDto, user: IUser) {
    return await this.userModel.updateOne(
      { _id: updateUserDto._id },
      {
        ...updateUserDto,
        updatedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )
  }

  async remove(id: string, user: IUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('>>> Invalid ID');
    }
    await this.userModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )
    const result = await this.userModel.softDelete({ _id: id });
    if (result.deleted === 0) {
      throw new Error('>>> User not found');
    }
    return result;
  }

  async updateUserToken(_id: string, refreshToken: string) {
    return await this.userModel.updateOne(
      { _id },
      { refreshToken }
    );
  }

  async findUserByToken(refreshToken: string) {
    return await this.userModel.findOne({ refreshToken }).exec();
  }
}
