/**
 * Preserve the client's original visible HTML copy, styling and layout.
 * Only replace external account hrefs in generated UAT pages, so the
 * existing nonfinancial Next.js member forms remain authoritative.
 * The immutable vendor source is never modified.
 */
const links=[
 ['https://auto.nisvarthafoundation.com/login','/member/login'],
 ['https://auto.nisvarthafoundation.com/Register','/member/register']
];
export function wireMemberLinks(source){
 let content=source;
 for(const [external,internal] of links){
  const anchor='href="'+external+'" target="_blank" rel="noopener"';
  content=content.replaceAll(anchor,'href="'+internal+'"');
 }
 return content;
}
