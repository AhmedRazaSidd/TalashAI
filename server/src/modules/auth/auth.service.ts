import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existingUser = await this.userService.findByPhoneNumber(signupDto.phone_number);
    if (existingUser) {
      throw new BadRequestException('Phone number is already in use');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    const user = await this.userService.create({
      ...signupDto,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(user._id.toString(), user.role);
    await this.userService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

    const { password, ...userWithoutPassword } = user.toObject();
    
    return {
      success: true,
      message: 'User registered successfully',
      data: {
        user: userWithoutPassword,
        ...tokens,
      },
    };
  }

  async login(loginDto: LoginDto, requireAdmin = false) {
    const user = await this.userService.findByPhoneNumber(loginDto.phone_number);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (requireAdmin && user.role !== 'admin') {
      throw new UnauthorizedException('Admin access required');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.role);
    await this.userService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

    const { password, ...userWithoutPassword } = user.toObject();

    return {
      success: true,
      message: 'Logged in successfully',
      data: {
        user: userWithoutPassword,
        ...tokens,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');

      const decoded = this.jwtService.verify(refreshToken, { secret });
      
      const user = await this.userService.findById(decoded.sub);
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user._id.toString(), user.role);
      await this.userService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

      return {
        success: true,
        message: 'Tokens refreshed successfully',
        data: tokens,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(userId: string, role: string) {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not defined');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: accessSecret,
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: refreshSecret,
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
