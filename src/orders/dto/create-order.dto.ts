import {
  IsArray,
  IsUUID,
  IsInt,
  IsObject,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsObject()
  shippingAddress!: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
}
