import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  lowStockAt?: number;
}
