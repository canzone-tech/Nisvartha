import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Staff access',robots:{index:false,follow:false}};
export default function AdminStaffPage(){return <AdminWorkspace view="staff"/>;}
