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
  constructor(
    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,
  ) {}

  async create(subs: CreateSubscriberDto, user: IUser) {
    const isExist = await this.subscriberModel
      .findOne({ email: subs.email })
      .lean();
    if (isExist) {
      throw new BadRequestException(
        `Email ${subs.email} đã tồn tại trên hệ thống!`,
      );
    }

    const newSubs = await this.subscriberModel.create({
      ...subs,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return {
      _id: newSubs?._id,
      createdAt: newSubs?.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (+currentPage - 1) * +limit;
    const defaultLimit = +limit || 10;

    // Tính tổng số bản ghi bằng countDocuments() thay vì find().length
    const totalItems = await this.subscriberModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.subscriberModel
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
      throw new BadRequestException('Không tìm thấy người đăng ký');
    }

    const subscriber = await this.subscriberModel.findById(id).lean();
    if (!subscriber) {
      throw new BadRequestException('Không tìm thấy người đăng ký');
    }

    return subscriber;
  }

  async update(subs: UpdateSubscriberDto, user: IUser) {
    const updatedSubscriber = await this.subscriberModel.updateOne(
      { email: user.email },
      {
        ...subs,
        updatedBy: { _id: user._id, email: user.email },
      },
      { upsert: true },
    );

    if (updatedSubscriber.modifiedCount === 0) {
      throw new BadRequestException('Không có thay đổi nào được thực hiện');
    }

    return { message: 'Cập nhật người đăng ký thành công' };
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Không tìm thấy người đăng ký');
    }

    const foundSubscriber = await this.subscriberModel.findById(id).lean();
    if (!foundSubscriber) {
      throw new BadRequestException('Không tìm thấy người đăng ký');
    }

    await this.subscriberModel.updateOne(
      { _id: id },
      { deletedBy: { _id: user._id, email: user.email } },
    );

    const result = await this.subscriberModel.softDelete({ _id: id });

    if (!result) {
      throw new BadRequestException('Không thể xóa người đăng ký');
    }

    return { message: 'Người đăng ký đã bị xóa thành công' };
  }

  async getSkills(user: IUser) {
    const subscriber = await this.subscriberModel
      .findOne({ email: user.email }, { skills: 1 })
      .lean();
    if (!subscriber) {
      throw new BadRequestException('Không tìm thấy người đăng ký');
    }
    return subscriber.skills;
  }
}
