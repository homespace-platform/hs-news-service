import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import type { UserContext } from '../../authentication/domain/user-context';
import { CurrentUser } from '../../authentication/presentation/decorators/current-user.decorator';
import { AdminGuard } from '../../authentication/presentation/guards/admin.guard';
import { GatewayAuthenticationGuard } from '../../authentication/presentation/guards/gateway-authentication.guard';
import { MediaService } from '../media.service';
import {
  CompleteNewsUploadDto,
  CreateNewsUploadDto,
  type CreateNewsUploadResponse,
  type NewsAssetResponse,
} from './dto/media.dto';

@Controller('admin/news/media')
@UseGuards(GatewayAuthenticationGuard, AdminGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  async createUpload(
    @CurrentUser() user: UserContext,
    @Body() request: CreateNewsUploadDto,
  ): Promise<ApiResponseDto<CreateNewsUploadResponse>> {
    return new ApiResponseDto({
      message: 'Upload URL created',
      result: await this.media.createUpload(user.userId, request),
    });
  }

  @Post(':storageId/complete')
  @HttpCode(200)
  async completeUpload(
    @CurrentUser() user: UserContext,
    @Param('storageId') storageId: string,
    @Body() request: CompleteNewsUploadDto = {},
  ): Promise<ApiResponseDto<NewsAssetResponse>> {
    return new ApiResponseDto({
      message: 'Upload completed',
      result: await this.media.completeUpload(
        user.userId,
        storageId,
        request.checksum,
      ),
    });
  }
}
