import {CmsKind} from '@prisma/client';
import {IsEnum,IsString,Length,Matches,MaxLength,MinLength} from 'class-validator';
export class CreateContentDto{
 @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(150) slug!:string;
 @IsEnum(CmsKind) kind!:CmsKind;
 @IsString() @Length(3,200) title!:string;
 @IsString() @MaxLength(600) summary!:string;
 @IsString() @Length(1,20000) body!:string;
}
export class ContentRevisionDto{
 @IsString() @Length(3,200) title!:string;
 @IsString() @MaxLength(600) summary!:string;
 @IsString() @Length(1,20000) body!:string;
}
export class RejectRevisionDto{
 @IsString() @Length(8,1000) reason!:string;
}
