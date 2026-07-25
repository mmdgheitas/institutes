import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdobeConnectProvider } from './adobe-connect.provider';
import { BbbProvider } from './bbb.provider';
import { LiveClassesController } from './live-classes.controller';
import { LiveClassesService } from './live-classes.service';

@Module({
  imports: [ConfigModule, NotificationsModule],
  controllers: [LiveClassesController],
  providers: [LiveClassesService, BbbProvider, AdobeConnectProvider],
  exports: [LiveClassesService],
})
export class LiveClassesModule {}
