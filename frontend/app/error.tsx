'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main id="main-content" role="alert"><h1>Unable to load this page</h1><p>Please try again.</p><button type="button" onClick={reset}>Retry</button></main>}
