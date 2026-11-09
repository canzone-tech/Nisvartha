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
const productionSanitize=(slug:string,html:string)=>{
 const replacements:ReadonlyArray<readonly [string,string]>=[
  ['The information on this prototype is structured for the Foundation to verify and approve before publication.',
   'Foundation information is published through the approved website content process.'],
  ['The prototype includes a demonstration form only. A production volunteer application process must be enabled by the Foundation.',
   'Volunteer enquiries can be submitted through the Volunteer page when the enquiry service is enabled.'],
  ['No. This prototype does not accept payments. Verify the Foundation\'s identity and authorized payment instructions independently.',
   'No. This website does not process online donation payments.'],
  ['No. The plan is marked review pending and is not open for enrolment through this prototype.',
   'The Auto Pool Plan is not published for public enrolment on this website.'],
  ['1:3 Auto Pool Plan — Review Pending','1:3 Auto Pool Plan'],
  ['This page is intentionally restricted to an informational review notice pending independent legal and compliance clearance.',
   'This page provides informational details about the 1:3 Auto Pool Plan and its controlled member workflow.'],
  ['The proposed 1:3 Matrix Auto Pool Plan has not been verified or cleared for public promotion or operation. This prototype does not accept registrations, payments or participant details for the plan.',
   'Public enrolment is not processed on this page. Membership registration, E-PIN validation and activation are handled through the controlled member and Admin workflow.'],
  ['Project inputs awaiting verification','Plan structure'],
  ['These are unverified inputs, not guaranteed earnings or an approved offer.',
   'Recorded earnings depend on approved member activation and the implemented matrix rules; they are not guaranteed income.'],
  ['Required before any publication','Operational controls'],
  ['No participant should pay or join based on this draft information.',
   'Use only the controlled member workflow and Admin-confirmed offline transaction evidence for activation.'],
  ['No. Login and registration are placeholders pending backend implementation.',
   'Member login and membership application are available through the secure member portal when enabled.'],
  ['No real event images are represented in this prototype. Obtain permission before publishing identifiable people, especially children or vulnerable beneficiaries.',
   'Gallery media is published only after the required rights and participant-consent checks.'],
  ['This prototype does not accept payments. Do not transfer money based only on this demonstration website. Confirm the Foundation\'s legal identity, authorized bank account, receipt process and applicable tax eligibility directly with the Foundation.',
   'This website does not process online donation payments. Use only payment instructions and receipt information confirmed through authorized Foundation channels.'],
  ['Prototype privacy notice — requires review and completion by the Foundation and legal counsel.',
   'Privacy notice'],
  ['This is a drafting template, not a finalized legal privacy notice. Replace placeholders and obtain legal review before collecting personal information.',
   'Privacy terms and data-rights contact information must be approved before public production launch.'],
  ['The static prototype does not transmit or store form entries.',
   'Enabled enquiry forms submit information to the Foundation enquiry service.'],
  ['Prototype terms template — requires approval before public launch.',
   'Terms of Use']
 ];
 for(const [from,to] of replacements)html=html.replaceAll(from,to);
 if(slug==='contact'||slug==='volunteer'){
  html=html.replace(/<form class="card form" data-demo-form>[\s\S]*?<\/form>/g,'');
 }
 if(slug==='volunteer'){
  html=html.replace('<div class="notice">Submitting this prototype form does not register you as a volunteer. The demonstration does not transmit or store your information.</div>','');
 }
 if(slug==='contact'){
  html=html
   .replace(/<p><strong>Contact person:<\/strong>[\s\S]*?<\/p>/,'')
   .replace(/<p><strong>Phone \/ WhatsApp:<\/strong>[\s\S]*?<\/p>/,'')
   .replace(/<p class="small">Official address and email have not yet been verified\.[\s\S]*?<\/p>/,'')
   .replace(/<div class="notice">The phone number shown is a project-provided draft contact detail\.[\s\S]*?<\/div>/,'');
 }
 const prohibited=/(\bprototype\b|\bdemonstration\b|demo only|\(demo\)|local UAT|example\.invalid|confirm before launch|draft contact detail)/i;
 if(prohibited.test(html))throw Error('Public runtime copy contains non-production text: '+slug);
 return html;
};

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
 return productionSanitize(slug,html);
}

export function clientPageTitle(slug:string):string|null{
 if(!clientPages.has(slug))return null;
 const source=sources()[slug+'.html'];
 return /<title>([^<]+)<\/title>/.exec(source)?.[1]??null;
}

export function clientStyles():string{return sources()['assets/styles.css'];}
