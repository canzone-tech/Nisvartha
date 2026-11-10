import {redirect} from 'next/navigation';
// The approved public website is static; obsolete editor routes are retired.
export default function RetiredEditorRoute(){redirect('/admin');}
