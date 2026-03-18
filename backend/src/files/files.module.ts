import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FilesPublicController } from './files-public.controller';
import { TimingModule } from '../timing/timing.module';
import { SecurityModule } from '../security/security.module';
import { CapacityModule } from '../capacity/capacity.module';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [TimingModule, SecurityModule, CapacityModule, AuthModule, WorkflowModule],
  controllers: [FilesPublicController, FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
