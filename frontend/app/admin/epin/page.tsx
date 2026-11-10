import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'E-PIN inventory',robots:{index:false,follow:false}};
export default function AdminEpinPage(){return <AdminWorkspace view="epin"/>;}
