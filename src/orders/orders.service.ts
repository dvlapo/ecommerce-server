import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto';
import { UpdateOrderStatusDto } from './dto';
import { OrderStatus } from 'generated/prisma/enums';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // ── 1. Fetch all products in the order ──────────────────
    const productIds = dto.items.map((i) => i.productId);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { inventory: true },
    });

    // Make sure every requested product actually exists and is active
    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products are invalid or unavailable',
      );
    }

    // Build a map for O(1) lookups instead of repeated find() calls
    const productMap = new Map(products.map((p) => [p.id, p]));

    // ── 2. Validate stock before touching anything ───────────
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;

      if (!product.inventory || product.inventory.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product: ${product.name}`,
        );
      }
    }

    // ── 3. Calculate total ───────────────────────────────────
    const total = dto.items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + Number(product?.price) * item.quantity;
    }, 0);

    // ── 4. Run everything inside a transaction ───────────────
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount: total,
          shippingAddress: dto.shippingAddress,
          orderItems: {
            create: dto.items.map((item) => {
              const product = productMap.get(item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product!.price,
              };
            }),
          },
        },
        include: { orderItems: true },
      });

      for (const item of dto.items) {
        await this.inventoryService.decrementStock(
          item.productId,
          item.quantity,
          tx,
        );
      }

      return order;
    });
  }

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: {
              select: { id: true, name: true, images: true, price: true },
            },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
                vendor: { select: { id: true, storeName: true } },
              },
            },
          },
        },
        payment: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Non-admins can only view their own orders
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) throw new NotFoundException('Order not found');

    // Guard against invalid status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      SHIPPED: [OrderStatus.DELIVERED],
      DELIVERED: [OrderStatus.REFUNDED],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!validTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${dto.status}`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async cancelMyOrder(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) throw new NotFoundException('Order not found');

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore stock for each item
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: id },
      });

      for (const item of orderItems) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        orderItems: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
