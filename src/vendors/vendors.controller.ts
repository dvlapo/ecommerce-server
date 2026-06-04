import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, type User } from 'generated/prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  // Any authenticated user — become a vendor
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(user.id, dto);
  }

  // Any authenticated vendor — get their own store
  @Roles(Role.VENDOR)
  @UseGuards(RolesGuard)
  @Get('my-store')
  getMyStore(@CurrentUser() user: User) {
    return this.vendorsService.getMyStore(user.id);
  }

  // Any authenticated vendor — update their own store
  @Roles(Role.VENDOR)
  @UseGuards(RolesGuard)
  @Patch('my-store')
  updateMyStore(@CurrentUser() user: User, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.updateMyStore(user.id, dto);
  }

  // Admin only — list all vendors
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  // Public — get a vendor's public profile
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  // Admin only — approve a vendor
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.vendorsService.approve(id);
  }
}
