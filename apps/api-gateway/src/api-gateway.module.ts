import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';
import { KafkaModule } from 'libs/kafka/src';

@Module({
  imports: [
    AppConfigModule,
    KafkaModule.register({
      clientId: 'api-getaway',
      consumerGroup: 'api-gateway-consumer',
    }),
  ],
})
export class ApiGatewayModule {}
