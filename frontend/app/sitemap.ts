import type {MetadataRoute} from 'next';
import {canonical,contentApproved,pages} from '@/lib/site';
import {publishedProjects} from '@/lib/projects';
export default function sitemap():MetadataRoute.Sitemap{
 if(!contentApproved)return [];
 const approvedPages=pages.filter(p=>p.publication==='INFORMATIONAL').map(p=>'/'+p.slug);
 const projectPaths=publishedProjects().map(p=>'/projects/'+p.slug);
 return ['/',...approvedPages,...projectPaths].map(path=>({
  url:canonical(path),changeFrequency:'monthly' as const,priority:path==='/'?1:0.6
 }));
}
