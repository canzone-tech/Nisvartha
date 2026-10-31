import type {Metadata} from 'next';
import {canonical,contentApproved,siteName} from './site';

/** All pages are non-indexable unless both source content and launch approval are present. */
export function publicMetadata(path:string,title:string,description:string,approved=false):Metadata{
 const indexed=contentApproved && approved;
 const url=canonical(path);
 return {
  title,description,
  alternates:{canonical:url},
  openGraph:{title,description,url,siteName,type:'website'},
  twitter:{card:'summary',title,description},
  robots:{index:indexed,follow:indexed}
 };
}
