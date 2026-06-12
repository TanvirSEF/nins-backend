import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import * as compression from 'compression';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Security ───
  app.use(helmet());
  app.enableCors();

  // ─── Performance ───
  app.use(compression());

  // ─── Global prefix ───
  app.setGlobalPrefix('api', {
    exclude: ['health', 'docs', 'docs-json', 'docs-yaml'],
  });

  // ─── Validation ───
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Global filters & interceptors ───
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TimeoutInterceptor(),
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ─── Swagger / OpenAPI Docs ───
  const config = new DocumentBuilder()
    .setTitle('NINS API')
    .setDescription('The NINS Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication & registration')
    .addTag('departments', 'Department management')
    .addTag('doctors', 'Doctor profiles')
    .addTag('schedules', 'Doctor schedules')
    .addTag('staff', 'Staff management (SUPER_ADMIN)')
    .addTag('health', 'Health check')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
    },
    customSiteTitle: 'NINS API Docs',
  });

  // ─── Graceful shutdown for Docker ───
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}/api`);
  console.log(`Swagger docs at    http://localhost:${port}/docs`);
}
bootstrap();
