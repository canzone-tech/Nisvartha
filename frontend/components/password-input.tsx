'use client';
import {useId,useState} from 'react';
import type {InputHTMLAttributes} from 'react';

type PasswordInputProps=Omit<InputHTMLAttributes<HTMLInputElement>,'type'>&{
 label:string;
};

/** Reuses native password input behavior while offering an explicit visibility control. */
export function PasswordInput({label,id,...props}:PasswordInputProps){
 const generatedId=useId();
 const inputId=id??generatedId;
 const [visible,setVisible]=useState(false);
 const action=(visible?'Hide ':'Show ')+label.toLowerCase();
 return <div className="password-field-group">
  <label htmlFor={inputId}>{label}</label>
  <span className="password-field">
   <input {...props} id={inputId} type={visible?'text':'password'}/>
   <button type="button" className="password-visibility-toggle"
    aria-label={action} title={action} aria-pressed={visible}
    onClick={()=>setVisible(value=>!value)}>
    {visible?<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18"/>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c4.6 0 8.2 3.1 10 7a12 12 0 0 1-3 4.3"/>
      <path d="M6.5 6.5C4.5 7.9 3 9.8 2 12c1.8 3.9 5.4 7 10 7 1.7 0 3.3-.4 4.7-1.1"/>
    </svg>:<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>}
   </button>
  </span>
 </div>;
}
