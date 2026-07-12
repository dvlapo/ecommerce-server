import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import * as argon2 from 'argon2';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role ?? 'CUSTOMER',
        },
      });

      // Auto-create vendor profile if registering as a vendor
      if (dto.role === 'VENDOR') {
        await tx.vendor.create({
          data: {
            userId: newUser.id,
            storeName: `${newUser.firstName}'s Store`, // placeholder
          },
        });
      }

      return newUser;
    });

    return this.signTokensAndStoreRefreshToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await argon2.verify(user.password, dto.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.signTokensAndStoreRefreshToken(user.id, user.email);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string; email: string; tokenId: string; type: string };

    try {
      payload = await this.jwt.verifyAsync(dto.refresh_token, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await argon2.verify(
      user.refreshTokenHash,
      dto.refresh_token,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.signTokensAndStoreRefreshToken(user.id, user.email);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { message: 'Logged out successfully' };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  private async signTokensAndStoreRefreshToken(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userId, email),
      this.signRefreshToken(userId, email),
    ]);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: await argon2.hash(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async signAccessToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    const secret = this.config.get('JWT_SECRET');

    return this.jwt.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      secret,
    });
  }

  private async signRefreshToken(userId: string, email: string) {
    const payload = {
      sub: userId,
      email,
      tokenId: randomUUID(),
      type: 'refresh',
    };

    return this.jwt.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      secret: this.getRefreshTokenSecret(),
    });
  }

  private getRefreshTokenSecret() {
    return (
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.get<string>('JWT_SECRET')
    );
  }
}
