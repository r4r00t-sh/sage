import { Module } from '@nestjs/common';
import { DeskProfileController } from './desk-profile.controller';
import { DeskProfileService } from './desk-profile.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DeskProfileController],
  providers: [DeskProfileService],
  exports: [DeskProfileService],
})
export class DeskProfileModule {}
