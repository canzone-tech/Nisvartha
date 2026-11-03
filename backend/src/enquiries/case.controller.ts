import {Body,Controller,Get,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {StaffRole} from '@prisma/client';
import {Throttle} from '@nestjs/throttler';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {AssignCaseDto,CaseNoteDto,CaseStatusDto,LegalHoldDto} from './case.dto';
import {EnquiryCaseService} from './case.service';
@Controller('cms/enquiries')
@Throttle({default:{limit:90,ttl:60_000}})
@UseGuards(StaffGuard)
export class EnquiryCaseController{
 constructor(private readonly cases:EnquiryCaseService){}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER) @Get()
 list(){return this.cases.list()}
 @StaffRoles(StaffRole.ADMIN) @Get('export')
 export(@Req() req:StaffRequest){return this.cases.exportPage(req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER) @Get(':id')
 detail(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.cases.detail(id,req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER) @Post(':id/assign')
 assign(@Param('id',ParseUUIDPipe) id:string,@Body() dto:AssignCaseDto,@Req() req:StaffRequest){return this.cases.assign(id,dto.staffId,req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER) @Post(':id/status')
 status(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CaseStatusDto,@Req() req:StaffRequest){return this.cases.status(id,dto.status,req.staff!)}
 @StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER) @Post(':id/notes')
 note(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CaseNoteDto,@Req() req:StaffRequest){return this.cases.note(id,dto.note,req.staff!)}
 @StaffRoles(StaffRole.ADMIN) @Post(':id/legal-hold')
 legalHold(@Param('id',ParseUUIDPipe) id:string,@Body() dto:LegalHoldDto,@Req() req:StaffRequest){return this.cases.legalHold(id,dto.enabled,dto.reason,req.staff!)}
 @StaffRoles(StaffRole.ADMIN) @Post('retention/run')
 retention(@Req() req:StaffRequest){return this.cases.applyRetention(req.staff!)}
}
