import {CmsKind,EventLifecycle} from '@prisma/client';
import {IsEnum,IsISO8601,IsOptional,IsString,IsUrl,Length,Matches,MaxLength} from 'class-validator';
export class ContentRevisionDto{
 @IsString() @Length(3,200) title!:string;
 @IsString() @MaxLength(600) summary!:string;
 @IsString() @Length(1,20000) body!:string;
 @IsOptional() @IsISO8601({strict:true}) eventStartAt?:string;
 @IsOptional() @IsISO8601({strict:true}) eventEndAt?:string;
 @IsOptional() @IsString() @Length(1,80) eventTimezone?:string;
 @IsOptional() @IsString() @Length(1,250) eventVenue?:string;
 @IsOptional() @IsUrl({protocols:['https'],require_protocol:true}) @MaxLength(2048) eventOnlineUrl?:string;
 @IsOptional() @IsUrl({protocols:['https'],require_protocol:true}) @MaxLength(2048) eventRegistrationUrl?:string;
 @IsOptional() @IsEnum(EventLifecycle) eventLifecycle?:EventLifecycle;
}
export class CreateContentDto extends ContentRevisionDto{
 @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(150) slug!:string;
 @IsEnum(CmsKind) kind!:CmsKind;
}
export class RejectRevisionDto{
 @IsString() @Length(8,1000) reason!:string;
}
