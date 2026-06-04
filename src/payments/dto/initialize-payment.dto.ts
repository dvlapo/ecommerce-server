import { IsUUID, IsEnum } from 'class-validator';
import { PaymentMethod } from 'generated/prisma/enums';

export class InitializePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
