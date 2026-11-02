import {IsIn,IsInt,IsString,Max,MaxLength,Min,ValidateIf} from 'class-validator';
import type {EpinKind} from '../security/epin-batch';

/** Validates the no-issuance ADMIN/SUPER_ADMIN batch policy preview. */
export class StaffBatchValidationDto{
 @IsInt() @Min(1) @Max(500) quantity!:number;
 @ValidateIf((_,value:unknown)=>value!==undefined)
 @IsIn(['ACTIVATION','INSTALLMENT']) pinType?:EpinKind;
 @IsString() @MaxLength(40) expiresAt!:string;
}
