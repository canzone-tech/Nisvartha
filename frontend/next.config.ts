import type {NextConfig} from 'next';

// Local-only byte-for-byte preview of client-supplied HTML. Real Next/CMS
// routes remain authoritative in the default and production builds.
const preview=process.env.NISVARTHA_CLIENT_TEMPLATE_PREVIEW==='true';
const site=new URL(process.env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3102');
if(preview&&(site.protocol!=='http:'||
 !['127.0.0.1','localhost'].includes(site.hostname)||
 process.env.PUBLIC_CONTENT_APPROVED==='true')){
 throw Error('Client HTML prototype requires localhost HTTP and unapproved public content');
}
const clientPages=[
 'index','about','activities','go-green','projects','volunteer','donate',
 'membership','auto-pool-plan','gallery','news-events','contact','faq',
 'how-it-works','login','register','privacy-policy','terms'
] as const;
const config:NextConfig={
 poweredByHeader:false,reactStrictMode:true,
 async headers(){
  return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
   ...(preview?[{key:'X-Robots-Tag',value:'noindex, nofollow'}]:[])
  ]}];
 },
 async rewrites(){
  if(!preview)return {beforeFiles:[],afterFiles:[
   ...clientPages.filter(page=>page!=='index'&&page!=='auto-pool-plan').map(page=>
    ({source:'/'+page+'.html',destination:'/'+page})),
   {source:'/index.html',destination:'/'}
  ],fallback:[]};
  return {beforeFiles:[
   {source:'/',destination:'/client-template/index.html'},
   ...clientPages.flatMap(page=>[
    {source:'/'+page+'.html',destination:'/client-template/'+page+'.html'},
    ...(page==='index'?[]:[{source:'/'+page,destination:'/client-template/'+page+'.html'}])
   ]),
   {source:'/assets/styles.css',destination:'/client-template/assets/styles.css'},
   {source:'/assets/site.js',destination:'/client-template/assets/site.js'}
  ],afterFiles:[],fallback:[]};
 }
};
export default config;
