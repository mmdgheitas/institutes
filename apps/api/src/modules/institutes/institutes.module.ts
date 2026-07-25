import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { InstituteAccessService } from './institute-access.service';
import { InstitutesController } from './institutes.controller';
import { InstitutesService } from './institutes.service';

@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [InstitutesController],
  providers: [InstitutesService, InstituteAccessService],
  exports: [InstitutesService, InstituteAccessService],
})
export class InstitutesModule {}
