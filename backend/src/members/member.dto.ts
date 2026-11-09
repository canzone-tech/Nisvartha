import {IsBoolean,IsEmail,IsIn,IsOptional,IsString,IsUUID,Length,MaxLength,MinLength,Matches,Max,Min,IsInt,IsISO8601} from 'class-validator';
import {MembershipApplicationStatus} from '@prisma/client';
import {Transform} from 'class-transformer';

export class MemberRegisterDto{
 @IsEmail() @MaxLength(191) email!:string;
 @IsString() @Length(2,120) displayName!:string;
 @IsString() @Length(14,128) password!:string;
 @IsString() @Length(1,50) termsVersion!:string;
 @IsString() @Length(1,50) privacyVersion!:string;
 @IsBoolean() consent!:boolean;
 @IsBoolean() communicationOptIn!:boolean;
 @IsOptional() @Transform(({value})=>typeof value==='string'?value.trim():value)
 @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) registrationPin?:string;
 @IsOptional() @Transform(({value})=>typeof value==='string'?value.trim():value)
 @IsString() @Matches(/^(?:[A-Za-z0-9]{8}|[A-Za-z0-9_-]{22})$/) inviteCode?:string;
}
/** Applicant is present and selects their own password.
 * Staff must not impersonate member consent. */
export class StaffAssistedMemberRegisterDto extends MemberRegisterDto{
 @IsBoolean() applicantPresent!:boolean;
}
/** No-fee Admin-only registration access codes; not paid E-PINs. */
export class RegistrationPinBatchDto{
 @IsUUID('4') requestKey!:string;
 @IsInt() @Min(1) @Max(50) quantity!:number;
 @IsString() @MaxLength(40) expiresAt!:string;
}
export class RegistrationPinListDto{
 @IsOptional() @IsIn(['ALL','AVAILABLE','USED','EXPIRED'])
 status?:'ALL'|'AVAILABLE'|'USED'|'EXPIRED';
 @IsOptional() @IsUUID('4') cursor?:string;
}
export class UatSignupPinBatchDto{
 @IsUUID('4') requestKey!:string;
 @IsInt() @Min(1) @Max(50) quantity!:number;
 @IsString() @MaxLength(40) expiresAt!:string;
}
export class UatSignupPinListDto{
 @IsOptional() @IsIn(['ALL','AVAILABLE','USED','EXPIRED'])
 status?:'ALL'|'AVAILABLE'|'USED'|'EXPIRED';
 @IsOptional() @IsUUID('4') cursor?:string;
}
export class MemberLoginDto{
 @IsOptional() @IsEmail() @MaxLength(191) email?:string;
 @IsOptional() @IsString() @MaxLength(191) identifier?:string;
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
 @IsOptional() @IsUUID('4') transactionRequestKey?:string;
 @IsOptional() @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/) transactionReference?:string;
 @IsOptional() @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) transactionEvidenceRef?:string;
 @IsOptional() @IsISO8601({strict:true}) transactionReceivedAt?:string;
}
/** Admin records real offline transaction evidence after PIN-based activation.
 * This operation does not approve membership or create another matrix position. */
export class VerifiedOfflineSaleDto{
 @IsUUID('4') transactionRequestKey!:string;
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/) transactionReference!:string;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) transactionEvidenceRef!:string;
 @IsISO8601({strict:true}) transactionReceivedAt!:string;
}
export class EarningSettlementDto{
 @IsUUID('4') requestKey!:string;
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/) settlementReference!:string;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) evidenceRef!:string;
 @IsISO8601({strict:true}) settledAt!:string;
}
export type MemberPrincipal={id:string;email:string;status:string};

/** Wallet amounts are always integer paise, never client-computed float balances. */
export class MemberPayoutRequestDto {
 @IsUUID('4') requestKey!:string;
 @IsInt() @Min(100) @Max(2_000_000_000) amountPaise!:number;
}
export class MemberPayoutDecisionDto {
 @IsUUID('4') decisionRequestKey!:string;
 @IsIn(['PAID','REJECTED']) status!:'PAID'|'REJECTED';
 @IsOptional() @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/)
 settlementReference?:string;
 @IsOptional() @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/)
 settlementEvidenceRef?:string;
 @IsOptional() @IsISO8601({strict:true}) paidAt?:string;
 @IsOptional() @IsString() @Length(8,500) rejectionReason?:string;
}
