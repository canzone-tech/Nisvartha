import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';
export const metadata:Metadata={title:'Donation register',robots:{index:false,follow:false}};
export default function Donations(){return <AdminWorkspace view="donations"/>;}
