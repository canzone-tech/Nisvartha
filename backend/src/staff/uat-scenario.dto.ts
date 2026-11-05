import {IsUUID} from 'class-validator';
export class RecordUatScenarioDto{
 @IsUUID('4') requestKey!:string;
}
