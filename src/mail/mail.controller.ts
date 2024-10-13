import { Controller, Get } from '@nestjs/common';
import { Public, ResponseMessage } from 'src/decorator/customize';
import { MailerService } from '@nestjs-modules/mailer';
import { Subscriber, SubscriberDocument } from 'src/subscribers/schemas/subscriber.schema';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailerService: MailerService,

    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,

    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>
  ) { }

  @Get()
  @Public()
  @ResponseMessage("Test email")
  @Cron("0 0 0 * * 0")
  async handleTestEmail() {

    const subs = await this.subscriberModel.find({})
    for (const sub of subs) {
      const subSkills = sub.skills
      const jobMatchingSubSkills = await this.jobModel.find({ skills: { $in: subSkills } })
      if (jobMatchingSubSkills?.length) {
        const jobs = jobMatchingSubSkills.map(job => {
          return {
            name: job.name,
            company: job.company.name,
            salary: `${job.salary}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " đ",
            skills: job.skills
          }
        })

        await this.mailerService.sendMail({
          to: "20021519@vnu.edu.vn",
          from: '"Support Team" <support@example.com>', // override default from
          subject: 'Welcome to Nice App! Confirm your Email',
          template: "new-job", // HTML body content
          context: {
            receiver: sub.name,
            jobs: jobs
          }
        });
      }
    }
  }
}
