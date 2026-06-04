import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MinLength(3)
  storeName!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
