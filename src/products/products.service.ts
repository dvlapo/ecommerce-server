import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto, FilterProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto) {
    // Get the vendor profile for this user
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });

    if (!vendor)
      throw new ForbiddenException('You do not have a vendor profile');
    if (!vendor.isApproved)
      throw new ForbiddenException('Your vendor account is not approved yet');

    return this.prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        images: dto.images ?? [],
        inventory: {
          create: { quantity: 0 }, // create inventory record alongside product
        },
      },
      include: { inventory: true },
    });
  }

  async findAll(filters: FilterProductDto) {
    const { search, categoryId, vendorId, minPrice, maxPrice, page, limit } =
      filters;

    const skip = ((page || 1) - 1) * (limit || 1);

    const where: any = {
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(vendorId && { vendorId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          vendor: { select: { id: true, storeName: true } },
          inventory: { select: { quantity: true } },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / (limit || 1)),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        vendor: { select: { id: true, storeName: true, logo: true } },
        inventory: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  async update(id: string, userId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    // Make sure the vendor updating this product actually owns it
    if (product.vendor.userId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.vendor.userId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }

    // Soft delete — just deactivate instead of deleting from the db
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findMyProducts(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return this.prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        category: true,
        inventory: true,
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
