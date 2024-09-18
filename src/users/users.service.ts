import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>) { }

  getHashPassword = (password: string) => {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  }

  async create(createUserDto: CreateUserDto) {
    const passwordHashed = this.getHashPassword(createUserDto.password);
    let user = await this.userModel.create(
      {
        email: createUserDto.email,
        password: passwordHashed,
        name: createUserDto.name,
      })
    return user;
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('>>> Invalid ID');
    }

    const user = await this.userModel.findById(id).exec();
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

  async update(updateUserDto: UpdateUserDto) {
    let user = await this.userModel.updateOne(
      { _id: updateUserDto._id },
      { ...updateUserDto }
    )
    return user;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('>>> Invalid ID');
    }

    const user = await this.userModel.softDelete({ _id: id });
    if (user.deleted === 0) {
      throw new Error('>>> User not found');
    }
    return user;
  }
}
