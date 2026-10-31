import {Transform} from 'class-transformer';
import {IsBoolean,IsOptional,IsString,Length} from 'class-validator';
const strictBool=({value}:{value:unknown})=>value==='true'?true:value==='false'?false:value;
export class MediaUploadDto {
 @IsString() @Length(3,160) title!:string;
 @IsString() @Length(4,300) altText!:string;
 @IsOptional() @IsString() @Length(1,500) caption?:string;
 @Transform(strictBool) @IsBoolean() rightsConfirmed!:boolean;
 @Transform(strictBool) @IsBoolean() consentConfirmed!:boolean;
}
export class MediaRejectDto {
 @IsString() @Length(8,1000) reason!:string;
}
