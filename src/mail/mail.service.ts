import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get('GMAIL_USER'),
        pass: this.config.get('GMAIL_APP_PASSWORD'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"ReVox" <${this.config.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Код подтверждения',
        text: `Code: ${code}`,
        html: `<p>Code: <strong>${code}</strong></p>`,
      });
      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendResetPassword(email: string, token: string) {
    try {
      const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

      await this.transporter.sendMail({
        to: email,
        subject: 'Password reset',
        html: `<p>Click the link to reset your password (valid 30 minutes):</p>
               <a href="${url}">${url}</a>`,
      });
      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }
}
