import {Transform} from 'class-transformer';
import {Equals,IsEmail,IsOptional,IsString,IsUUID,Length,MaxLength} from 'class-validator';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class EnquiryDto{
 @IsUUID() submissionId!:string;
 @Transform(trim) @IsString() @Length(2,120) name!:string;
 @Transform(trim) @IsEmail() @MaxLength(254) email!:string;
 @Transform(trim) @IsString() @Length(2,160) subject!:string;
 @Transform(trim) @IsString() @Length(10,3000) message!:string;
 @IsOptional() @Transform(trim) @IsString() @MaxLength(300) interests?:string;
 @IsOptional() @Transform(trim) @IsString() @MaxLength(300) availability?:string;
 @Equals(true) consent!:boolean;
 @IsOptional() @IsString() @MaxLength(100) website?:string;
}
