import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MaterialsService } from './materials.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [StorageService, MaterialsService],
  exports: [StorageService, MaterialsService],
})
export class StorageModule {}
