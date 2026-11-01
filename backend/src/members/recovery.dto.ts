import {IsBoolean,IsString,Length,Matches} from 'class-validator';
export class IssueMemberRecoveryDto {
 @IsBoolean() identityVerified!:boolean;
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/)
 identityEvidenceRef!:string;
}
export class RedeemMemberRecoveryDto {
 @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/)
 code!:string;
 @IsString() @Length(14,128)
 newPassword!:string;
}
