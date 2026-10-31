import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerGuard,ThrottlerModule} from '@nestjs/throttler';
import {PrismaService} from './database/prisma.service';
import {HealthController} from './health/health.controller';
import {EnquiryController} from './enquiries/enquiry.controller';
import {EnquiryService} from './enquiries/enquiry.service';
@Module({
 imports:[ThrottlerModule.forRoot([{ttl:60_000,limit:5}])],
 controllers:[HealthController,EnquiryController],
 providers:[PrismaService,EnquiryService,{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}
