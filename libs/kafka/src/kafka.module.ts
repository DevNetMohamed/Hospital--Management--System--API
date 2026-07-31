import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KAFKA_SERVICE } from './constants/kafka.constants';
import { KafkaProducerService } from './KafkaProducerService';

@Global()
@Module({})
export class KafkaModule {
  static register({
    clientId,
    consumerGroup,
  }: {
    clientId: string;
    consumerGroup?: string;
  }): DynamicModule {
    return {
      module: KafkaModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: KAFKA_SERVICE,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId,
                  brokers: [configService.get<string>('KAFKA_BROKER')!],
                },
                consumer: {
                  groupId:
                    consumerGroup ??
                    configService.get<string>('KAFKA_CONSUMER_GROUP')!,
                },
              },
            }),
          },
        ]),
      ],
      providers: [KafkaProducerService],
      exports: [KafkaProducerService, ClientsModule],
    };
  }
}
