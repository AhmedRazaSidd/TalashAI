import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { UserService } from '../user/user.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase admin credentials missing in .env. Push notifications will be disabled.');
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
      this.initialized = true;
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin', error);
    }
  }

  async sendPushNotification(title: string, body: string, userId?: string): Promise<boolean> {
    if (!this.initialized) {
      this.logger.warn('Cannot send notification: Firebase is not initialized.');
      return false;
    }

    try {
      if (userId) {
        // Send to specific user
        const user = await this.userService.findById(userId);
        if (!user || !user.fcmToken) {
          this.logger.warn(`User ${userId} does not have an FCM token.`);
          return false;
        }

        await admin.messaging().send({
          token: user.fcmToken,
          notification: { title, body },
        });
        
      } else {
        // Send to all users (Multicast)
        const tokens = await this.userService.findAllWithFcmTokens();
        if (tokens.length === 0) {
          this.logger.log('No users with FCM tokens found.');
          return false;
        }

        // Firebase multicast limits to 500 per call, we batch them
        const batchSize = 500;
        for (let i = 0; i < tokens.length; i += batchSize) {
          const batch = tokens.slice(i, i + batchSize);
          await admin.messaging().sendEachForMulticast({
            tokens: batch,
            notification: { title, body },
          });
        }
      }
      return true;
    } catch (error) {
      this.logger.error('Error sending push notification', error);
      return false;
    }
  }
}
