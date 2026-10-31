import {Body,Controller,Get,Headers,HttpCode,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {StaffRole} from '@prisma/client';
import {StaffCreateDto,StaffLoginDto,StaffUpdateDto} from './staff.dto';
import {StaffGuard,StaffRequest,StaffRoles} from './staff.guard';
import {StaffService} from './staff.service';
@Controller('staff')
export class StaffController{
 constructor(private readonly service:StaffService){}
 @Post('login') @HttpCode(200) login(@Body() dto:StaffLoginDto){return this.service.login(dto)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR)
 @Get('me') me(@Req() req:StaffRequest){return req.staff}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN,StaffRole.EDITOR,StaffRole.APPROVER,StaffRole.AUDITOR)
 @Post('logout') @HttpCode(200) logout(@Headers('authorization') authorization:string,@Req() req:StaffRequest){return this.service.logout(authorization,req.staff!)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Get('accounts') accounts(){return this.service.listStaff()}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Post('accounts') create(@Body() dto:StaffCreateDto,@Req() req:StaffRequest){return this.service.createStaff(dto,req.staff!)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Patch('accounts/:id') update(@Param('id') id:string,@Body() dto:StaffUpdateDto,@Req() req:StaffRequest){return this.service.updateStaff(id,dto,req.staff!)}
}
