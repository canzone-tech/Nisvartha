import {clientPageContent} from '@/lib/client-content';
import {ClientCopy} from '@/components/client-copy';

export function ClientPage({slug,children}:{slug:string;children?:React.ReactNode}){
 const source=clientPageContent(slug);
 if(source===null)throw new Error('Unsupported client content slug: '+slug);
 return <main id="main-content" className="client-rendered" data-client-page={slug}>
  <ClientCopy html={source}/>
  {children}
 </main>;
}
