import {EnquiryStatus} from '@prisma/client';
import {IsBoolean,IsEnum,IsString,IsUUID,Length} from 'class-validator';
export class AssignCaseDto{@IsUUID() staffId!:string;}
export class CaseStatusDto{@IsEnum(EnquiryStatus) status!:EnquiryStatus;}
export class CaseNoteDto{@IsString() @Length(2,2000) note!:string;}
export class LegalHoldDto{@IsBoolean() enabled!:boolean;@IsString() @Length(8,300) reason!:string;}
