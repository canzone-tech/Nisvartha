import {BadRequestException,ConflictException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {EnquiryCategory} from '@prisma/client';
import {PrismaService} from '../database/prisma.service';
import {EnquiryDto} from './enquiry.dto';
import {isDisposableUatDatabase} from '../security/disposable-uat';
@Injectable()
export class EnquiryService {
 constructor(private readonly db:PrismaService){}
 async submit(category:EnquiryCategory,dto:EnquiryDto){
  const version=process.env.PRIVACY_NOTICE_VERSION?.trim();
  if(process.env.FORM_SUBMISSIONS_ENABLED!=='true'||process.env.PRIVACY_NOTICE_APPROVED!=='true'||!version||version.length>30)
   throw new ServiceUnavailableException('Enquiry service is not enabled');
  if(version.startsWith('synthetic-uat-')){
   if(!isDisposableUatDatabase())
    throw new ServiceUnavailableException('Synthetic privacy policy cannot collect real enquiries');
   if(!dto.email.toLowerCase().endsWith('@example.invalid'))
    throw new BadRequestException('Synthetic UAT requires example.invalid email');
  }
  if(dto.website?.trim())throw new BadRequestException('Invalid submission');
  if(category===EnquiryCategory.VOLUNTEER && (!dto.interests?.trim() || !dto.availability?.trim()))
   throw new BadRequestException('Interests and availability are required for volunteer enquiries');
  const record={id:dto.submissionId,reference:'NF-'+dto.submissionId,category,name:dto.name,email:dto.email.toLowerCase(),phone:dto.phone?.trim()||null,subject:dto.subject,message:dto.message,interests:dto.interests||null,availability:dto.availability||null,consentAt:new Date(),privacyVersion:version};
  try {const created=await this.db.enquiry.create({data:record});return {reference:created.reference};}
  catch(error){
   if((error as {code?:string}).code!=='P2002')throw error;
   const existing=await this.db.enquiry.findUnique({where:{id:dto.submissionId}});
   if(!existing)throw new ConflictException('Submission reference collision');
   if(existing.category!==category||existing.name!==record.name||existing.email!==record.email||existing.phone!==record.phone||existing.subject!==record.subject||existing.message!==record.message||existing.interests!==record.interests||existing.availability!==record.availability)
    throw new ConflictException('Submission ID reused with different content');
   return {reference:existing.reference};
  }
 }
}
