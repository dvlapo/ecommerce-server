import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getInventory(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            vendor: { select: { id: true, storeName: true } },
          },
        },
      },
    });

    if (!inventory) throw new NotFoundException('Inventory record not found');

    return inventory;
  }

  async updateStock(
    productId: string,
    userId: string,
    dto: UpdateInventoryDto,
  ) {
    // Verify the product exists and belongs to this vendor
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { vendor: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.vendor.userId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }

    return this.prisma.inventory.update({
      where: { productId },
      data: {
        quantity: dto.quantity,
        ...(dto.lowStockAt && { lowStockAt: dto.lowStockAt }),
      },
    });
  }

  async getMyInventory(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return this.prisma.inventory.findMany({
      where: {
        product: { vendorId: vendor.id },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
            images: true,
          },
        },
      },
      orderBy: { quantity: 'asc' }, // show lowest stock first
    });
  }

  async getLowStockAlerts(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) throw new NotFoundException('Vendor profile not found');

    // Find all inventory records where quantity is at or below the lowStockAt threshold
    return this.prisma.inventory.findMany({
      where: {
        product: { vendorId: vendor.id },
        quantity: { lte: this.prisma.inventory.fields.lowStockAt },
      },
      include: {
        product: {
          select: { id: true, name: true, price: true, images: true },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // Internal method — called by OrdersService
  // Runs inside a transaction to decrement stock
  // ─────────────────────────────────────────────
  async decrementStock(
    productId: string,
    quantity: number,
    tx: Prisma.TransactionClient,
  ) {
    const inventory = await tx.inventory.findUnique({ where: { productId } });

    if (!inventory) {
      throw new NotFoundException(
        `Inventory not found for product ${productId}`,
      );
    }

    if (inventory.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}. Available: ${inventory.quantity}`,
      );
    }

    return tx.inventory.update({
      where: { productId },
      data: { quantity: { decrement: quantity } },
    });
  }
}
