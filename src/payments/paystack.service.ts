import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeTransaction(data: {
    email: string;
    amount: number; // in kobo (naira * 100)
    reference: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: data.email,
          amount: data.amount,
          reference: data.reference,
          metadata: data.metadata,
        },
        { headers: this.headers },
      );

      return response.data.data; // { authorization_url, access_code, reference }
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message ?? 'Failed to initialize payment',
      );
    }
  }

  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        { headers: this.headers },
      );

      return response.data.data;
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message ?? 'Failed to verify payment',
      );
    }
  }
}
