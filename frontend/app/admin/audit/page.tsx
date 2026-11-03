import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Activity history',robots:{index:false,follow:false}};
export default function AdminAuditPage(){return <AdminWorkspace view="audit"/>;}
