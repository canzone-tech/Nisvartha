import {Body,Controller,HttpCode,HttpStatus,Post} from '@nestjs/common';
import {EnquiryCategory} from '@prisma/client';
import {EnquiryDto} from './enquiry.dto';
import {EnquiryService} from './enquiry.service';
@Controller('enquiries')
export class EnquiryController{
 constructor(private readonly service:EnquiryService){}
 @Post('contact') @HttpCode(HttpStatus.CREATED)
 contact(@Body() dto:EnquiryDto){return this.service.submit(EnquiryCategory.CONTACT,dto)}
 @Post('volunteer') @HttpCode(HttpStatus.CREATED)
 volunteer(@Body() dto:EnquiryDto){return this.service.submit(EnquiryCategory.VOLUNTEER,dto)}
}
