/**
 * Editorial staging for Phase 1. Entries require evidence, rights and approval.
 * Phase 2 will move these contracts into the authoritative MySQL CMS.
 */
export type Activity = {
 slug:string;
 title:string;
 summary:string;
 category:'COMMUNITY'|'GO_GREEN'|'OTHER';
 occurredAt?:string;
 location?:string;
 outcome?:string;
 approved:true;
 publishedAt:string;
};
export type Announcement = {
 slug:string;
 title:string;
 summary:string;
 kind:'NEWS'|'EVENT';
 startsAt?:string;
 timezone?:string;
 venue?:string;
 registrationUrl?:string;
 archived:boolean;
 approved:true;
 publishedAt:string;
};
// Deliberately empty until Foundation source records have written approval.
const activities:readonly Activity[]=[];
const announcements:readonly Announcement[]=[];
export const publishedActivities=()=>activities.filter(a=>a.approved===true&&Boolean(a.publishedAt));
export const publishedAnnouncements=()=>announcements.filter(a=>a.approved===true&&Boolean(a.publishedAt));
export const goGreenActivities=()=>publishedActivities().filter(a=>a.category==='GO_GREEN');
