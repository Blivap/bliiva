import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class TurnLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'When true, only turns that failed or carried an error cause',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  errorsOnly?: 'true' | 'false';
}
