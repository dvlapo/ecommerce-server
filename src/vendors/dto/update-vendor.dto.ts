import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  storeName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
