import {redirect} from 'next/navigation';
import Link from 'next/link';
import {staffFetch} from '@/lib/staff-session';
import {AdminLogoutButton} from '@/components/admin-logout';
import {CmsWorkspace} from '@/components/cms-workspace';
import {StaffManagement} from '@/components/admin-staff-panel';
import {AdminEpinBatchValidationPanel} from '@/components/admin-epin-batch-validation';
import {AdminMatrixPreview} from '@/components/admin-matrix-preview';
import {AdminAuditPanel} from '@/components/admin-audit-panel';
import {EnquiryCasePanel} from '@/components/admin-enquiries';
import {AdminMediaPanel} from '@/components/admin-media-panel';
import {MembershipReviewPanel} from '@/components/admin-memberships';
import {StaffAssistedRegistrationPanel} from '@/components/admin-member-registration';
import {AdminUatSignupPins} from '@/components/admin-uat-signup-pins';
import {AdminMemberRecoveryPanel} from '@/components/admin-member-recovery';

type Role='SUPER_ADMIN'|'ADMIN'|'EDITOR'|'APPROVER'|'AUDITOR';
type User={id:string;email:string;role:Role};
export type AdminView='overview'|'content'|'media'|'enquiries'|'members'|'staff'|'audit'|'epin'|'recovery'|'matrix';
type NavigationItem={view:AdminView;label:string;description:string};
type Group={label:string;items:NavigationItem[]};
type Counts={drafts:number;submitted:number;published:number;newEnquiries:number;newVolunteerEnquiries:number};

function availableGroups(user:User,recoveryEnabled:boolean,planEnabled:boolean):Group[]{
 const admin=user.role==='ADMIN'||user.role==='SUPER_ADMIN';
 const handleEnquiries=admin||user.role==='APPROVER';
 const groups:Group[]=[
  {label:'Website',items:[
   {view:'overview',label:'Overview',description:'Your Foundation at a glance'},
   {view:'content',label:'Content workspace',description:'Pages, projects and approvals'},
   {view:'media',label:'Photos & gallery',description:'Upload and review images'},
  ]},
  {label:'People',items:[
   ...(handleEnquiries?[{view:'enquiries' as const,label:'Enquiries',description:'Contact and volunteer messages'}]:[]),
   ...(handleEnquiries?[{view:'members' as const,label:'Membership',description:'Nonfinancial applications'}]:[]),
  ]},
  {label:'Administration',items:[
   ...(admin?[{view:'staff' as const,label:'Staff access',description:'Staff roles and accounts'}]:[]),
   ...(admin||user.role==='AUDITOR'?[{view:'audit' as const,label:'Activity history',description:'Read-only audit trail'}]:[]),
   ...(admin&&recoveryEnabled?[{view:'recovery' as const,label:'Member recovery',description:'Assisted access recovery'}]:[]),
   ...(admin?[{view:'epin' as const,label:'E-PIN policy preview',description:'Validation only — no issued PINs'}]:[]),
   ...(planEnabled&&(admin||user.role==='APPROVER')?[{view:'matrix' as const,label:'Matrix & rebirth preview',description:'Drafts and independent scenario review'}]:[]),
  ]},
 ];
 return groups.filter(group=>group.items.length>0);
}
const ADMIN_PATHS:Record<AdminView,string>={
 overview:'/admin',content:'/admin/content',media:'/admin/gallery',
 enquiries:'/admin/enquiries',members:'/admin/members',
 staff:'/admin/staff',audit:'/admin/audit',
 epin:'/admin/epin',recovery:'/admin/recovery',matrix:'/admin/matrix'
};
export function adminHref(view:AdminView){return ADMIN_PATHS[view];}
export function legacyAdminHref(view:string):string|null{
 return Object.hasOwn(ADMIN_PATHS,view)?ADMIN_PATHS[view as AdminView]:null;
}

function AdminNavigation({groups,view,label}:{groups:Group[];view:AdminView;label:string}){
 return <nav aria-label={label}>
     {groups.map(group=><div key={group.label} className="foundation-admin-nav-group">
      {group.label==='Administration'?<details open={group.items.some(item=>item.view===view)}>
       <summary>Administration</summary>
       {group.items.map(item=><Link key={item.view} href={adminHref(item.view)}
        aria-current={view===item.view?'page':undefined}
        className={'foundation-admin-nav-link'+(view===item.view?' active':'')}>
        {item.label}
       </Link>)}
      </details>:<>
       <p>{group.label}</p>
       {group.items.map(item=><Link key={item.view} href={adminHref(item.view)}
        aria-current={view===item.view?'page':undefined}
        className={'foundation-admin-nav-link'+(view===item.view?' active':'')}>
        {item.label}
       </Link>)}
      </>}
     </div>)}
    </nav>;
}

async function Overview({groups}:{groups:Group[]}){
 const response=await staffFetch('cms/dashboard');
 const counts:Counts|null=response.ok?await response.json() as Counts:null;
 const metrics=[
  ['Drafts',counts?.drafts],
  ['Awaiting approval',counts?.submitted],
  ['Published',counts?.published],
  ['New enquiries',counts?.newEnquiries],
  ['Volunteer enquiries',counts?.newVolunteerEnquiries],
 ] as const;
 const shortcuts=groups.flatMap(group=>group.items).filter(item=>item.view!=='overview'&&item.view!=='epin'&&item.view!=='audit'&&item.view!=='recovery');
 return <>
  <section className="foundation-admin-welcome">
   <p className="eyebrow">Nisvartha Foundation</p>
   <h2>Make a difference, one update at a time.</h2>
   <p>Choose what you need to work on. Website updates stay in review until an independent approver publishes them.</p>
  </section>
  <section aria-label="Website overview">
   <h2 className="foundation-admin-section-title">At a glance</h2>
   {counts?<div className="foundation-admin-stats">
    {metrics.map(([name,value])=><div key={name}><strong>{value}</strong><span>{name}</span></div>)}
   </div>:<p role="status">Live summary is unavailable. Open Content workspace to continue.</p>}
  </section>
  <section aria-label="Workspace shortcuts">
   <h2 className="foundation-admin-section-title">Where would you like to go?</h2>
   <div className="foundation-admin-shortcuts">
    {shortcuts.map(item=><Link key={item.view} href={adminHref(item.view)} className="foundation-admin-shortcut">
     <strong>{item.label}</strong><span>{item.description}</span><span className="foundation-admin-shortcut-arrow" aria-hidden="true">→</span>
    </Link>)}
   </div>
  </section>
  <p className="foundation-admin-footnote">UAT environment · Real payments, paid E-PIN issuance and compensation are not available.</p>
 </>;
}

export async function AdminWorkspace({view}:{view:AdminView}){
 const response=await staffFetch('staff/me');
 if(!response.ok)redirect('/admin/login');
 const user=await response.json() as User;
 const admin=user.role==='ADMIN'||user.role==='SUPER_ADMIN';
 const handleEnquiries=admin||user.role==='APPROVER';
 const groups=availableGroups(user,process.env.MEMBER_RECOVERY_ENABLED==='true',process.env.NISVARTHA_UAT_PLAN==='synthetic');
 const permitted=new Set(groups.flatMap(group=>group.items.map(item=>item.view)));
 if(!permitted.has(view))redirect('/admin');
 const selected=groups.flatMap(group=>group.items).find(item=>item.view===view)!;
 return <main id="main-content" className="admin-shell foundation-admin">
  <header className="foundation-admin-header">
   <Link href="/admin" className="foundation-admin-brand" aria-label="Nisvartha Foundation Admin dashboard">
    <span className="foundation-admin-brand-mark" aria-hidden="true">✦</span>
    <span>NISVARTHA<small>ADMIN CONSOLE</small></span>
   </Link>
   <div className="foundation-admin-page-title">
    <p className="eyebrow">Foundation administration</p>
    <h1>{selected.label}</h1>
    <p className="foundation-admin-subtitle">{selected.description}</p>
   </div>
   <div className="foundation-admin-account">
    <span title={user.email}>{user.email}</span>
    <AdminLogoutButton/>
   </div>
  </header>
  <div className="foundation-admin-layout">
   <details className="foundation-admin-mobile-navigation">
    <summary>Menu · {selected.label}</summary>
    <AdminNavigation groups={groups} view={view} label="Mobile workspace navigation"/>
    <Link href="/" className="foundation-admin-public-link">View public website ↗</Link>
   </details>
   <aside className="foundation-admin-sidebar">
<AdminNavigation groups={groups} view={view} label="Workspace navigation"/>
    <Link href="/" className="foundation-admin-public-link">View public website <span aria-hidden="true">↗</span></Link>
   </aside>
   <div className="foundation-admin-main" data-workspace-view={view}>
    {view==='overview'&&<Overview groups={groups}/>}
    {view==='content'&&<CmsWorkspace user={user}/>}
    {view==='media'&&<AdminMediaPanel user={user}/>}
    {view==='enquiries'&&handleEnquiries&&<EnquiryCasePanel user={{id:user.id,role:user.role as 'SUPER_ADMIN'|'ADMIN'|'APPROVER'}}/>}
    {view==='members'&&admin&&process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'&&
      <AdminUatSignupPins/>}
    {view==='members'&&admin&&process.env.MEMBER_STAFF_REGISTRATION_ENABLED==='true'&&
      process.env.MEMBER_PORTAL_ENABLED==='true'&&process.env.MEMBER_APPLICATIONS_ENABLED==='true'&&
      process.env.MEMBER_TERMS_VERSION&&process.env.MEMBER_PRIVACY_VERSION&&
      <StaffAssistedRegistrationPanel termsVersion={process.env.MEMBER_TERMS_VERSION}
       privacyVersion={process.env.MEMBER_PRIVACY_VERSION}
       uatPinEnabled={process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'}/>}
    {view==='members'&&handleEnquiries&&<MembershipReviewPanel canViewGenealogy={admin&&process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'}/>}
    {view==='staff'&&admin&&<StaffManagement/>}
    {view==='audit'&&(admin||user.role==='AUDITOR')&&<AdminAuditPanel/>}
    {view==='recovery'&&admin&&process.env.MEMBER_RECOVERY_ENABLED==='true'&&<AdminMemberRecoveryPanel/>}
    {view==='epin'&&admin&&<AdminEpinBatchValidationPanel/>}
    {view==='matrix'&&process.env.NISVARTHA_UAT_PLAN==='synthetic'&&<AdminMatrixPreview canEdit={admin} actorId={user.id}/>}
   </div>
  </div>
 </main>;
}
