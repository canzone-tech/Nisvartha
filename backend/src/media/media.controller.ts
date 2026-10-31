import {Body,Controller,Get,Header,Param,ParseUUIDPipe,Post,Req,StreamableFile,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {MediaService} from './media.service';
import {MediaRejectDto,MediaUploadDto} from './media.dto';
type ImageUpload={buffer:Buffer;size:number;originalname:string;mimetype:string};
@Controller('cms/media')
@UseGuards(StaffGuard)
@Throttle({default:{limit:45,ttl:60_000}})
export class MediaAdminController {
 constructor(private readonly media:MediaService){}
 @StaffRoles(StaffRole.EDITOR,StaffRole.ADMIN)
 @Post('upload')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024,files:1,fields:7,parts:9}}))
 upload(@UploadedFile() file:ImageUpload,@Body() dto:MediaUploadDto,@Req() req:StaffRequest){
  return this.media.upload(file,dto,req.staff!);
 }
 @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR) @Get()
 list(){return this.media.listStaff()}
 @StaffRoles(StaffRole.EDITOR,StaffRole.ADMIN) @Post(':id/submit')
 submit(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.media.submit(id,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post(':id/approve')
 approve(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.media.approve(id,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post(':id/reject')
 reject(@Param('id',ParseUUIDPipe) id:string,@Body() dto:MediaRejectDto,@Req() req:StaffRequest){return this.media.reject(id,dto,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post(':id/archive')
 archive(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.media.archive(id,req.staff!)}
}
@Controller('public')
@Throttle({default:{limit:120,ttl:60_000}})
export class MediaPublicController {
 constructor(private readonly media:MediaService){}
 @Get('gallery') gallery(){return this.media.gallery()}
 @Get('media/:id')
 @Header('Content-Type','image/webp')
 @Header('X-Content-Type-Options','nosniff')
 @Header('Cache-Control','no-store')
 async image(@Param('id',ParseUUIDPipe) id:string){
  return new StreamableFile(await this.media.approvedFile(id));
 }
}
