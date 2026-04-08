import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(4, 4)
  code: string;
}
