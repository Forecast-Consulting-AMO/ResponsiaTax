import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../auth/auth.module';
import { DossierModule } from '../dossier/dossier.module';
import { RoundModule } from '../round/round.module';
import { DocumentModule } from '../document/document.module';
import { QuestionModule } from '../question/question.module';
import { LlmModule } from '../llm/llm.module';
import { SettingModule } from '../setting/setting.module';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [
    // Structured logging (pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // Global config from .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env.dev', '.env'],
    }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5433),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'responsia_tax_dev'),
        ssl: config.get('TYPEORM_MODE_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),

    // Feature modules
    AuthModule,
    HealthModule,
    DossierModule,
    RoundModule,
    DocumentModule,
    QuestionModule,
    LlmModule,
    SettingModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
