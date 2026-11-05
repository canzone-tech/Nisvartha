import type {Metadata} from 'next';
import {AdminWorkspace} from '@/components/admin-workspace';
export const metadata:Metadata={title:'Matrix & rebirth policy simulation',robots:{index:false,follow:false}};
export default function MatrixPage(){return <AdminWorkspace view="matrix"/>;}
