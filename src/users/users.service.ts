import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { genSaltSync, hashSync } from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) { }

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

  async update(updateUserDto: UpdateUserDto) {
    let user = await this.userModel.findByIdAndUpdate(
      { _id: updateUserDto._id },
      { ...updateUserDto }
    )
    return user;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('>>> Invalid ID');
    }

    const user = await this.userModel.deleteOne({ _id: id }).exec();
    if (user.deletedCount === 0) {
      throw new Error('>>> User not found');
    }
    return user;
  }
}
