import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsQueryDto } from './dto';
import { OrderStatus, PaymentStatus } from 'generated/prisma/enums';

const ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

const REVENUE_ORDER_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

interface AnalyticsOrderItem {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: { toString(): string };
  product: {
    id: string;
    name: string;
    images: string[];
    vendorId: string;
    vendor: { id: string; storeName: string };
  };
}

interface AnalyticsVendor {
  id: string;
  storeName: string;
  _count: { products: number };
  products: Array<{
    id: string;
    reviews: Array<{ rating: number }>;
  }>;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics(query: AnalyticsQueryDto) {
    const limit = query.limit ?? 5;

    const [totalRevenue, orders, paidOrderItems, vendors] =
      await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.SUCCESS,
            order: { status: { in: REVENUE_ORDER_STATUSES } },
          },
          _sum: { amount: true },
        }),
        this.prisma.order.findMany({
          select: { status: true },
        }),
        this.prisma.orderItem.findMany({
          where: {
            order: {
              status: { in: REVENUE_ORDER_STATUSES },
              payment: { status: PaymentStatus.SUCCESS },
            },
          },
          include: {
            order: { select: { id: true } },
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                vendorId: true,
                vendor: {
                  select: { id: true, storeName: true },
                },
              },
            },
          },
        }),
        this.prisma.vendor.findMany({
          select: {
            id: true,
            storeName: true,
            _count: { select: { products: true } },
            products: {
              select: {
                id: true,
                reviews: {
                  select: { rating: true },
                },
              },
            },
          },
        }),
      ]);

    const ordersByStatus = this.getOrdersByStatus(orders);

    return {
      totalRevenue: (totalRevenue._sum.amount ?? 0).toString(),
      ordersByStatus,
      topSellingProducts: this.getTopSellingProducts(
        paidOrderItems as AnalyticsOrderItem[],
        limit,
      ),
      vendorPerformance: this.getVendorPerformance(
        vendors as AnalyticsVendor[],
        paidOrderItems as AnalyticsOrderItem[],
        limit,
      ),
    };
  }

  private getOrdersByStatus(orders: Array<{ status: OrderStatus }>) {
    return ORDER_STATUSES.reduce(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {} as Record<OrderStatus, number>,
    );
  }

  private getTopSellingProducts(
    orderItems: AnalyticsOrderItem[],
    limit: number,
  ) {
    const products = new Map<
      string,
      {
        productId: string;
        name: string;
        images: string[];
        vendor: { id: string; storeName: string };
        unitsSold: number;
        revenue: number;
        orderIds: Set<string>;
      }
    >();

    for (const item of orderItems) {
      const existing = products.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        images: item.product.images,
        vendor: item.product.vendor,
        unitsSold: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };

      existing.unitsSold += item.quantity;
      existing.revenue += Number(item.unitPrice) * item.quantity;
      existing.orderIds.add(item.orderId);
      products.set(item.productId, existing);
    }

    return [...products.values()]
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, limit)
      .map((product) => ({
        productId: product.productId,
        name: product.name,
        images: product.images,
        vendor: product.vendor,
        unitsSold: product.unitsSold,
        revenue: product.revenue.toFixed(2),
        orderCount: product.orderIds.size,
      }));
  }

  private getVendorPerformance(
    vendors: AnalyticsVendor[],
    orderItems: AnalyticsOrderItem[],
    limit: number,
  ) {
    const salesByVendor = new Map<
      string,
      { unitsSold: number; revenue: number; orderIds: Set<string> }
    >();

    for (const item of orderItems) {
      const vendorId = item.product.vendorId;
      const existing = salesByVendor.get(vendorId) ?? {
        unitsSold: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };

      existing.unitsSold += item.quantity;
      existing.revenue += Number(item.unitPrice) * item.quantity;
      existing.orderIds.add(item.orderId);
      salesByVendor.set(vendorId, existing);
    }

    return vendors
      .map((vendor) => {
        const sales = salesByVendor.get(vendor.id) ?? {
          unitsSold: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };
        const ratings = vendor.products.flatMap((product) =>
          product.reviews.map((review) => review.rating),
        );
        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : null;

        return {
          vendorId: vendor.id,
          storeName: vendor.storeName,
          productCount: vendor._count.products,
          unitsSold: sales.unitsSold,
          revenue: sales.revenue.toFixed(2),
          orderCount: sales.orderIds.size,
          reviewCount: ratings.length,
          averageRating:
            averageRating === null ? null : Number(averageRating.toFixed(2)),
        };
      })
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, limit);
  }
}
