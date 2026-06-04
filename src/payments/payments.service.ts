import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaystackService } from './paystack.service';
import { ConfigService } from '@nestjs/config';
import { InitializePaymentDto } from './dto';
import * as crypto from 'crypto';
import { OrderStatus, PaymentStatus } from 'generated/prisma/enums';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
    private config: ConfigService,
  ) {}

  async initializePayment(userId: string, dto: InitializePaymentDto) {
    // ── 1. Fetch the order ───────────────────────────────────
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        user: true,
        payment: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    // ── 2. Block duplicate payments ──────────────────────────
    if (order.payment && order.payment.status === PaymentStatus.SUCCESS) {
      throw new BadRequestException('This order has already been paid for');
    }

    // ── 3. Generate a unique reference ───────────────────────
    const reference = `PAY-${order.id}-${Date.now()}`;

    // ── 4. Initialize with Paystack ──────────────────────────
    const paystackData = await this.paystack.initializeTransaction({
      email: order.user.email,
      amount: Math.round(Number(order.totalAmount) * 100), // convert to kobo
      reference,
      metadata: {
        orderId: order.id,
        userId,
      },
    });

    // ── 5. Create or update the payment record ───────────────
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        amount: order.totalAmount,
        method: dto.method,
        status: PaymentStatus.PENDING,
        providerReference: reference,
      },
      update: {
        method: dto.method,
        status: PaymentStatus.PENDING,
        providerReference: reference,
      },
    });

    return {
      authorizationUrl: paystackData.authorization_url,
      reference,
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    // ── 1. Verify the webhook signature ─────────────────────
    const secret = this.config.get<string>('PAYSTACK_WEBHOOK_SECRET')!;

    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString());

    // ── 2. Handle the event ──────────────────────────────────
    if (event.event === 'charge.success') {
      await this.handleChargeSuccess(event.data);
    }

    if (event.event === 'refund.processed') {
      await this.handleRefund(event.data);
    }

    return { received: true };
  }

  private async handleChargeSuccess(data: any) {
    const { reference, metadata } = data;

    const payment = await this.prisma.payment.findFirst({
      where: { providerReference: reference },
    });

    if (!payment) return;

    await this.prisma.$transaction([
      // Update payment status
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          metadata: data,
        },
      }),
      // Confirm the order
      this.prisma.order.update({
        where: { id: metadata.orderId },
        data: { status: OrderStatus.CONFIRMED },
      }),
    ]);
  }

  private async handleRefund(data: any) {
    const { reference } = data;

    const payment = await this.prisma.payment.findFirst({
      where: { providerReference: reference },
    });

    if (!payment) return;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED },
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.REFUNDED },
      }),
    ]);
  }

  async getPaymentByOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment)
      throw new NotFoundException('No payment found for this order');

    return payment;
  }

  async verifyPayment(reference: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerReference: reference },
      include: { order: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.order.userId !== userId) {
      throw new ForbiddenException('You do not own this payment');
    }

    // Double check with Paystack directly
    const paystackData = await this.paystack.verifyTransaction(reference);

    return {
      status: paystackData.status,
      amount: paystackData.amount / 100, // convert back from kobo
      reference: paystackData.reference,
      paidAt: paystackData.paid_at,
    };
  }
}
