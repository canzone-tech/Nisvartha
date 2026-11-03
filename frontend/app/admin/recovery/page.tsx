import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Member recovery',robots:{index:false,follow:false}};
export default function AdminRecoveryPage(){return <AdminWorkspace view="recovery"/>;}
