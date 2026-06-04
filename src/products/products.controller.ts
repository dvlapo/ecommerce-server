import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, FilterProductDto, UpdateProductDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from 'generated/prisma/enums';
import { type User } from 'generated/prisma/client';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // Public — list all products with filters
  @Get()
  findAll(@Query() filters: FilterProductDto) {
    return this.productsService.findAll(filters);
  }

  // Public — get a single product
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // Vendor only — get their own products
  @Roles(Role.VENDOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('my/products')
  findMyProducts(@CurrentUser() user: User) {
    return this.productsService.findMyProducts(user.id);
  }

  // Vendor only — create a product
  @Roles(Role.VENDOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }

  // Vendor only — update their own product
  @Roles(Role.VENDOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, user.id, dto);
  }

  // Vendor only — soft delete their own product
  @Roles(Role.VENDOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productsService.remove(id, user.id);
  }
}
