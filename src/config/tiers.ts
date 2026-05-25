import { SubscriptionTier } from 'generated/prisma/enums';

export interface TierFeatures {
  multiSpeaker: boolean;
  voiceSelection: boolean;
  watermark: boolean;
  priorityQueue: boolean;
}

export interface TierConfig {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceUsd: number;
  // Сколько кредитов даётся в месяц
  creditsPerMonth: number;
  maxVideoLengthMinutes: number;
  features: TierFeatures;
  availableTranslators: string[];
  availableTtsProviders: string[];
  availableWhisperModels: string[];
}

/**
 * Тарифные планы.
 *
 * Кредиты рассчитаны так, чтобы:
 * - FREE мог попробовать Revox Lite (~1 кредит/мин) на 5 часов в месяц
 * - PRO работал на Revox Pro (~2.5 кредита/мин) минимум те же 5 часов
 * - PREMIUM работал на Revox Ultra (~4.5 кредита/мин) на 5+ часов
 */
export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    description: 'Basic video translation to try out the service',
    priceUsd: 0,
    creditsPerMonth: 300, // 5 часов Lite ИЛИ ~2 часа Pro
    maxVideoLengthMinutes: 30,
    features: {
      multiSpeaker: false,
      voiceSelection: false,
      watermark: true,
      priorityQueue: false,
    },
    availableTranslators: ['google'],
    availableTtsProviders: ['edge-tts'],
    availableWhisperModels: ['base'],
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    description: 'High-quality translation with voice selection',
    priceUsd: 900,
    creditsPerMonth: 1500, // 10 часов Pro ИЛИ ~5.5 часов Ultra
    maxVideoLengthMinutes: 60,
    features: {
      multiSpeaker: true,
      voiceSelection: true,
      watermark: false,
      priorityQueue: true,
    },
    availableTranslators: ['google'],
    availableTtsProviders: ['edge-tts', 'silero'],
    availableWhisperModels: ['base', 'small'],
  },
  PREMIUM: {
    tier: 'PREMIUM',
    name: 'Premium',
    description: 'Premium voiceover and maximum quality',
    priceUsd: 2900,
    creditsPerMonth: 6000,
    maxVideoLengthMinutes: 120,
    features: {
      multiSpeaker: true,
      voiceSelection: true,
      watermark: false,
      priorityQueue: true,
    },
    availableTranslators: ['google'],
    availableTtsProviders: ['edge-tts', 'silero'],
    availableWhisperModels: ['base', 'small', 'medium'],
  },
};

export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIER_CONFIGS[tier];
}
