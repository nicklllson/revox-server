/**
 * Конфигурация стоимости провайдеров в кредитах.
 *
 * 1 кредит = базовая стоимость минуты обработки (Whisper base + Edge TTS).
 *
 * Pro и Ultra модели тратят больше кредитов за ту же минуту видео,
 * потому что реально потребляют больше ресурсов:
 *   - Whisper large/medium медленнее на CPU
 *   - Silero/ElevenLabs дороже edge-tts
 *   - Multi-speaker удваивает работу синтеза
 *
 * Стоимость одного перевода = (whisper_cost + tts_cost) × features_multiplier
 * за каждую минуту обработки.
 */

export const WHISPER_COSTS = {
  base: 0.5,
  small: 1.0,
  medium: 2.0,
  'large-v3': 3.5,
} as const;

export const TTS_COSTS = {
  'edge-tts': 0.5,
  silero: 1.5,
  elevenlabs: 8.0,
} as const;

export const TRANSLATOR_COSTS = {
  google: 0.0,
  deepseek: 0.2,
  argos: 0.0,
} as const;

export const FEATURE_MULTIPLIERS = {
  multiSpeaker: 1.3,
} as const;

export interface ProvidersForPricing {
  whisper: string;
  tts: string;
  translator: string;
}

export interface FeaturesForPricing {
  multiSpeaker?: boolean;
}

export function getCreditsPerMinute(
  providers: ProvidersForPricing,
  features: FeaturesForPricing = {},
): number {
  const whisperCost =
    WHISPER_COSTS[providers.whisper as keyof typeof WHISPER_COSTS] ?? 1.0;
  const ttsCost = TTS_COSTS[providers.tts as keyof typeof TTS_COSTS] ?? 0.5;
  const translatorCost =
    TRANSLATOR_COSTS[providers.translator as keyof typeof TRANSLATOR_COSTS] ??
    0.0;

  let total = whisperCost + ttsCost + translatorCost;

  if (features.multiSpeaker) {
    total *= FEATURE_MULTIPLIERS.multiSpeaker;
  }

  return total;
}

export function estimateCreditsForVideo(
  durationSec: number,
  providers: ProvidersForPricing,
  features: FeaturesForPricing = {},
): number {
  const minutes = durationSec / 60;
  return minutes * getCreditsPerMinute(providers, features);
}
