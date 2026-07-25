import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [SmsService, NotificationsService],
  exports: [SmsService, NotificationsService],
})
export class NotificationsModule {}
