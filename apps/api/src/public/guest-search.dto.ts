import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateGuestSessionDto {
  @IsString() @Length(0, 32) pin = '';
}

export class GuestConsentDto {
  @IsBoolean() accepted!: boolean;
  @IsString() @Length(1, 32) version!: string;
}

export class GuestPhotoDownloadDto {
  @IsUUID() searchId!: string;
}

export class GuestBulkDownloadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  photoIds!: string[];
}
