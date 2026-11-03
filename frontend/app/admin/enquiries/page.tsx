import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Enquiries',robots:{index:false,follow:false}};
export default function AdminEnquiriesPage(){return <AdminWorkspace view="enquiries"/>;}
