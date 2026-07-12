import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto, ListReviewsDto } from './dto';
import { OrderStatus } from 'generated/prisma/enums';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    const existingReview = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        orderItems: {
          some: { productId: dto.productId },
        },
      },
      select: { id: true },
    });

    if (!deliveredOrder) {
      throw new ForbiddenException(
        'You can only review products from delivered orders',
      );
    }

    return this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findProductReviews(productId: string, query: ListReviewsDto) {
    await this.ensureProductExists(productId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { productId };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEligibility(userId: string, productId: string) {
    await this.ensureProductExists(productId);

    const [existingReview, deliveredOrder] = await this.prisma.$transaction([
      this.prisma.review.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: { id: true },
      }),
      this.prisma.order.findFirst({
        where: {
          userId,
          status: OrderStatus.DELIVERED,
          orderItems: {
            some: { productId },
          },
        },
        select: { id: true },
      }),
    ]);

    const hasReviewed = Boolean(existingReview);
    const hasDeliveredOrder = Boolean(deliveredOrder);

    return {
      eligible: hasDeliveredOrder && !hasReviewed,
      hasReviewed,
      hasDeliveredOrder,
      reason: hasReviewed
        ? 'You have already reviewed this product'
        : hasDeliveredOrder
          ? null
          : 'You can review this product after a delivered order',
    };
  }

  async findVendorProductReviews(userId: string, query: ListReviewsDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { product: { vendorId: vendor.id } };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          product: {
            select: { id: true, name: true, images: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) throw new NotFoundException('Product not found');
  }
}
