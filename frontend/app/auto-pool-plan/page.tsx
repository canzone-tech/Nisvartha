import type {Metadata} from 'next';
import {ClientPage} from '@/components/client-page';

export const dynamic='force-dynamic';
export const metadata:Metadata={
 title:'Auto Pool Plan',
 description:'Information about the Nisvartha Foundation 1:3 Auto Pool Plan and controlled member workflow.'
};

export default function AutoPoolPlanPage(){
 return <ClientPage slug="auto-pool-plan"/>;
}
