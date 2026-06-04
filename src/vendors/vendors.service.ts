import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateVendorDto) {
    const existing = await this.prisma.vendor.findUnique({ where: { userId } });

    if (existing) {
      throw new ConflictException('You already have a vendor profile');
    }

    return this.prisma.vendor.create({
      data: {
        userId,
        storeName: dto.storeName,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.vendor.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });

    if (!vendor) throw new NotFoundException('Vendor not found');

    return vendor;
  }

  async updateMyStore(userId: string, dto: UpdateVendorDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });

    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return this.prisma.vendor.update({
      where: { userId },
      data: dto,
    });
  }

  async approve(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });

    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.vendor.update({
      where: { id },
      data: { isApproved: true },
    });
  }

  async getMyStore(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: {
        products: true,
      },
    });

    if (!vendor)
      throw new NotFoundException('You do not have a vendor profile yet');

    return vendor;
  }
}
