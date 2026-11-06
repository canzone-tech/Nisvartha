import {IsEmail,IsIn,IsString,MaxLength,MinLength} from 'class-validator';
import {StaffRole,StaffStatus} from '@prisma/client';
export class StaffLoginDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @MinLength(1) password!:string;
}
export class StaffUpdateDto{
 @IsIn(['DISABLED']) status!:StaffStatus;
}
export type StaffPrincipal={id:string;role:StaffRole;email:string};
