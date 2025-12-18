import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { NotificationWebSocketGateway } from './websocket.gateway';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly wsGateway: NotificationWebSocketGateway, // ✅ Tambahkan WebSocket gateway
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'Returns user notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserNotifications(
    @Req() req: any,
    @Query('isRead') isRead?: string,
    @Query('type') type?: NotificationType,
    @Query('limit') limit?: string,
    @Query('archived') archived?: string,
  ) {
    const filters: any = {};

    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }

    if (type) {
      filters.type = type;
    }

    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    if (archived !== undefined) {
      filters.isArchived = archived === 'true';
    }

    return this.notificationService.getUserNotifications(
      req.user.id,
      filters,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Returns unread count' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Returns notification stats' })
  async getStats(@Req() req: any) {
    return this.notificationService.getStats(req.user.id);
  }

  @Put('mark-read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  async markAsRead(
    @Req() req: any,
    @Body('notificationId') notificationId?: string,
    @Body('ids') ids?: string[],
  ) {
    const result = await this.notificationService.markAsRead(
      req.user.id,
      notificationId,
      ids,
    );

    // Kirim update via WebSocket
    if (result.success && result.count > 0) {
      this.wsGateway.sendNotificationToUser(req.user.id, {
        type: 'NOTIFICATIONS_READ',
        data: {
          count: result.count,
          timestamp: new Date(),
        }
      });
    }

    return result;
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Req() req: any) {
    const result = await this.notificationService.markAllAsRead(req.user.id);

    // Kirim update via WebSocket
    if (result.success && result.count > 0) {
      this.wsGateway.sendNotificationToUser(req.user.id, {
        type: 'ALL_NOTIFICATIONS_READ',
        data: {
          count: result.count,
          timestamp: new Date(),
        }
      });
    }

    return result;
  }

  @Put('archive/:id')
  @ApiOperation({ summary: 'Archive a notification' })
  @ApiResponse({ status: 200, description: 'Notification archived' })
  async archiveNotification(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.notificationService.archiveNotification(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.deleteNotification(req.user.id, id);
  }

  // =============================================
  // TESTING ENDPOINTS (Untuk development saja)
  // =============================================

  @Post('test/notification')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create test notification' })
  @ApiResponse({ status: 201, description: 'Test notification created' })
  async createTestNotification(@Req() req: any) {
    const notification = await this.notificationService.createNotification({
      userId: req.user.id,
      type: NotificationType.SYSTEM,
      title: 'Test Notification',
      message: 'This is a test notification from the system. Time: ' + new Date().toLocaleTimeString(),
      icon: 'announcement',
      iconColor: '#3B82F6',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        action: 'view_test',
      },
      createdBy: req.user.id,
      relatedEntityId: 'test-123',
      relatedEntityType: 'test',
    });

    return {
      success: true,
      message: 'Test notification created and sent via WebSocket',
      notification,
    };
  }

  @Post('test/broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test broadcast notification to all users' })
  @ApiResponse({ status: 200, description: 'Broadcast test sent' })
  async testBroadcastNotification(@Req() req: any) {
    // Broadcast ke semua user yang terkoneksi
    await this.wsGateway.broadcastNotification({
      type: 'TEST_BROADCAST',
      data: {
        title: 'Broadcast Test',
        message: 'This is a broadcast test notification from user: ' + req.user.id,
        timestamp: new Date().toISOString(),
        sender: req.user.namaLengkap || req.user.email,
      }
    });

    return {
      success: true,
      message: 'Broadcast test sent to all connected users',
      timestamp: new Date(),
    };
  }

  @Post('test/specific/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test send notification to specific user' })
  @ApiResponse({ status: 200, description: 'Test notification sent to specific user' })
  async testSendToSpecificUser(
    @Req() req: any,
    @Param('userId') targetUserId: string,
  ) {
    const userId = parseInt(targetUserId, 10);

    if (isNaN(userId)) {
      return {
        success: false,
        message: 'Invalid user ID',
      };
    }

    // Kirim langsung via WebSocket (tanpa save ke database)
    await this.wsGateway.sendNotificationToUser(userId, {
      type: 'TEST_DIRECT',
      data: {
        title: 'Direct Test Notification',
        message: `This is a direct test from user ${req.user.id} to you`,
        timestamp: new Date().toISOString(),
        sender: req.user.namaLengkap || req.user.email,
        priority: 'high',
      }
    });

    return {
      success: true,
      message: `Test notification sent to user ${userId}`,
      timestamp: new Date(),
    };
  }

  @Post('test/announcement')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test announcement notification' })
  async testAnnouncementNotification(@Req() req: any) {
    const result = await this.notificationService.createAnnouncementNotification(
      999, // announcementId
      req.user.id, // createdBy
      'Test Pengumuman Penting',
      'Ini adalah pengumuman test untuk memverifikasi sistem notifikasi. Silakan periksa notifikasi Anda.',
      'ALL_RESIDENTS', // targetAudience
    );

    return {
      success: true,
      message: 'Test announcement created',
      result,
    };
  }

  @Post('test/emergency')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test emergency notification' })
  async testEmergencyNotification(@Req() req: any) {
    const notification = await this.notificationService.createEmergencyNotification(
      888, // emergencyId
      req.user.id, // userId
      'KEBAKARAN', // type
      'Jl. Merdeka No. 123', // location
      '05' // targetRT (opsional)
    );

    return {
      success: true,
      message: 'Test emergency notification created and broadcasted',
      notification,
    };
  }

  @Post('test/payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test payment notification' })
  async testPaymentNotification(@Req() req: any) {
    // Simulasi pembayaran berhasil
    const notification = await this.notificationService.createPaymentNotification(
      777, // paymentId
      req.user.id, // userId
      'PAID', // status
      500000, // amount
      'Pembayaran iuran bulanan', // description
    );

    return {
      success: true,
      message: 'Test payment notification created',
      notification,
    };
  }

  @Post('test/bill')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test bill notification' })
  async testBillNotification(@Req() req: any) {
    const notification = await this.notificationService.createBillNotification(
      'bill-test-123', // billId
      req.user.id, // userId
      req.user.id, // createdBy (admin)
      750000, // amount
      'Tagihan Keamanan Bulan November', // title
    );

    return {
      success: true,
      message: 'Test bill notification created',
      notification,
    };
  }

  @Get('test/ws-connections')
  @ApiOperation({ summary: 'Get WebSocket connection status' })
  @ApiResponse({ status: 200, description: 'Returns WebSocket connection info' })
  async getWebSocketConnections(@Req() req: any) {
    // Method ini perlu ditambahkan di WebSocket gateway
    return {
      success: true,
      message: 'WebSocket connection info',
      timestamp: new Date(),
      // Info koneksi bisa diakses via wsGateway jika ada public method
    };
  }

  @Get('test/ws-ping')
  @ApiOperation({ summary: 'Ping WebSocket connection' })
  async pingWebSocket(@Req() req: any) {
    // Kirim ping ke user via WebSocket
    await this.wsGateway.sendNotificationToUser(req.user.id, {
      type: 'PING',
      data: {
        message: 'Ping from server',
        timestamp: new Date().toISOString(),
        serverTime: new Date(),
      }
    });

    return {
      success: true,
      message: 'Ping sent via WebSocket',
      timestamp: new Date(),
    };
  }
}