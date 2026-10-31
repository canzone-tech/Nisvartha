import {BadRequestException,Body,Controller,Get,Header,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {CmsKind,StaffRole} from '@prisma/client';
import {Throttle} from '@nestjs/throttler';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {CmsService} from './cms.service';
import {ContentRevisionDto,CreateContentDto,RejectRevisionDto} from './cms.dto';
@Controller('cms')
@Throttle({default:{limit:120,ttl:60_000}})
@UseGuards(StaffGuard)
export class CmsController{
 constructor(private readonly cms:CmsService){}
 @StaffRoles(StaffRole.EDITOR,StaffRole.ADMIN) @Post('contents')
 create(@Body() dto:CreateContentDto,@Req() req:StaffRequest){return this.cms.create(dto,req.staff!)}
 @StaffRoles(StaffRole.EDITOR,StaffRole.ADMIN) @Post('contents/:id/revisions')
 draft(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ContentRevisionDto,@Req() req:StaffRequest){return this.cms.draft(id,dto,req.staff!)}
 @StaffRoles(StaffRole.EDITOR,StaffRole.ADMIN) @Post('revisions/:id/submit')
 submit(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.cms.submit(id,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post('revisions/:id/approve')
 approve(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.cms.approve(id,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post('revisions/:id/reject')
 reject(@Param('id',ParseUUIDPipe) id:string,@Body() dto:RejectRevisionDto,@Req() req:StaffRequest){return this.cms.reject(id,dto.reason,req.staff!)}
 @StaffRoles(StaffRole.APPROVER,StaffRole.ADMIN) @Post('contents/:id/archive')
 archive(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.cms.archive(id,req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR) @Get('contents')
 list(){return this.cms.list()}
 @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR)
 @Get('revisions/:id/preview')
 @Header('Cache-Control','private, no-store')
 preview(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.cms.previewRevision(id,req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR) @Get('contents/:id')
 detail(@Param('id',ParseUUIDPipe) id:string){return this.cms.detail(id)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.AUDITOR) @Get('audit')
 audit(){return this.cms.audit()}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER,StaffRole.EDITOR,StaffRole.AUDITOR) @Get('dashboard')
 dashboard(){return this.cms.dashboard()}
}
@Controller('public/content')
@Throttle({default:{limit:120,ttl:60_000}})
export class PublicContentController{
 constructor(private readonly cms:CmsService){}
 @Get() list(@Query('kind') raw?:string){
  if(raw&& !Object.values(CmsKind).includes(raw as CmsKind))throw new BadRequestException('Invalid content kind');
  return this.cms.publishedList(raw as CmsKind|undefined);
 }
 @Get(':slug') published(@Param('slug') slug:string){return this.cms.published(slug)}
}
