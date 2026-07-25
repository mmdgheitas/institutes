import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface SmsResult {
  delivered: boolean;
  provider: string;
  messageId: string | null;
  error?: string;
}

/**
 * SMS gateway abstraction supporting Kavenegar and FarazSMS.
 *
 * The `console` provider (the default in development and tests) logs messages
 * instead of sending them, so no external credentials are required to run the
 * full OTP flow locally.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    const ttlMinutes = Math.ceil(
      this.config.get('otp', { infer: true }).ttlSeconds / 60,
    );
    return this.send(
      phone,
      `Your verification code is ${code}. It expires in ${ttlMinutes} minute(s).`,
      'otp',
    );
  }

  async sendLeadNotification(phone: string, instituteName: string): Promise<SmsResult> {
    return this.send(
      phone,
      `Your pre-registration at ${instituteName} was received. They will contact you shortly.`,
      'lead',
    );
  }

  async sendContractConfirmation(
    phone: string,
    instituteName: string,
    referenceId: string,
  ): Promise<SmsResult> {
    return this.send(
      phone,
      `Your agreement with ${instituteName} is registered. Reference: ${referenceId}`,
      'contract',
    );
  }

  async send(phone: string, message: string, template = 'generic'): Promise<SmsResult> {
    const smsConfig = this.config.get('sms', { infer: true });

    if (smsConfig.provider === 'console' || !smsConfig.apiKey) {
      this.logger.log(`[SMS:${template}] → ${phone}: ${message}`);
      return { delivered: true, provider: 'console', messageId: `console-${Date.now()}` };
    }

    try {
      if (smsConfig.provider === 'kavenegar') {
        return await this.sendViaKavenegar(phone, message, smsConfig);
      }
      return await this.sendViaFarazSms(phone, message, smsConfig);
    } catch (error) {
      // A failed SMS must never break the surrounding business transaction.
      const reason = (error as Error).message;
      this.logger.error(`SMS delivery to ${phone} failed: ${reason}`);
      return {
        delivered: false,
        provider: smsConfig.provider,
        messageId: null,
        error: reason,
      };
    }
  }

  private async sendViaKavenegar(
    phone: string,
    message: string,
    smsConfig: AppConfig['sms'],
  ): Promise<SmsResult> {
    const url =
      `https://api.kavenegar.com/v1/${encodeURIComponent(smsConfig.apiKey)}/sms/send.json` +
      `?receptor=${encodeURIComponent(phone)}` +
      `&sender=${encodeURIComponent(smsConfig.sender)}` +
      `&message=${encodeURIComponent(message)}`;

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json()) as {
      return?: { status: number; message: string };
      entries?: { messageid: number }[];
    };

    if (!response.ok || payload.return?.status !== 200) {
      throw new Error(payload.return?.message ?? `HTTP ${response.status}`);
    }

    return {
      delivered: true,
      provider: 'kavenegar',
      messageId: payload.entries?.[0]?.messageid?.toString() ?? null,
    };
  }

  private async sendViaFarazSms(
    phone: string,
    message: string,
    smsConfig: AppConfig['sms'],
  ): Promise<SmsResult> {
    const response = await fetch('https://ippanel.com/api/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        op: 'send',
        uname: smsConfig.apiKey,
        pass: smsConfig.apiKey,
        message,
        from: smsConfig.sender,
        to: [phone],
      }),
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const messageId = Array.isArray(payload) ? String(payload[1] ?? '') : null;
    return { delivered: true, provider: 'farazsms', messageId };
  }
}
