import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerGuard,ThrottlerModule} from '@nestjs/throttler';
import {PrismaService} from './database/prisma.service';
import {HealthController} from './health/health.controller';
import {EnquiryController} from './enquiries/enquiry.controller';
import {EnquiryService} from './enquiries/enquiry.service';
import {StaffController} from './staff/staff.controller';
import {StaffBatchValidationController} from './staff/staff-batch.controller';
import {StaffGuard} from './staff/staff.guard';
import {StaffService} from './staff/staff.service';
import {CmsService} from './cms/cms.service';
import {CmsController,PublicContentController} from './cms/cms.controller';
import {EnquiryCaseController} from './enquiries/case.controller';
import {EnquiryCaseService} from './enquiries/case.service';
import {MediaService} from './media/media.service';
import {MediaAdminController,MediaPublicController} from './media/media.controller';
import {MemberService} from './members/member.service';
import {MemberGuard} from './members/member.guard';
import {MemberController,MembershipReviewController} from './members/member.controller';
import {MemberRecoveryController,MemberRecoveryAdminController} from './members/recovery.controller';
import {MemberRecoveryService} from './members/recovery.service';
@Module({
 imports:[ThrottlerModule.forRoot([{ttl:60_000,limit:5}])],
 controllers:[HealthController,EnquiryController,StaffController,StaffBatchValidationController,CmsController,PublicContentController,EnquiryCaseController,MediaAdminController,MediaPublicController,MemberController,MembershipReviewController,MemberRecoveryController,MemberRecoveryAdminController],
 providers:[PrismaService,EnquiryService,StaffService,StaffGuard,CmsService,EnquiryCaseService,MediaService,MemberService,MemberGuard,MemberRecoveryService,{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}
