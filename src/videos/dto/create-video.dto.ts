import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export enum VoiceGender {
  Female = 'female',
  Male = 'male',
}

export enum VoiceStyle {
  Neutral = 'neutral',
  Narrator = 'narrator',
}

export class VoiceSettingsDto {
  @IsEnum(VoiceGender)
  gender: VoiceGender;

  @IsString()
  @IsNotEmpty()
  voice_name: string;

  @IsEnum(VoiceStyle)
  style: VoiceStyle;
}
export class CreateVideoDto {
  @IsUrl()
  @IsNotEmpty()
  videoUrl: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VoiceSettingsDto)
  voice?: VoiceSettingsDto;
}
