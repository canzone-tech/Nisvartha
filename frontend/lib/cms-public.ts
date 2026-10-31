export type PublishedCmsSummary={slug:string;kind:'PAGE'|'PROJECT'|'ACTIVITY'|'NEWS'|'EVENT'|'FAQ';title:string;summary:string;publishedAt:string|null};
export type PublishedCmsDetail=PublishedCmsSummary&{body:string};
const apiBase=()=>process.env.API_INTERNAL_URL||'http://127.0.0.1:3100';
export const cmsPublicEnabled=process.env.CMS_PUBLIC_CONTENT_ENABLED==='true';
export async function getPublishedCms(slug:string):Promise<PublishedCmsDetail|null>{
 if(!cmsPublicEnabled)return null;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;
 const response=await fetch(apiBase()+'/api/v1/public/content/'+encodeURIComponent(slug),{cache:'no-store'});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('Published content unavailable');
 return response.json() as Promise<PublishedCmsDetail>;
}
export async function listPublishedCms(kind:PublishedCmsSummary['kind']):Promise<PublishedCmsSummary[]>{
 if(!cmsPublicEnabled)return [];
 const response=await fetch(apiBase()+'/api/v1/public/content?kind='+encodeURIComponent(kind),{cache:'no-store'});
 if(!response.ok)throw new Error('Published content directory unavailable');
 return response.json() as Promise<PublishedCmsSummary[]>;
}
