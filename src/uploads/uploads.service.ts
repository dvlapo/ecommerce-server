import { BadRequestException, Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class UploadsService {
  constructor(private cloudinaryService: CloudinaryService) {}

  async uploadProductImages(files: Express.Multer.File[] = []) {
    if (!files.length) {
      throw new BadRequestException('At least one image file is required');
    }

    const images = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadProductImage(file)),
    );

    return { images };
  }
}
