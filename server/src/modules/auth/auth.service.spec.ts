import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: any;
  let jwtService: any;

  const mockUser = {
    _id: 'user_id',
    name: 'Ahmed Ali',
    phone_number: '03001234567',
    password: 'hashed_password',
    role: 'user',
    toObject: jest.fn().mockReturnValue({ _id: 'user_id', name: 'Ahmed Ali', role: 'user' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByPhoneNumber: jest.fn(),
            create: jest.fn(),
            updateRefreshToken: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'access_secret';
              if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    const signupDto = {
      name: 'Ahmed Ali',
      phone_number: '03001234567',
      password: 'password123',
      state: 'Punjab',
      city: 'Lahore',
      gender: 'male',
    };

    it('should throw BadRequestException if user exists', async () => {
      userService.findByPhoneNumber.mockResolvedValue(mockUser);
      await expect(service.signup(signupDto)).rejects.toThrow(BadRequestException);
    });

    it('should register a new user successfully', async () => {
      userService.findByPhoneNumber.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser);
      
      const result = await service.signup(signupDto);
      expect(result.success).toBe(true);
      expect(userService.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = { phone_number: '03001234567', password: 'password123' };

    it('should throw UnauthorizedException for invalid credentials', async () => {
      userService.findByPhoneNumber.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully with correct credentials', async () => {
      userService.findByPhoneNumber.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);
      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBeDefined();
    });
  });
});
