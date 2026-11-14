import {Body,Controller,Get,Headers,HttpCode,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {StaffRole} from '@prisma/client';
import {Throttle} from '@nestjs/throttler';
import {StaffLoginDto,StaffPasswordChangeDto,StaffUpdateDto} from './staff.dto';
import {AllowStaffPasswordRotation,StaffGuard,StaffRequest,StaffRoles} from './staff.guard';
import {StaffService} from './staff.service';
@Controller('staff')
@Throttle({default:{limit:60,ttl:60_000}})
export class StaffController{
 constructor(private readonly service:StaffService){}
 @Post('login') @Throttle({default:{limit:5,ttl:60_000}}) @HttpCode(200) login(@Body() dto:StaffLoginDto){return this.service.login(dto)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Get('me') me(@Req() req:StaffRequest){return req.staff}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @AllowStaffPasswordRotation() @Post('logout') @HttpCode(200) logout(@Headers('authorization') authorization:string,@Req() req:StaffRequest){return this.service.logout(authorization,req.staff!)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN) @AllowStaffPasswordRotation()
 @Post('password')
 @HttpCode(200) @Throttle({default:{limit:5,ttl:60_000}})
 changePassword(@Body() dto:StaffPasswordChangeDto,@Req() req:StaffRequest){return this.service.changePassword(dto,req.staff!)}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Get('overview') overview(){return this.service.overview()}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Get('accounts') accounts(){return this.service.listStaff()}
 @UseGuards(StaffGuard) @StaffRoles(StaffRole.ADMIN)
 @Patch('accounts/:id') update(@Param('id') id:string,@Body() dto:StaffUpdateDto,@Req() req:StaffRequest){return this.service.updateStaff(id,dto,req.staff!)}
}
