import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Content workspace',robots:{index:false,follow:false}};
export default function AdminContentPage(){return <AdminWorkspace view="content"/>;}
