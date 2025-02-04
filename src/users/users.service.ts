import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User as UserM, UserDocument } from './schemas/user.schema';
import mongoose, { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from './user.interface';
import aqp from 'api-query-params';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { USER_ROLE } from 'src/databases/sample';
import { User } from 'src/decorator/customize';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserM.name)
    private userModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Role.name)
    private roleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  private getHashPassword(password: string) {
    const salt = genSaltSync(10);
    return hashSync(password, salt);
  }

  public hashPassword(password: string) {
    return this.getHashPassword(password);
  }

  private async checkEmailExist(email: string) {
    const user = await this.userModel.findOne({ email }).lean();
    if (user) {
      throw new BadRequestException(
        `Email: ${email} đã tồn tại trên hệ thống. Vui lòng sử dụng email khác.`,
      );
    }
  }

  async create(createUserDto: CreateUserDto, @User() user: IUser) {
    const { email, password, ...otherDetails } = createUserDto;

    // Kiểm tra email đã tồn tại chưa
    await this.checkEmailExist(email);

    const hashPassword = this.getHashPassword(password);

    const newUser = await this.userModel.create({
      ...otherDetails,
      email,
      password: hashPassword,
      createdBy: { _id: user._id, email: user.email },
    });

    return newUser;
  }

  async register(user: RegisterUserDto) {
    const { email, password, ...otherDetails } = user;

    // Kiểm tra email đã tồn tại chưa
    await this.checkEmailExist(email);

    // Lấy role của user
    const userRole = await this.roleModel.findOne({ name: USER_ROLE }).lean();

    const hashPassword = this.getHashPassword(password);

    const newRegister = await this.userModel.create({
      ...otherDetails,
      email,
      password: hashPassword,
      role: userRole?._id,
    });

    return newRegister;
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (+currentPage - 1) * +limit;
    const defaultLimit = +limit || 10;

    // Dùng countDocuments() thay vì find().length
    const totalItems = await this.userModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.userModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .select('-password') // Ẩn password
      .populate(population)
      .lean() // Giảm tải bộ nhớ
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
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const user = await this.userModel
      .findById(id)
      .select('-password')
      .populate({ path: 'role', select: { name: 1, _id: 1 } })
      .lean();

    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return user;
  }

  async findOneByUsername(username: string) {
    return this.userModel
      .findOne({ email: username })
      .populate({ path: 'role', select: { name: 1 } })
      .lean();
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async update(updateUserDto: UpdateUserDto, user: IUser) {
    const updated = await this.userModel.updateOne(
      { _id: updateUserDto._id },
      {
        ...updateUserDto,
        updatedBy: { _id: user._id, email: user.email },
      },
    );

    if (updated.modifiedCount === 0) {
      throw new BadRequestException('Không có thay đổi nào được thực hiện');
    }

    return { message: 'Cập nhật người dùng thành công' };
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const foundUser = await this.userModel.findById(id).lean();
    if (foundUser && foundUser.email === 'admin@gmail.com') {
      throw new BadRequestException('Không thể xóa tài khoản admin@gmail.com');
    }

    await this.userModel.updateOne(
      { _id: id },
      { deletedBy: { _id: user._id, email: user.email } },
    );

    const result = await this.userModel.softDelete({ _id: id });
    if (!result) {
      throw new BadRequestException('Không thể xóa người dùng');
    }

    return { message: 'Người dùng đã bị xóa thành công' };
  }

  updateUserToken = async (refreshToken: string, _id: string) => {
    return this.userModel.updateOne({ _id }, { refreshToken });
  };

  findUserByToken = async (refreshToken: string) => {
    return this.userModel
      .findOne({ refreshToken })
      .populate({ path: 'role', select: { name: 1 } })
      .lean();
  };
}
