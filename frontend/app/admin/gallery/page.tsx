import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Photos & gallery',robots:{index:false,follow:false}};
export default function AdminGalleryPage(){return <AdminWorkspace view="media"/>;}
