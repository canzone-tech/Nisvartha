import {IsIn,IsInt,IsISO8601,IsOptional,IsString,IsUUID,Matches,Max,Min} from 'class-validator';
import {DonationStatus} from '@prisma/client';
export class RecordDonationDto {
 @IsUUID('4') requestKey!:string;
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/) bankReference!:string;
 @IsInt() @Min(1) @Max(2147483647) amountPaise!:number;
 @IsISO8601({strict:true}) receivedAt!:string;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) evidenceRef!:string;
}
export class ReconcileDonationDto {
 @IsUUID('4') requestKey!:string;
 @IsIn(['RECONCILED','REJECTED']) status!:DonationStatus;
 @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{5,119}$/) evidenceRef!:string;
}
export class ListDonationDto {
 @IsOptional() @IsIn(['ALL','PENDING','RECONCILED','REJECTED']) status?:'ALL'|DonationStatus;
 @IsOptional() @IsUUID('4') cursor?:string;
}
