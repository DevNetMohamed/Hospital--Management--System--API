import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { SERVICE_PORTS } from 'libs/common/src';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  app.setGlobalPrefix('api');

  await app.listen(SERVICE_PORTS.API_GETAWAY);
  console.log(`api-getaway is running on port ${SERVICE_PORTS.API_GETAWAY}/api`);
}
bootstrap();
