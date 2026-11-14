import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';
export const metadata:Metadata={title:'Business rules',robots:{index:false,follow:false}};
export default function AdminBusinessRulesPage(){return <AdminWorkspace view="financial-plan"/>;}
