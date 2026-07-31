import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KAFKA_SERVICE } from './constants/kafka.constants';
import { ClientKafka } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
export interface KafkaEvent<T> {
  eventId: string;
  eventType: string;
  source: string;
  version: string;
  occurredAt: Date;
  data: T;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaProducerService.name);
  constructor(
    @Inject(KAFKA_SERVICE)
    private readonly kafkaClient: ClientKafka,
  ) {}
  async onModuleInit() {
    await this.kafkaClient.connect();
    this.logger.log('Kafka Producer Connected');
  }

  async publish<T>(topic: string, data: T): Promise<void> {
    const event: KafkaEvent<T> = {
      eventId: randomUUID(),
      eventType: topic,
      source: 'auth-service',
      occurredAt: new Date(),
      version: '1.0',
      data,
    };

    try {
      await this.kafkaClient.emit(topic, event);

      this.logger.log(`Published event: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish ${topic}`, error);
      throw error;
    }
  }
}
