export function ClientCopy({html}:{html:string}){
 return <div className="client-copy" dangerouslySetInnerHTML={{__html:html}}/>;
}
