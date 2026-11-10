import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerGuard,ThrottlerModule} from '@nestjs/throttler';
import {PrismaService} from './database/prisma.service';
import {HealthController} from './health/health.controller';
import {EnquiryController} from './enquiries/enquiry.controller';
import {EnquiryService} from './enquiries/enquiry.service';
import {StaffController} from './staff/staff.controller';
import {StaffBatchValidationController} from './staff/staff-batch.controller';
import {MatrixPreviewController} from './staff/matrix-preview.controller';
import {SandboxPolicyService} from './staff/sandbox-policy.service';
import {StaffGuard} from './staff/staff.guard';
import {StaffService} from './staff/staff.service';
import {CmsService} from './cms/cms.service';
import {CmsController,PublicContentController} from './cms/cms.controller';
import {EnquiryCaseController} from './enquiries/case.controller';
import {EnquiryCaseService} from './enquiries/case.service';
import {MediaService} from './media/media.service';
import {MediaAdminController,MediaPublicController} from './media/media.controller';
import {MemberService} from './members/member.service';
import {UatSignupService} from './members/uat-signup.service';
import {RegistrationPinService} from './members/registration-pin.service';
import {GenealogyService} from './members/genealogy.service';
import {MatrixPlacementService} from './members/matrix-placement.service';
import {MemberCompensationService} from './members/member-compensation.service';
import {MemberWalletService} from './members/member-wallet.service';
import {UatScenarioService} from './staff/uat-scenario.service';
import {UatScenarioAdminController} from './staff/uat-scenario.controller';
import {MemberGuard} from './members/member.guard';
import {MemberController,MembershipReviewController} from './members/member.controller';
import {MemberRecoveryController,MemberRecoveryAdminController} from './members/recovery.controller';
import {MemberRecoveryService} from './members/recovery.service';
import {DonationController} from './finance/donation.controller';
import {DonationService} from './finance/donation.service';
import {DonationRefundService} from './finance/donation-refund.service';
@Module({
 imports:[ThrottlerModule.forRoot([{ttl:60_000,limit:5}])],
 controllers:[HealthController,EnquiryController,StaffController,StaffBatchValidationController,MatrixPreviewController,CmsController,PublicContentController,EnquiryCaseController,MediaAdminController,MediaPublicController,MemberController,MembershipReviewController,UatScenarioAdminController,MemberRecoveryController,MemberRecoveryAdminController,DonationController],
 providers:[PrismaService,SandboxPolicyService,EnquiryService,StaffService,StaffGuard,CmsService,EnquiryCaseService,MediaService,MemberService,MemberGuard,MemberRecoveryService,UatSignupService,RegistrationPinService,GenealogyService,MatrixPlacementService,MemberCompensationService,MemberWalletService,UatScenarioService,DonationService,DonationRefundService,{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}
