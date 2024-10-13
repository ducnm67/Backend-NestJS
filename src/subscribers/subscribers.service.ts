import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { IUser } from 'src/users/user.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import mongoose from 'mongoose';
import aqp from 'api-query-params';

@Injectable()
export class SubscribersService {

  constructor(@InjectModel(Subscriber.name) private subscriberModel: SoftDeleteModel<SubscriberDocument>) { }

  async create(subs: CreateSubscriberDto, user: IUser) {
    const isExist = await this.subscriberModel.findOne({ email: subs.email })
    if (isExist) {
      throw new BadRequestException(`Email ${subs.email} đã tồn tại trên hệ thống!}`)
    }
    let newSubs = await this.subscriberModel.create(
      {
        ...subs,
        createdBy: {
          _id: user._id,
          email: user.email
        }
      }
    );
    return {
      _id: newSubs?._id,
      createdAt: newSubs?.createdAt
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    let offset = (+currentPage - 1) * (+limit);
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.subscriberModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);


    const result = await this.subscriberModel.find(filter)
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
    return this.subscriberModel.findById(id);
  }

  async update(subs: UpdateSubscriberDto, user: IUser) {
    return await this.subscriberModel.updateOne(
      { email: user.email },
      {
        ...subs,
        updatedBy: { _id: user._id, email: user.email }
      },
      { upsert: true }
    )
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Not found subscriber');
    }
    await this.subscriberModel.updateOne(
      { _id: id },
      {
        deletedBy: { _id: user._id, email: user.email }
      })
    return await this.subscriberModel.softDelete({ _id: id })
  }

  async getSkills(user: IUser) {
    return await this.subscriberModel.findOne({ email: user.email }, { skills: 1 })
  }
}
