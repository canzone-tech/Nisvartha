import {IsIn,IsString,IsUUID,Length} from 'class-validator';
import {MatrixPreviewDto} from './matrix-preview.dto';
export class SaveScenarioDto extends MatrixPreviewDto{
 @IsUUID('4') requestKey!:string;
}
export class ReviewScenarioDto{
 @IsIn(['REVIEWED','REJECTED']) decision!:'REVIEWED'|'REJECTED';
 @IsString() @Length(8,300) reason!:string;
}
