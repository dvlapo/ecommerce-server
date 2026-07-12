import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import nodemailer, { type Transporter } from 'nodemailer';
import { emailTemplates } from './email.templates';

interface OrderEmailData {
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: string;
  reference?: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    this.from = from ?? null;

    if (!host || !from) {
      this.transporter = null;
      this.logger.log(
        'SMTP config missing; email notifications will be logged instead of sent',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  sendOrderConfirmed(data: OrderEmailData) {
    return this.sendTemplate('orderConfirmed', data);
  }

  sendPaymentSuccessful(data: OrderEmailData) {
    return this.sendTemplate('paymentSuccessful', data);
  }

  sendOrderShipped(data: OrderEmailData) {
    return this.sendTemplate('orderShipped', data);
  }

  private async sendTemplate(
    templateName: keyof typeof emailTemplates,
    data: OrderEmailData,
  ) {
    const template = emailTemplates[templateName];
    const context = {
      ...data,
      reference: data.reference ?? 'N/A',
    };
    const text = Handlebars.compile(template.text)(context);
    const html = Handlebars.compile(template.html)(context);

    if (!this.transporter || !this.from) {
      this.logger.log(
        `[Email disabled] To: ${data.to}; Subject: ${template.subject}; Order: ${data.orderId}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject: template.subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send ${templateName} email for order ${data.orderId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
