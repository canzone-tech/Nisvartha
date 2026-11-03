import {IsIn,IsInt,IsString,Max,MaxLength,Min,ValidateIf} from 'class-validator';
import type {EpinKind} from '../security/epin-batch';

/** Registration-only, non-issuing ADMIN/SUPER_ADMIN policy preview. */
export class StaffBatchValidationDto{
 @IsInt() @Min(1) @Max(500) quantity!:number;
 @ValidateIf((_,value:unknown)=>value!==undefined)
 @IsIn(['ACTIVATION']) pinType?:EpinKind;
 @IsString() @MaxLength(40) expiresAt!:string;
}
