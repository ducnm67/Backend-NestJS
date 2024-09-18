import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(
  ) { }

  @Get()
  @Render('home')
  handleHomePage() {
  }
}
