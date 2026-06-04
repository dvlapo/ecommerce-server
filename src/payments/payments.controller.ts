import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type Request } from 'express';
import { type User } from 'generated/prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // Customer — initialize payment for an order
  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  initializePayment(
    @CurrentUser() user: User,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentsService.initializePayment(user.id, dto);
  }

  // Customer — get payment for a specific order
  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  getPaymentByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.getPaymentByOrder(orderId, user.id);
  }

  // Customer — verify a payment by reference
  @UseGuards(JwtAuthGuard)
  @Get('verify/:reference')
  verifyPayment(
    @Param('reference') reference: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.verifyPayment(reference, user.id);
  }

  // Paystack webhook — no auth, verified by signature instead
  @Post('webhook')
  handleWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: Request,
  ) {
    return this.paymentsService.handleWebhook(signature, req['rawBody']);
  }
}
