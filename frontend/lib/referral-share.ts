/**
 * No-fee, local-synthetic invitation UAT only.
 * A share URL carries only an invite code, NEVER registration PINs or member IDs.
 */
export const INVITE_CODE_PATTERN=/^[A-Za-z0-9_-]{22}$/;

export function referralLink(origin:string,inviteCode:string):string{
 if(!INVITE_CODE_PATTERN.test(inviteCode))throw new TypeError('Invalid invitation code');
 const base=new URL(origin);
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||
    base.pathname!=='/'||base.search||base.hash)
  throw new TypeError('Invalid invitation origin');
 const url=new URL('/member/register',base);
 url.searchParams.set('invite',inviteCode);
 return url.href;
}
export function whatsappReferralShareUrl(url:string):string{
 const target=new URL(url);
 if(!['http:','https:'].includes(target.protocol)||target.username||target.password||
    target.pathname!=='/member/register'||!INVITE_CODE_PATTERN.test(target.searchParams.get('invite')||'')||
    [...target.searchParams.keys()].some(k=>k!=='invite'))
  throw new TypeError('Invalid referral invitation URL');
 const message='Nisvartha Foundation membership application (nonfinancial test invitation). '+
  'Registration needs a separate E-PIN and staff approval. No income, commission or reward is promised. '+target.href;
 return 'https://wa.me/?text='+encodeURIComponent(message);
}
