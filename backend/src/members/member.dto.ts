import {IsBoolean,IsEmail,IsIn,IsOptional,IsString,IsUUID,Length,MaxLength,MinLength,Matches,Max,Min,IsInt} from 'class-validator';
import {MembershipApplicationStatus} from '@prisma/client';

export class MemberRegisterDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @Length(2,120) displayName!:string;
 @IsString() @Length(14,128) password!:string;
 @IsString() @Length(1,50) termsVersion!:string;
 @IsString() @Length(1,50) privacyVersion!:string;
 @IsBoolean() consent!:boolean;
 @IsBoolean() communicationOptIn!:boolean;
 @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) registrationPin?:string;
 @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{22}$/) inviteCode?:string;
}
/** Applicant is present, selects their own password and has a private
 * recorded consent reference. Staff must not impersonate member consent. */
export class StaffAssistedMemberRegisterDto extends MemberRegisterDto{
 @IsBoolean() applicantPresent!:boolean;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/)
 consentEvidenceRef!:string;
}
export class UatSignupPinBatchDto{
 @IsUUID('4') requestKey!:string;
 @IsInt() @Min(1) @Max(50) quantity!:number;
 @IsString() @MaxLength(40) expiresAt!:string;
}
export class MemberLoginDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @MinLength(1) password!:string;
}
export class MemberProfileDto{
 @IsString() @Length(2,120) displayName!:string;
 @IsBoolean() communicationOptIn!:boolean;
}
export class MemberPasswordDto{
 @IsString() @MinLength(1) currentPassword!:string;
 @IsString() @Length(14,128) newPassword!:string;
}
/** Bounded, deterministic review queue query; numeric limits are validated as strings. */
export class MembershipReviewPageDto{
 @IsOptional() @IsIn(['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','WITHDRAWN'])
 status?:MembershipApplicationStatus;
 @IsOptional() @IsUUID('4') cursor?:string;
 @IsOptional() @Matches(/^(?:[1-9]|[1-4][0-9]|50)$/) limit?:string;
}
export class ApplicationDecisionDto{
 @IsIn(['APPROVED','REJECTED','SUSPENDED']) status!:MembershipApplicationStatus;
 @IsString() @Length(8,1000) reason!:string;
}
export type MemberPrincipal={id:string;email:string;status:string};
