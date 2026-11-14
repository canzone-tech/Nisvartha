import {IsEmail,IsIn,IsString,MaxLength,MinLength} from 'class-validator';
import {StaffRole,StaffStatus} from '@prisma/client';
export class StaffLoginDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @MinLength(1) password!:string;
}
export class StaffPasswordChangeDto{
 @IsString() @MinLength(1) currentPassword!:string;
 @IsString() @MinLength(14) @MaxLength(128) newPassword!:string;
}
export class StaffUpdateDto{
 @IsIn(['DISABLED']) status!:StaffStatus;
}
export type StaffPrincipal={id:string;role:StaffRole;email:string;mustChangePassword?:boolean};
