import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { StrictThrottle } from '../security/throttle.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @StrictThrottle()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      const user = await this.authService.validateUser(
        loginDto.username,
        loginDto.password,
      );
      return this.authService.login(user);
    } catch (err: any) {
      this.logger.error(`Login failed: ${err?.message ?? err}`, err?.stack);
      throw err;
    }
  }

  @StrictThrottle()
  @Post('register')
  async register(
    @Body()
    registerDto: {
      username: string;
      password: string;
      name: string;
      email?: string;
      roles?: string[];
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
