import {Controller,Get,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service';
@Controller('health')
export class HealthController{
 constructor(private readonly db:PrismaService){}
 @Get('live') live(){return {status:'ok'}}
 @Get('ready') async ready(){try{await this.db.$queryRaw`SELECT 1`;return {status:'ok'}}catch{throw new ServiceUnavailableException('Not ready')}}
}
