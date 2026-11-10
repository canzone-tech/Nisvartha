import {IsIn,IsInt,IsString,IsUUID,Matches,Max,Min} from 'class-validator';
export class CreateDonationRefundDto {
 @IsUUID('4') requestKey!:string;
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/) bankReference!:string;
 @IsInt() @Min(1) @Max(2147483647) amountPaise!:number;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) evidenceRef!:string;
}
export class ReconcileDonationRefundDto {
 @IsUUID('4') requestKey!:string;
 @IsIn(['CONFIRMED','REJECTED']) status!:'CONFIRMED'|'REJECTED';
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) evidenceRef!:string;
}
