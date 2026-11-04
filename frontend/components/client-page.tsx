import {clientPageContent} from '@/lib/client-content';
import {ClientCopy} from '@/components/client-copy';

export function ClientPage({slug,liveEnquiries=false,children}:{
 slug:string;liveEnquiries?:boolean;children?:React.ReactNode
}){
 const source=clientPageContent(slug);
 if(source===null)throw new Error('Unsupported client content slug: '+slug);
 return <main id="main-content" className="client-rendered"
  data-client-page={slug} data-live-enquiries={liveEnquiries?'true':'false'}>
  <ClientCopy html={source}/>
  {children}
 </main>;
}
