import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerGuard,ThrottlerModule} from '@nestjs/throttler';
import {PrismaService} from './database/prisma.service';
import {HealthController} from './health/health.controller';
import {EnquiryController} from './enquiries/enquiry.controller';
import {EnquiryService} from './enquiries/enquiry.service';
import {StaffController} from './staff/staff.controller';
import {StaffGuard} from './staff/staff.guard';
import {StaffService} from './staff/staff.service';
import {CmsService} from './cms/cms.service';
import {CmsController,PublicContentController} from './cms/cms.controller';
import {EnquiryCaseController} from './enquiries/case.controller';
import {EnquiryCaseService} from './enquiries/case.service';
@Module({
 imports:[ThrottlerModule.forRoot([{ttl:60_000,limit:5}])],
 controllers:[HealthController,EnquiryController,StaffController,CmsController,PublicContentController,EnquiryCaseController],
 providers:[PrismaService,EnquiryService,StaffService,StaffGuard,CmsService,EnquiryCaseService,{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}
