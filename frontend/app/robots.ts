import type {MetadataRoute} from 'next';
import {contentApproved,siteUrl} from '@/lib/site';
export default function robots():MetadataRoute.Robots {
 return {
  rules: contentApproved
    ? [{userAgent:'*',allow:'/',disallow:['/auto-pool-plan','/login','/register','/api/']}]
    : [{userAgent:'*',disallow:'/'}],
  sitemap: contentApproved ? new URL('/sitemap.xml',siteUrl).toString() : undefined,
 };
}
