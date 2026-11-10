/** Exact base-10 rupees -> integer paise. Never use binary floats for money. */
export function parseRupeesToPaise(input:string):number|null{
 const value=input.trim();
 if(!/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/.test(value))return null;
 const [rupees,fraction='']=value.split('.');
 const paise=Number(rupees)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(paise)&&paise>0&&paise<=2_000_000_000?paise:null;
}
