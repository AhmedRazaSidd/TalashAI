import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminFilterUserDto } from './dto/admin-filter-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('User Management (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  async getAllUsers(@Query() filterDto: AdminFilterUserDto) {
    const result = await this.userService.findAllUsers(filterDto);
    return {
      success: true,
      message: 'Users retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    // Let's strip out sensitive fields before sending. We can rely on a method or just do it here.
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      success: true,
      message: 'User retrieved successfully',
      data: userObj,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user properties (Role, etc.)' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateDto: AdminUpdateUserDto,
  ) {
    const result = await this.userService.updateUserAdmin(id, updateDto);
    return {
      success: true,
      message: 'User updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user account' })
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: null,
    };
  }
}
