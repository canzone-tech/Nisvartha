import {Transform} from 'class-transformer';
import {IsBoolean,IsOptional,IsString,Length,Matches} from 'class-validator';
const strictBool=({value}:{value:unknown})=>value==='true'?true:value==='false'?false:value;
export class MediaUploadDto {
 @IsString() @Length(3,160) title!:string;
 @IsString() @Length(4,300) altText!:string;
 @IsOptional() @IsString() @Length(1,500) caption?:string;
 // Opaque IDs in the Foundation's private evidence register. Never upload consent documents here.
 @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/) rightsEvidenceRef!:string;
 @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/) consentEvidenceRef!:string;
 @Transform(strictBool) @IsBoolean() rightsConfirmed!:boolean;
 @Transform(strictBool) @IsBoolean() consentConfirmed!:boolean;
}
export class MediaRejectDto {
 @IsString() @Length(8,1000) reason!:string;
}
