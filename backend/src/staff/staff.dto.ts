import {IsEmail,IsEnum,IsString,Length,MaxLength,MinLength} from 'class-validator';
import {StaffRole,StaffStatus} from '@prisma/client';
export class StaffLoginDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @MinLength(1) password!:string;
}
export class StaffCreateDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @Length(2,120) displayName!:string;
 @IsString() @Length(14,128) password!:string;
}
export class StaffUpdateDto{
 @IsEnum(StaffStatus) status!:StaffStatus;
}
export type StaffPrincipal={id:string;role:StaffRole;email:string};
