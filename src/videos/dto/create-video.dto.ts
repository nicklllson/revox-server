import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateVideoDto {
  @IsUrl()
  @IsNotEmpty()
  videoUrl: string;

  @IsString()
  @IsNotEmpty()
  language: string;
}
