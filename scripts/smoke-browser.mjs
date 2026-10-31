import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const chrome=process.env.CHROME_BIN||['chromium','google-chrome','google-chrome-stable'].find(name=>spawnSync('which',[name],{stdio:'ignore'}).status===0);
assert.ok(chrome,'Chrome or Chromium required for UAT');
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(new Error('Port unavailable'));s.close(()=>resolve(a.port));});});
const origin='http://127.0.0.1:'+port;
const dir=mkdtempSync(join(tmpdir(),'nisvartha-browser-'));
const app=spawn('npm',['--prefix','frontend','run','start','--','-p',String(port)],{stdio:'ignore',detached:true});
let browser,ws;
try{
 let ready=false;
 for(let i=0;i<80;i++){if(app.exitCode!==null)throw new Error('Frontend startup failed');try{if((await fetch(origin+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'Compiled frontend not ready');
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore',detached:true});
 let debugPort;
 for(let i=0;i<100;i++){const p=join(dir,'DevToolsActivePort');if(browser.exitCode!==null)throw new Error('Chromium exited');if(existsSync(p)){debugPort=Number(readFileSync(p,'utf8').split('\n')[0]);break;}await new Promise(r=>setTimeout(r,150));}
 assert.ok(debugPort,'Browser debugging port unavailable');
 const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
 const target=targets.find(t=>t.type==='page');
 assert.ok(target?.webSocketDebuggerUrl);
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let nextId=0;const calls=new Map();
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data);const cb=calls.get(r.id);if(!cb)return;calls.delete(r.id);r.error?cb.reject(Error(JSON.stringify(r.error))):cb.resolve(r.result);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evalJS=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error('Browser evaluation failed');return r.result.value;};
 await call('Page.enable');await call('Runtime.enable');
 async function inspect(path,width){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  await call('Page.navigate',{url:origin+path});
  let info={};
  for(let i=0;i<80;i++){
   info=await evalJS("({path:location.pathname,ready:document.readyState,h1:document.querySelector('main h1')?.textContent||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})");
   if(info.path===path&&info.ready==='complete'&&info.h1)break;
   await new Promise(r=>setTimeout(r,120));
  }
  assert.equal(info.path,path);
  assert.ok(info.h1,'Missing H1: '+path);
  assert.ok(info.overflow<=2,'Horizontal overflow '+width+'px on '+path+': '+info.overflow);
  return info;
 }
 const routes=['/','/about','/activities','/projects','/go-green','/volunteer','/donate','/membership','/news-events','/contact','/gallery','/privacy-policy','/terms','/accessibility'];
 for(const path of routes){await inspect(path,1440);await inspect(path,390);}
 const blocked=await inspect('/auto-pool-plan',390);
 assert.match(blocked.h1,/not found|not available/i,'Proposed financial plan must not publish');
 await inspect('/',390);
 assert.equal(await evalJS("document.querySelector('.menu-button').getAttribute('aria-expanded')"),'false');
 await evalJS("document.querySelector('.menu-button').click()");
 const menu=await evalJS("({open:document.querySelector('.menu-button').getAttribute('aria-expanded'),display:getComputedStyle(document.querySelector('#main-nav')).display})");
 assert.equal(menu.open,'true');assert.notEqual(menu.display,'none');
 console.log('Nisvartha Chromium mobile/desktop navigation and overflow UAT: PASS');
}finally{
 ws?.close();
 const stop=async child=>{
  if(!child?.pid || child.exitCode!==null)return;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);
  if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
 };
 await stop(browser);
 await stop(app);
 rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
