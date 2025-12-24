import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { title } from 'process';
import { NotificationWebSocketGateway } from './websocket.gateway';

@Injectable()
export class NotificationService {
  archiveNotification(id: any, id1: string) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: NotificationWebSocketGateway,
  ) { }

  // Helper function to convert data to Prisma format
  private convertToPrismaJson(data: any): any {
    if (data === null || data === undefined) {
      return null; // Prisma akan handle ini sebagai DbNull
    }
    return data; // Prisma akan otomatis konversi ke JsonValue
  }

  // Validasi apakah user dengan ID tertentu ada
  private async validateUserExists(userId: number): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      return !!user;
    } catch (error) {
      return false;
    }
  }

  // CREATE NOTIFICATION (DIPERBAIKI)
  async createNotification(data: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    iconColor?: string;
    data?: any;
    scheduledAt?: Date;
    expiresAt?: Date;
    createdBy: number;
    relatedEntityId?: string;
    relatedEntityType?: string;
  }) {
    try {
      // Validasi createdBy user
      const createdByUserExists = await this.validateUserExists(data.createdBy);
      if (!createdByUserExists) {
        this.logger.warn(`User with ID ${data.createdBy} not found, using fallback`);

        // Cari admin user sebagai fallback
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });

        if (adminUser) {
          data.createdBy = adminUser.id;
        } else {
          // Jika tidak ada admin, gunakan user pertama
          const firstUser = await this.prisma.user.findFirst({
            orderBy: { id: 'asc' },
            select: { id: true }
          });
          if (firstUser) {
            data.createdBy = firstUser.id;
          } else {
            throw new Error('No users found in database');
          }
        }
      }

      // Validasi userId (penerima notifikasi)
      const recipientExists = await this.validateUserExists(data.userId);
      if (!recipientExists) {
        this.logger.error(`Recipient user with ID ${data.userId} not found`);
        throw new Error(`Recipient user not found`);
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          icon: data.icon,
          iconColor: data.iconColor,
          data: this.convertToPrismaJson(data.data),
          scheduledAt: data.scheduledAt,
          expiresAt: data.expiresAt,
          createdBy: data.createdBy,
          relatedEntityId: data.relatedEntityId,
          relatedEntityType: data.relatedEntityType,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              namaLengkap: true,
            },
          },
          user: {
            select: {
              id: true,
              namaLengkap: true,
            }
          }
        },
      });

      // Kirim real-time notification via WebSocket
      try {
        await this.websocketGateway.sendNotificationToUser(data.userId, {
          type: 'NEW_NOTIFICATION',
          data: {
            ...notification,
            timeAgo: 'Baru saja',
            iconData: this.getIconData(data.type, data.icon),
          }
        });
      } catch (wsError) {
        this.logger.warn('Failed to send WebSocket notification:', wsError.message);
        // Jangan throw error jika WebSocket gagal
      }

      this.logger.log(`Notification created: ${data.title} for user ${data.userId} by user ${data.createdBy}`);

      return notification;
    } catch (error) {
      this.logger.error('Failed to create notification:', error);

      // Return error yang lebih user-friendly
      if (error.code === 'P2003') {
        throw new Error(`User not found. Please check if user IDs ${data.userId} and ${data.createdBy} exist in the database.`);
      }

      throw error;
    }
  }

  // Helper untuk mendapatkan icon berdasarkan type
  private getIconData(type: NotificationType, customIcon?: string): any {
    const iconMap = {
      [NotificationType.ANNOUNCEMENT]: { icon: 'announcement', color: '#3B82F6' },
      [NotificationType.BILL]: { icon: 'receipt', color: '#EF4444' },
      [NotificationType.PAYMENT]: { icon: 'payment', color: '#10B981' },
      [NotificationType.EMERGENCY]: { icon: 'warning', color: '#DC2626' },
      [NotificationType.COMMUNITY]: { icon: 'people', color: '#8B5CF6' },
      [NotificationType.REPORT]: { icon: 'report', color: '#F59E0B' },
    };

    if (customIcon) {
      return { icon: customIcon, color: '#6B7280' };
    }

    return iconMap[type] || { icon: 'notifications', color: '#6B7280' };
  }

  // GET USER NOTIFICATIONS
  async getUserNotifications(userId: number, filters?: {
    isRead?: boolean;
    type?: NotificationType;
    limit?: number;
  }, pagination?: PaginationDto) {
    try {
      const where: any = {
        userId,
        isArchived: false,
      };

      if (filters?.isRead !== undefined) {
        where.isRead = filters.isRead;
      }

      if (filters?.type) {
        where.type = filters.type;
      }

      const notifications = await this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        include: {
          createdByUser: {
            select: {
              id: true,
              namaLengkap: true,
            },
          },
        },
      });

      return notifications;
    } catch (error) {
      this.logger.error('Failed to get notifications', error);
      throw error;
    }
  }

  // GET UNREAD COUNT
  async getUnreadCount(userId: number) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
      });

      return { count };
    } catch (error) {
      this.logger.error('Failed to get unread count', error);
      throw error;
    }
  }

  // MARK AS READ
  async markAsRead(userId: number, notificationId?: string, ids?: string[]) {
    try {
      const where: any = {
        userId,
        isRead: false,
        isArchived: false,
      };

      if (notificationId) {
        where.id = notificationId;
      } else if (ids && ids.length > 0) {
        where.id = { in: ids };
      }

      const result = await this.prisma.notification.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return {
        success: true,
        count: result.count,
      };
    } catch (error) {
      this.logger.error('Failed to mark as read', error);
      throw error;
    }
  }

  // MARK ALL AS READ
  async markAllAsRead(userId: number) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
          isArchived: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return {
        success: true,
        count: result.count,
      };
    } catch (error) {
      this.logger.error('Failed to mark all as read', error);
      throw error;
    }
  }

  // DELETE NOTIFICATION
  async deleteNotification(userId: number, notificationId: string) {
    try {
      await this.prisma.notification.delete({
        where: {
          id: notificationId,
          userId,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete notification', error);
      throw error;
    }
  }

  // CREATE BULK NOTIFICATIONS
  async createBulkNotifications(userIds: number[], data: {
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    iconColor?: string;
    data?: any;
    scheduledAt?: Date;
    expiresAt?: Date;
    createdBy: number;
    relatedEntityId?: string;
    relatedEntityType?: string;
  }) {
    try {
      const notifications = await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: data.type,
          title: data.title,
          message: data.message,
          icon: data.icon,
          iconColor: data.iconColor,
          data: this.convertToPrismaJson(data.data),
          scheduledAt: data.scheduledAt,
          expiresAt: data.expiresAt,
          createdBy: data.createdBy,
          relatedEntityId: data.relatedEntityId,
          relatedEntityType: data.relatedEntityType,
        })),
      });
      return { success: true, count: notifications.count };
    } catch (error) {
      this.logger.error('Failed to create bulk notifications', error);
      throw error;
    }
  }

  // CREATE ANNOUNCEMENT NOTIFICATION (update dengan broadcast)
  async createAnnouncementNotification(
    announcementId: number,
    createdBy: number,
    title: string,
    message: string,
    targetAudience: string,
  ) {
    try {
      // Get users based on target audience
      let users: any[] = [];

      if (targetAudience === 'ALL_RESIDENTS') {
        users = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
      } else if (targetAudience.startsWith('RT_')) {
        const rt = targetAudience.split('_')[1];
        users = await this.prisma.user.findMany({
          where: {
            isActive: true,
            rtRw: { contains: rt },
          },
          select: { id: true },
        });
      } else {
        users = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
      }

      if (users.length === 0) {
        return { success: true, count: 0 };
      }

      // Create notifications
      const userIds = users.map(user => user.id);
      const result = await this.createBulkNotifications(userIds, {
        type: NotificationType.ANNOUNCEMENT,
        title: 'Pengumuman Baru: ' + title,
        message: message,
        icon: 'announcement',
        iconColor: '#3B82F6',
        data: {
          announcementId,
          targetAudience,
          action: 'view_announcement',
        },
        createdBy,
        relatedEntityId: announcementId.toString(),
        relatedEntityType: 'announcement',
      });

      // Broadcast via WebSocket
      await this.websocketGateway.broadcastNotification({
        type: 'NEW_ANNOUNCEMENT',
        data: {
          announcementId,
          title: 'Pengumuman Baru: ' + title,
          message,
          targetAudience,
          timestamp: new Date(),
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create announcement notifications', error);
      throw error;
    }
  }

  // CREATE BILL NOTIFICATION
  async createBillNotification(
    billId: string,
    userId: number,
    createdBy: number,
    amount: number,
    title: string,
  ) {
    try {
      const notification = await this.createNotification({
        userId,
        type: NotificationType.BILL,
        title: 'Tagihan Baru: ' + title,
        message: `Anda memiliki tagihan baru sebesar Rp ${amount.toLocaleString('id-ID')}`,
        icon: 'receipt',
        iconColor: '#EF4444',
        createdBy,
        relatedEntityId: billId,
        relatedEntityType: 'bill',
        data: {
          billId,
          amount,
          title,
          action: 'view_bill',
        },
      });

      // Broadcast via WebSocket ke semua user yang terkoneksi
      await this.websocketGateway.broadcastNotification({
        type: 'NEW_BILL',
        data: {
          billId,
          userId,
          amount, 
          title,
          createdBy
        }
      });

      return notification;
    } catch (error) {
      this.logger.error('Failed to create bill notification', error);
      throw error;
    }
  }

  // CREATE PAYMENT NOTIFICATION
  async createPaymentNotification(
    paymentId: number,
    userId: number,
    status: string,
    amount: number,
    description: string,
  ) {
    try {
      let title, message, iconColor;

      switch (status) {
        case 'PAID':
          title = 'Pembayaran Berhasil';
          message = `Pembayaran sebesar Rp ${amount.toLocaleString('id-ID')} berhasil`;
          iconColor = '#10B981';
          break;
        case 'FAILED':
          title = 'Pembayaran Gagal';
          message = `Pembayaran sebesar Rp ${amount.toLocaleString('id-ID')} gagal`;
          iconColor = '#EF4444';
          break;
        case 'PENDING':
          title = 'Pembayaran Tertunda';
          message = `Pembayaran sebesar Rp ${amount.toLocaleString('id-ID')} menunggu konfirmasi`;
          iconColor = '#F59E0B';
          break;
        default:
          title = 'Status Pembayaran';
          message = `Pembayaran sebesar Rp ${amount.toLocaleString('id-ID')} ${status.toLowerCase()}`;
          iconColor = '#6B7280';
      }

      const notification = await this.createNotification({
        userId,
        type: NotificationType.PAYMENT,
        title,
        message: message + ' - ' + description,
        icon: 'payment',
        iconColor,
        createdBy: userId,
        relatedEntityId: paymentId.toString(),
        relatedEntityType: 'payment',
        data: {
          paymentId,
          amount,
          status,
          description,
          action: 'view_payment',
        },
      });

      // Broadcast via WebSocket ke semua user yang terkoneksi
      await this.websocketGateway.broadcastNotification({
        type: 'NEW_PAYMENT',
        data: {
          paymentId,
          userId,
          amount,
          status,
          description,
        }
      });

      return notification;
    } catch (error) {
      this.logger.error('Failed to create payment notification', error);
      throw error;
    }
  }

  // CREATE EMERGENCY NOTIFICATION (update dengan broadcast)
  async createEmergencyNotification(
    emergencyId: number,
    userId: number,
    type: string,
    location: string,
    targetRT?: string // Opsional: untuk broadcast ke RT tertentu
  ) {
    try {
      const notification = await this.createNotification({
        userId,
        type: NotificationType.EMERGENCY,
        title: 'Keadaan Darurat',
        message: `Ada keadaan darurat ${type} di ${location}`,
        icon: 'warning',
        iconColor: '#DC2626',
        createdBy: userId,
        relatedEntityId: emergencyId.toString(),
        relatedEntityType: 'emergency',
        data: {
          emergencyId,
          type,
          location,
          action: 'view_emergency',
        },
      });

      // Broadcast ke RT tertentu jika ada, atau ke semua
      if (targetRT) {
        await this.websocketGateway.broadcastToRT(targetRT, {
          type: 'EMERGENCY_ALERT',
          data: {
            ...notification,
            emergencyType: type,
            location,
            timestamp: new Date(),
            priority: 'high'
          }
        });
      } else {
        await this.websocketGateway.broadcastNotification({
          type: 'EMERGENCY_ALERT',
          data: {
            ...notification,
            emergencyType: type,
            location,
            timestamp: new Date(),
            priority: 'high'
          }
        });
      }

      return notification;
    } catch (error) {
      this.logger.error('Failed to create emergency notification', error);
      throw error;
    }
  }

  // GET NOTIFICATION STATS
  async getStats(userId: number) {
    try {
      const [total, unread, todayCount, byType] = await Promise.all([
        this.prisma.notification.count({
          where: { userId, isArchived: false },
        }),
        this.prisma.notification.count({
          where: { userId, isRead: false, isArchived: false },
        }),
        this.prisma.notification.count({
          where: {
            userId,
            isArchived: false,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prisma.notification.groupBy({
          by: ['type'],
          where: { userId, isArchived: false },
          _count: true,
        }),
      ]);

      const byTypeObj = byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {});

      return {
        total,
        unread,
        today: todayCount,
        byType: byTypeObj,
      };
    } catch (error) {
      this.logger.error('Failed to get notification stats', error);
      throw error;
    }
  }

  // CREATE REPORT NOTIFICATION (BARU - untuk admin)
  async createReportNotification(
    reportId: number,
    userId: number,
    reportType: string,
    description: string,
    adminIds: number[] // Admin yang perlu diberitahu
  ) {
    try {
      // Buat notifikasi untuk admin
      for (const adminId of adminIds) {
        await this.createNotification({
          userId: adminId,
          type: NotificationType.REPORT,
          title: 'Laporan Baru',
          message: `Ada laporan ${reportType}: ${description.substring(0, 50)}...`,
          icon: 'report',
          iconColor: '#F59E0B',
          createdBy: userId,
          relatedEntityId: reportId.toString(),
          relatedEntityType: 'report',
          data: {
            reportId,
            type: reportType,
            description,
            action: 'view_report',
          },
        });
      }

      // Notifikasi untuk user yang melaporkan
      const userNotification = await this.createNotification({
        userId,
        type: NotificationType.REPORT,
        title: 'Laporan Berhasil',
        message: `Laporan ${reportType} Anda berhasil dibuat dan sedang diproses`,
        icon: 'check_circle',
        iconColor: '#10B981',
        createdBy: userId,
        relatedEntityId: reportId.toString(),
        relatedEntityType: 'report',
        data: {
          reportId,
          type: reportType,
          action: 'view_report_status',
        },
      });

      return userNotification;
    } catch (error) {
      this.logger.error('Failed to create report notification', error);
      throw error;
    }
  }
}