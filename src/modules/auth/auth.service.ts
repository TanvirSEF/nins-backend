import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../user/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  RefreshTokenService,
  RefreshPayload,
} from './refresh-token.service';

/** Result of login/register/refresh — the controller sets the refresh cookie. */
export interface AuthResult {
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private refreshTokens: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = new this.userModel({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
    });
    const saved = await user.save();

    return this.issueSession(saved);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+passwordHash')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user);
  }

  async validateUser(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, dto, { new: true, runValidators: true })
      .exec();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  /**
   * Rotate the refresh cookie into a new one (same family) and mint a fresh
   * access token. Used by POST /auth/refresh — the cookie is sent automatically
   * by the browser, no access token required.
   */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    // verify() enforces rotation/reuse rules against Redis: throws on reuse
    // (after revoking the whole family) or on an unknown/expired token.
    const payload: RefreshPayload =
      await this.refreshTokens.verify(refreshToken);

    const user = await this.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.signAccessToken(user);
    const rotated = await this.refreshTokens.rotate(payload);
    return { user, accessToken, refreshToken: rotated };
  }

  /**
   * Revoke the presented refresh token (logout of this device). Tolerant: an
   * invalid/expired cookie still clears cleanly client-side.
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.refreshTokens.verify(refreshToken);
      await this.refreshTokens.revoke(payload);
    } catch {
      // Token already invalid/expired — nothing server-side left to revoke.
    }
  }

  /** Issue a brand-new session: short-lived access token + first refresh token. */
  private async issueSession(user: UserDocument): Promise<AuthResult> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.refreshTokens.issue(String(user._id));
    return { user, accessToken, refreshToken };
  }

  private signAccessToken(user: UserDocument): string {
    const payload = { sub: user._id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }
}
