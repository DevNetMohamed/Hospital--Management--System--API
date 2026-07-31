import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { SERVICE_PORTS } from 'libs/common/src';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  await app.listen(SERVICE_PORTS.AUTH_SERVICE);
  console.log(`Auth Service is running on port ${SERVICE_PORTS.AUTH_SERVICE}`);
}
bootstrap();
