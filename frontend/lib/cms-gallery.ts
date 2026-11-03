import {cmsPublicEnabled} from './cms-public';
export type PublicGalleryImage={
 id:string;title:string;altText:string;caption:string|null;
 width:number;height:number;createdAt:string;
};
export async function approvedGallery():Promise<PublicGalleryImage[]>{
 if(!cmsPublicEnabled)return [];
 const base=process.env.API_INTERNAL_URL||'http://127.0.0.1:3100';
 const result=await fetch(base+'/api/v1/public/gallery',{cache:'no-store'});
 if(!result.ok)throw new Error('Gallery service is unavailable');
 return result.json() as Promise<PublicGalleryImage[]>;
}
