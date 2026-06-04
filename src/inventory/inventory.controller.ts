import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, type User } from 'generated/prisma/client';

@Roles(Role.VENDOR)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // Vendor — view all their inventory (lowest stock first)
  @Get()
  getMyInventory(@CurrentUser() user: User) {
    return this.inventoryService.getMyInventory(user.id);
  }

  // Vendor — view low stock alerts
  @Get('low-stock')
  getLowStockAlerts(@CurrentUser() user: User) {
    return this.inventoryService.getLowStockAlerts(user.id);
  }

  // Vendor — view inventory for a specific product
  @Get(':productId')
  getInventory(@Param('productId') productId: string) {
    return this.inventoryService.getInventory(productId);
  }

  // Vendor — restock a product
  @Patch(':productId')
  updateStock(
    @Param('productId') productId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateStock(productId, user.id, dto);
  }
}
