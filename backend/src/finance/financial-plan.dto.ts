import {IsInt,IsString,IsUUID,Length,Max,Min} from 'class-validator';

/** A publish creates an immutable new version; never edits prior money. */
export class PublishFinancialPlanDto {
 @IsUUID('4') requestKey!:string;
 @IsInt() @Min(1) expectedVersionId!:number;
 @IsString() @Length(8,500) reason!:string;
 @IsInt() @Min(10000) @Max(40_000_000) joiningAmountPaise!:number;
 @IsInt() @Min(0) @Max(0) directReferralPaise!:number;
 @IsInt() @Min(0) @Max(200_000_000) level1Paise!:number;
 @IsInt() @Min(0) @Max(200_000_000) level2Paise!:number;
 @IsInt() @Min(0) @Max(200_000_000) level3Paise!:number;
 @IsInt() @Min(0) @Max(200_000_000) level4Paise!:number;
 @IsInt() @Min(0) @Max(200_000_000) level5Paise!:number;
 @IsInt() @Min(0) @Max(8) rebirthAtLevel4!:number;
 @IsInt() @Min(0) @Max(8) rebirthAtLevel5!:number;
}
