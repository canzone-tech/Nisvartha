import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import encoded from './client-bundle.json';
import manifest from '../vendor/client-bundle-v1.1.manifest.json';

const sha256=(input:Buffer)=>createHash('sha256').update(input).digest('hex');
type SourceFiles=Record<string,string>;
let cached:SourceFiles|undefined;
function sources():SourceFiles{
 if(cached)return cached;
 const compressed=Buffer.from(encoded.archiveBase64,'base64');
 const original=brotliDecompressSync(compressed);
 if(sha256(original)!==manifest.sha256_json)throw Error('Client v1.1 source checksum mismatch');
 const raw:unknown=JSON.parse(original.toString('utf8'));
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  throw Error('Invalid approved client source');
 const records=raw as SourceFiles;
 for(const [name,hash] of Object.entries(manifest.files)){
  if(typeof records[name]!=='string'||sha256(Buffer.from(records[name],'utf8'))!==hash)
   throw Error('Approved client source file mismatch: '+name);
 }
 cached=records;
 return records;
}

const clientPages=new Set([
 'index','about','activities','go-green','projects','volunteer',
 'donate','membership','auto-pool-plan','gallery','news-events',
 'contact','faq','how-it-works','login','register','privacy-policy','terms'
]);
const clientLinks=[
 ['https://auto.nisvarthafoundation.com/login','/member/login'],
 ['https://auto.nisvarthafoundation.com/Register','/member/register']
] as const;

export function clientPageContent(slug:string):string|null{
 if(!clientPages.has(slug))return null;
 const page=sources()[slug+'.html'];
 if(!page)return null;
 const found=/<main id="main">([\s\S]*?)<\/main>/.exec(page);
 if(!found||/<script\b/i.test(found[1]))
  throw Error('Invalid main content in client source: '+slug);
 let html=found[1];
 for(const [external,internal] of clientLinks){
  html=html.replaceAll('href="'+external+'" target="_blank" rel="noopener"',
   'href="'+internal+'"');
 }
 return html;
}

export function clientPageTitle(slug:string):string|null{
 if(!clientPages.has(slug))return null;
 const source=sources()[slug+'.html'];
 return /<title>([^<]+)<\/title>/.exec(source)?.[1]??null;
}

export function clientStyles():string{return sources()['assets/styles.css'];}
