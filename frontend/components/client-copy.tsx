'use client';
import type {FormEvent} from 'react';

// The client-provided form's exact original demo behavior: do not send, log or
// persist inputs. Real submission stays in the separate privacy-gated API form.
export function ClientCopy({html}:{html:string}){
 function demoSubmit(event:FormEvent<HTMLDivElement>){
  const target=event.target;
  if(!(target instanceof HTMLFormElement)||!target.matches('[data-demo-form]'))return;
  event.preventDefault();
  if(!target.reportValidity())return;
  const status=target.querySelector<HTMLElement>('[data-form-status]');
  if(status)status.textContent='Thank you. This prototype form is demonstration-only; no information has been transmitted or stored.';
  target.reset();
 }
 return <div className="client-copy" onSubmitCapture={demoSubmit}
  dangerouslySetInnerHTML={{__html:html}}/>;
}
