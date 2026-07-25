import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmService } from '../crm/crm.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [FormsController],
  providers: [FormsService, CrmService],
  exports: [FormsService, CrmService],
})
export class FormsModule {}
