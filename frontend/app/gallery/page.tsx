export const dynamic='force-dynamic';
import Image from 'next/image';
import {ClientPage} from '@/components/client-page';
import {approvedGallery} from '@/lib/cms-gallery';
import {publicMetadata} from '@/lib/metadata';
export const metadata=publicMetadata('/gallery','Gallery','Approved Foundation images and highlights.',false);
export default async function Gallery(){
 const images=await approvedGallery();
 return <ClientPage slug="gallery">
  {images.length>0&&<section className="section cms-extensions" aria-label="Approved Foundation gallery"><div className="container">
   <h2>Approved Foundation photographs</h2>
   <div className="gallery-grid">
    {images.map(item=><figure className="gallery-card" key={item.id}>
     <Image src={'/api/media/'+item.id} alt={item.altText}
      width={item.width} height={item.height} unoptimized sizes="(max-width:720px) 100vw, 33vw"/>
     <figcaption><strong>{item.title}</strong>{item.caption&&<p>{item.caption}</p>}</figcaption>
    </figure>)}
   </div>
  </div></section>}
 </ClientPage>;
}
