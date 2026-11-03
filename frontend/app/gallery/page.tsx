import Image from 'next/image';
import {approvedGallery} from '@/lib/cms-gallery';
import {publicMetadata} from '@/lib/metadata';
export const dynamic='force-dynamic';
export const metadata=publicMetadata('/gallery','Gallery','Foundation-approved images and activity highlights.',false);
export default async function Gallery(){
 const images=await approvedGallery();
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Verified moments</p><h1>Foundation Gallery</h1>
  <p className="page-lead">Images appear only after staff verification of image rights, participant consent and independent editorial approval.</p>
  {images.length===0?<section className="empty-state"><h2>No approved gallery images yet</h2>
   <p>Foundation media is being reviewed before publication.</p></section>
   :<div className="gallery-grid">{images.map(item=><figure className="gallery-card" key={item.id}>
    <Image src={'/api/media/'+item.id} alt={item.altText} width={item.width} height={item.height} unoptimized sizes="(max-width:720px) 100vw, 33vw"/>
    <figcaption><strong>{item.title}</strong>{item.caption&&<p>{item.caption}</p>}</figcaption>
   </figure>)}</div>}
 </main>;
}
