import {IsBoolean,IsInt,Max,Min} from 'class-validator';
export class MatrixPreviewDto{
 @IsInt() @Min(0) @Max(363) entrants!:number;
 @IsInt() @Min(0) @Max(16) rebirthAtLevel4!:number;
 @IsInt() @Min(0) @Max(16) rebirthAtLevel5!:number;
 @IsInt() @Min(0) @Max(16) rebirthLimit!:number;
 @IsBoolean() rebirthEnabled!:boolean;
}
