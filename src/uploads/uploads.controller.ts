import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

const MAX_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('uploads')
@Roles(Role.VENDOR)
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('product-images')
  @UseInterceptors(
    FilesInterceptor('images', MAX_PRODUCT_IMAGES, {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES,
        files: MAX_PRODUCT_IMAGES,
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  uploadProductImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadsService.uploadProductImages(files);
  }
}
