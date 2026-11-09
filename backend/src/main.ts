import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {ValidationPipe} from '@nestjs/common';
import {AppModule} from './app.module';
import {randomUUID} from 'node:crypto';
async function bootstrap(){
 const app=await NestFactory.create(AppModule);
 app.use((req:{method:string;url:string},res:{statusCode:number;setHeader:(name:string,value:string)=>void;on:(event:string,cb:()=>void)=>void},next:()=>void)=>{
  const requestId=randomUUID();
  const started=Date.now();
  res.setHeader('X-Request-ID',requestId);
  res.on('finish',()=>{
   let path='/';
   try{path=new URL(req.url,'http://localhost').pathname}catch{}
   console.log(JSON.stringify({event:'http_request',requestId,method:req.method,path,status:res.statusCode,durationMs:Date.now()-started}));
  });
  next();
 });
 app.setGlobalPrefix('api/v1');
 // Public production traffic must arrive through the loopback TLS proxy.
 // Express trusts forwarding information ONLY from a local proxy. Nginx must
 // overwrite X-Forwarded-For with $remote_addr, not trust a client-supplied list,
 // so Nest throttling remains per real client rather than one global proxy IP.
 if(process.env.NODE_ENV==='production'){
  const bind=process.env.HOST||'127.0.0.1';
  if(bind!=='127.0.0.1'&&bind!=='::1')
   throw new Error('Production API must bind to loopback behind TLS reverse proxy');
  app.getHttpAdapter().getInstance().set('trust proxy','loopback');
 }

 app.enableCors({origin:process.env.PUBLIC_WEB_ORIGIN||'http://127.0.0.1:3102',methods:['GET','POST'],allowedHeaders:['Content-Type']});
 app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true,forbidUnknownValues:true}));
 app.enableShutdownHooks();
 await app.listen(Number(process.env.PORT||3100),process.env.HOST||'127.0.0.1');
}
void bootstrap();
