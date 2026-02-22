import { IsOptional, IsIn, IsUUID, IsDateString } from 'class-validator';

export type PeriodType = 'hour' | 'day' | 'week' | 'month' | 'year';

export class DeskProfileQueryDto {
  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month', 'year'])
  period?: PeriodType = 'day';

  @IsOptional()
  @IsUUID()
  deskId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
