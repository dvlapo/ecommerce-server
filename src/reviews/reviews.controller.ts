import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ListReviewsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, type User } from 'generated/prisma/client';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Roles(Role.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  @Roles(Role.VENDOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('vendor/my-products')
  findVendorProductReviews(
    @CurrentUser() user: User,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviewsService.findVendorProductReviews(user.id, query);
  }

  @Roles(Role.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('products/:productId/eligibility')
  getEligibility(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.getEligibility(user.id, productId);
  }

  @Get('products/:productId')
  findProductReviews(
    @Param('productId') productId: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviewsService.findProductReviews(productId, query);
  }
}
