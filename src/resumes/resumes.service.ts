import { Injectable } from '@nestjs/common';
import { CreateUserCvDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { IUser } from 'src/users/user.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import aqp from 'api-query-params';
import { Types } from 'mongoose';

@Injectable()
export class ResumesService {
  constructor(@InjectModel(Resume.name) private resumeModel: SoftDeleteModel<ResumeDocument>) { }

  async create(userCv: CreateUserCvDto, user: IUser) {
    const { url, companyId, jobId } = userCv
    const { email, _id } = user;
    const newCv = await this.resumeModel.create(
      {
        url, companyId, email, jobId,
        userId: _id,
        status: "PENDING",
        createdBy: { _id, email },
        history: [{
          status: "PENDING",
          updatedAt: new Date(),
          updatedBy: { _id, email }
        }],
      })
    return {
      _id: newCv?._id,
      createdAt: newCv?.createdAt
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population, projection } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    let offset = (+currentPage - 1) * (+limit);
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.resumeModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);


    const result = await this.resumeModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .select(projection as any)
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

    const resume = await this.resumeModel.findById(id)

    if (!resume) {
      throw new Error('>>> User not found');
    }

    return resume;
  }

  async update(id: string, resume: UpdateResumeDto, user: IUser) {
    return await this.resumeModel.updateOne(
      { _id: id },
      {
        ...resume,
        updatedBy: {
          _id: user._id,
          email: user.email
        },
        $push: {
          history: {
            status: resume.status,
            updatedAt: new Date(),
            updatedBy: {
              _id: user._id,
              email: user.email
            }
          }
        }
      }
    );
  }

  async remove(id: string, user: IUser) {
    await this.resumeModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )
    return await this.resumeModel.softDelete({ _id: id });;
  }

  async findByUsers(user: IUser) {
    return await this.resumeModel.find({ userId: user._id })
      .sort("-createdAt")
      .populate([
        {
          path: "companyId",
          select: { name: 1 }
        },
        {
          path: "jobId",
          select: { name: 1 }
        }
      ])
  }
}
