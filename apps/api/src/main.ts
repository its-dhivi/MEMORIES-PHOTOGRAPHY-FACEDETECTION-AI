import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.use(helmet());
  app.use(cookieParser(config.getOrThrow<string>('COOKIE_SECRET')));
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Guest-Session'],
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<string>('NODE_ENV') !== 'production' || config.get<boolean>('SWAGGER_ENABLED')) {
    const swagger = new DocumentBuilder()
      .setTitle('Memories Photography AI Photo Finder API')
      .setVersion('1.0')
      .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie' }, 'access-token')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }
  await app.listen(config.get<number>('PORT', 4000), '0.0.0.0');
}
void bootstrap();
