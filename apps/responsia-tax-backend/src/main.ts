import { NestFactory } from '@nestjs/core';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Structured logging
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // URI-based API versioning: /api/v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ResponsiaTax API')
    .setDescription('Tax audit response assistant API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Serve frontend SPA in production (files copied into ./public by CI)
  const publicDir = join(__dirname, 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
    // SPA fallback: serve index.html for non-API routes (no-cache so new deploys take effect)
    const expressApp = app.getHttpAdapter().getInstance();
    const indexPath = join(publicDir, 'index.html');
    expressApp.get(/^(?!\/api\/|\/uploads\/).*/, (_req: any, res: any) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath);
    });
  }

  // Ensure uploads directory exists (UPLOAD_DIR for Azure persistent /home mount)
  const uploadsDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Start
  const port = process.env.PORT || 3000;
  const server = await app.listen(port);
  server.setTimeout(600_000); // 10 min for long-running jobs

  const logger = app.get(Logger);
  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger at http://localhost:${port}/api/docs`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
