import { Controller, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { NotificationDocument, Notification } from './notification.schema';
import { ApiPaginatedResponse } from '../../common/dto';
import { CurrentUser } from '../../common/decorators';
import { UserDocument } from '../user/user.schema';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications (paginated, filtered)' })
  @ApiPaginatedResponse(Notification)
  @ApiResponse({ status: 200, description: 'Paginated notification list' })
  findMyNotifications(
    @CurrentUser() user: UserDocument,
    @Query() filters: NotificationFilterDto,
  ) {
    return this.notificationService.findMyNotifications(
      String(user._id),
      filters,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get my unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  findUnreadCount(@CurrentUser() user: UserDocument) {
    return this.notificationService.findUnreadCount(String(user._id));
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  markAllAsRead(@CurrentUser() user: UserDocument) {
    return this.notificationService.markAllAsRead(String(user._id));
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Marked as read', type: Notification })
  @ApiResponse({ status: 403, description: 'Not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<NotificationDocument> {
    return this.notificationService.markAsRead(id, String(user._id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Notification deleted', type: Notification })
  @ApiResponse({ status: 403, description: 'Not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<NotificationDocument> {
    return this.notificationService.remove(id, String(user._id));
  }
}
