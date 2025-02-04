import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { IUser } from 'src/users/user.interface';
import { Job, JobDocument } from './schemas/job.schema';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import aqp from 'api-query-params';
import { Types } from 'mongoose';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private jobModel: SoftDeleteModel<JobDocument>,
  ) {}

  async create(job: CreateJobDto, user: IUser) {
    const createdJob = await this.jobModel.create({
      ...job,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return { _id: createdJob._id, createdAt: createdJob.createdAt };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (Math.max(currentPage, 1) - 1) * Math.max(limit, 10);

    // Lấy tổng số items & dữ liệu song song để tăng tốc độ
    const [totalItems, result] = await Promise.all([
      this.jobModel.countDocuments(filter),
      this.jobModel
        .find(filter)
        .skip(offset)
        .limit(Math.max(limit, 10))
        .sort(sort as any)
        .populate(population)
        .exec(),
    ]);

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: Math.ceil(totalItems / Math.max(limit, 10)),
        total: totalItems,
      },
      result,
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const job = await this.jobModel.findById(id);
    if (!job) throw new NotFoundException('Job not found');

    return job;
  }

  async update(id: string, job: UpdateJobDto, user: IUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const updatedJob = await this.jobModel.findByIdAndUpdate(
      id,
      {
        ...job,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
      { new: true },
    );

    if (!updatedJob) throw new NotFoundException('Job not found');
    return updatedJob;
  }

  async remove(id: string, user: IUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const job = await this.jobModel.findById(id);
    if (!job) throw new NotFoundException('Job not found');

    await this.jobModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );

    return await this.jobModel.softDelete({ _id: id });
  }
}
