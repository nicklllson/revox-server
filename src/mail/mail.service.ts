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
        from: `"Revox" <${this.config.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Confirmation code',
        text: `Code: ${code}`,
        html: `<p>Code: <strong>${code}</strong></p>`,
      });
      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendHello(email: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Revox" <${this.config.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Welcome, citizen! Enjoy your Revox adventure',
        text: `
  Welcome to Revox!
  
  We’re glad to have you with us.
  Your account has been successfully created and you’re ready to start using Revox.
  
  If you have any questions, feel free to contact our support team.
  
  Best regards,
  Revox Team
        `,
        html: `
          <div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
                    
                    <tr>
                      <td style="background:#111827;padding:32px;text-align:center;">
                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">
                          Welcome to Revox
                        </h1>
                      </td>
                    </tr>
  
                    <tr>
                      <td style="padding:40px 32px;color:#374151;">
                        <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">
                          Hello!
                        </h2>
  
                        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                          We’re excited to have you join Revox.
                          Your account has been successfully created and everything is ready to go.
                        </p>
  
                        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                          Start exploring the platform and enjoy the experience.
                        </p>
  
                        <div style="margin:32px 0;text-align:center;">
                          <a
                            href="https://revox.ai"
                            style="display:inline-block;padding:14px 28px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-size:16px;font-weight:600;"
                          >
                            Open Revox
                          </a>
                        </div>
  
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                          If you have any questions, simply reply to this email —
                          we’ll be happy to help.
                        </p>
                      </td>
                    </tr>
  
                    <tr>
                      <td style="padding:24px 32px;background:#f9fafb;text-align:center;">
                        <p style="margin:0;font-size:13px;color:#9ca3af;">
                          © ${new Date().getFullYear()} Revox. All rights reserved.
                        </p>
                      </td>
                    </tr>
  
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `,
      });

      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw new Error('Failed to send welcome email');
    }
  }

  async sendHelloGoogle(email: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Revox" <${this.config.get('GMAIL_USER')}>`,
        to: email,
        subject: 'Ok Google how to use Revox?',
        text: `
  Welcome to Revox!
  
  We’re glad to have you with us.
  Your account has been successfully created through Google and you’re ready to start using Revox.
  
  If you have any questions, feel free to contact our support team.
  
  Best regards,
  Revox Team
        `,
        html: `
          <div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
                    
                    <tr>
                      <td style="background:#111827;padding:32px;text-align:center;">
                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">
                          Welcome to Revox
                        </h1>
                      </td>
                    </tr>
  
                    <tr>
                      <td style="padding:40px 32px;color:#374151;">
                        <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">
                          Hello!
                        </h2>
  
                        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                          We’re excited to have you join Revox.
                          Your account has been successfully created and everything is ready to go.
                        </p>
  
                        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                          Start exploring the platform and enjoy the experience.
                        </p>
  
                        <div style="margin:32px 0;text-align:center;">
                          <a
                            href="https://revox.ai"
                            style="display:inline-block;padding:14px 28px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-size:16px;font-weight:600;"
                          >
                            Open Revox
                          </a>
                        </div>
  
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                          If you have any questions, simply reply to this email —
                          we’ll be happy to help.
                        </p>
                      </td>
                    </tr>
  
                    <tr>
                      <td style="padding:24px 32px;background:#f9fafb;text-align:center;">
                        <p style="margin:0;font-size:13px;color:#9ca3af;">
                          © ${new Date().getFullYear()} Revox. All rights reserved.
                        </p>
                      </td>
                    </tr>
  
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `,
      });

      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      throw new Error('Failed to send welcome email');
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
