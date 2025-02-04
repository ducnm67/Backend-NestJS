import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { TransformInterceptor } from './core/transform.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Reflector instance
  const reflector = app.get(Reflector);

  // Global Guards
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true, // Auto-transform payloads to DTO types
    }),
  );

  // Global Interceptors
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // Static files and views configuration
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  // Cookie parser middleware
  app.use(cookieParser());

  // CORS Configuration
  const corsEnabled = configService.get<string>('CORS_ORIGIN') === 'true';
  const corsOptions = {
    origin: corsEnabled ? '*' : false, // Use specific origins in prod
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    preflightContinue: false,
  };
  app.enableCors(corsOptions);

  // API Versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', '2'], // Support multiple versions
  });

  // Listen on the specified port
  await app.listen(configService.get<string>('PORT') || 3000);
}
bootstrap();
