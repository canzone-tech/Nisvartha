import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {ValidationPipe} from '@nestjs/common';
import {AppModule} from './app.module';
async function bootstrap(){
 const app=await NestFactory.create(AppModule);
 app.setGlobalPrefix('api/v1');
 app.enableCors({origin:process.env.PUBLIC_WEB_ORIGIN||'http://127.0.0.1:3102',methods:['GET','POST'],allowedHeaders:['Content-Type']});
 app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true,forbidUnknownValues:true}));
 app.enableShutdownHooks();
 await app.listen(Number(process.env.PORT||3100),process.env.HOST||'127.0.0.1');
}
void bootstrap();
