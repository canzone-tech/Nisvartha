import Link from 'next/link';
import {publicMetadata} from '@/lib/metadata';
import {publishedActivities,publishedAnnouncements} from '@/lib/publications';
import {publishedProjects} from '@/lib/pexport const metadata=publicMetadata('/','Home','Nisvartha Foundation: community and environmental participation.',true);
bsite'}
};
const routes=[
 {number:'01',title:'The Foundation',description:'Our objectives, principles and organizational information.',href:'/about',label:'Learn about us'},
 {number:'02',title:'Community projects',description:'Explore published activities, projects and their verified progress.',href:'/projects',label:'View projects'},
 {number:'03',title:'Go Green',description:'Discover environmental campaigns and ways to help protect nature.',href:'/go-green',label:'Explore initiatives'},
];
export default function Home(){
 const projects=publishedProjects().slice(0,3);
 const activities=publishedActivities().slice(0,3);
 const news=publishedAnnouncements().slice(0,2);
 return <main id="main-content">
  <section className="hero"><div className="hero-inner">
   <div className="hero-content">
    <p className="eyebrow">People · Community · Environment</p>
    <h1>Together for a <em>Brighter Tomorrow.</em></h1>
    <p className="hero-lead">Welcome to Nisvartha Foundation. Discover the ways we aim to connect people, community initiatives and environmental participation.</p>
    <div className="actions"><Link className="button" href="/about">Discover Nisvartha <span aria-hidden="true">↗</span></Link>
     <Link className="button alt" href="/volunteer">Explore volunteering</Link></div>
    <p className="review-notice">Official organizational information and activities remain subject to verification before publication.</p>
   </div>
   <div className="hero-art" aria-hidden="true"><span className="art-circle circle-one"/><span className="art-circle circle-two"/><span className="art-circle circle-three"/><div className="art-core"><span>Grow</span><strong>Together</strong></div></div>
  </div></section>
  <section className="section">
   <div className="section-title"><p className="eyebrow">About our platform</p><h2>Explore what matters</h2><p>Information about the Foundation, its proposed activities and opportunities for participation.</p></div>
   <div className="tiles">{routes.map(r=><article className="feature-card" key={r.number}>
    <span className="feature-number">{r.number}</span><h3>{r.title}</h3><p>{r.description}</p>
    <Link className="text-link" href={r.href}>{r.label} <span aria-hidden="true">↗</span></Link>
   </article>)}</div>
  </section>
  {projects.length>0&&<section className="section"><div className="section-title"><p className="eyebrow">Our work</p><h2>Featured projects</h2></div>
   <div className="project-grid">{projects.map(p=><article key={p.slug} className="project-card"><h3>{p.title}</h3><p>{p.summary}</p><Link href={'/projects/'+p.slug}>View details</Link></article>)}</div></section>}
  {activities.length>0&&<section className="section"><div className="section-title"><p className="eyebrow">In action</p><h2>Recent activities</h2></div>
   <div className="project-grid">{activities.map(a=><article key={a.slug} className="project-card"><h3>{a.title}</h3><p>{a.summary}</p></article>)}</div><Link href="/activities" className="text-link">All activities</Link></section>}
  {news.length>0&&<section className="section"><div className="section-title"><p className="eyebrow">Announcements</p><h2>News & events</h2></div>
   <div className="project-grid">{news.map(n=><article key={n.slug} className="project-card"><h3>{n.title}</h3><p>{n.summary}</p></article>)}</div><Link href="/news-events" className="text-link">More updates</Link></section>}
  <section className="involvement"><div><p className="eyebrow">Get involved</p><h2>Every meaningful step starts with connection.</h2><p>Explore volunteering and find out how to contact us. Enquiries will open after privacy approval.</p></div>
   <Link href="/contact" className="button alt">Contact the Foundation</Link></section>
 </main>;
}
