import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Membership',robots:{index:false,follow:false}};
export default function AdminMembersPage(){return <AdminWorkspace view="members"/>;}
