import { Controller, Get, Logger } from '@nestjs/common';
import { Public, ResponseMessage } from 'src/decorator/customize';
import { MailerService } from '@nestjs-modules/mailer';
import {
  Subscriber,
  SubscriberDocument,
} from 'src/subscribers/schemas/subscriber.schema';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
import { Cron } from '@nestjs/schedule';

@Controller('mail')
export class MailController {
  private readonly logger = new Logger(MailController.name);

  constructor(
    private readonly mailerService: MailerService,

    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,

    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {}

  @Get()
  @Public()
  @ResponseMessage('Test email')
  @Cron('0 0 0 * * 0') // Chạy vào Chủ Nhật hàng tuần
  async handleTestEmail() {
    try {
      // Lấy tất cả subscribers, chỉ lấy trường `name` và `skills`
      const subscribers = await this.subscriberModel
        .find({}, 'name skills')
        .lean();

      if (!subscribers.length) {
        this.logger.log('No subscribers found.');
        return;
      }

      // Tạo danh sách kỹ năng duy nhất từ tất cả subscribers
      const uniqueSkills = [
        ...new Set(subscribers.flatMap((sub) => sub.skills)),
      ];

      // Lấy danh sách công việc khớp với các kỹ năng
      const jobMatchingSubSkills = await this.jobModel
        .find(
          { skills: { $in: uniqueSkills } },
          'name company.name salary skills',
        )
        .lean();

      if (!jobMatchingSubSkills.length) {
        this.logger.log('No matching jobs found for subscribers.');
        return;
      }

      // Gửi email cho từng subscriber
      await Promise.all(
        subscribers.map(async (sub) => {
          const jobsForSub = jobMatchingSubSkills.filter((job) =>
            job.skills.some((skill) => sub.skills.includes(skill)),
          );

          if (jobsForSub.length === 0) return;

          const jobsFormatted = jobsForSub.map((job) => ({
            name: job.name,
            company: job.company.name,
            salary:
              `${job.salary}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' đ',
            skills: job.skills,
          }));

          try {
            await this.mailerService.sendMail({
              to: '20021519@vnu.edu.vn', // CÓ THỂ CẬP NHẬT ĐỂ GỬI ĐẾN NGƯỜI DÙNG THẬT
              from: '"Support Team" <support@example.com>', // override default from
              subject: 'New Job Opportunities for You!',
              template: 'new-job',
              context: {
                receiver: sub.name,
                jobs: jobsFormatted,
              },
            });

            this.logger.log(`Email sent to ${sub.name}`);
          } catch (error) {
            this.logger.error(
              `Failed to send email to ${sub.name}: ${error.message}`,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Error in handleTestEmail: ${error.message}`);
    }
  }
}
