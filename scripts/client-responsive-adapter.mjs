// Fix one demonstrated 390px overflow in the client's nine-node diagram
// at materialization time. Original HTML and stylesheet are immutable.
// This is presentation-only; does not alter wording or plan eligibility.
export const narrowMatrixStyle='<style id="client-narrow-matrix">@media(max-width:420px){.matrix-row.bottom{gap:0}.matrix-row.bottom .node.l2{width:clamp(24px,7.5vw,32px);height:clamp(24px,7.5vw,32px);font-size:.65rem}}</style>';
export function clientResponsiveHtml(html,filename){
 if(filename!=='how-it-works.html')return html;
 if(!html.includes('class="matrix-row bottom"')||!html.includes('</head>'))
  throw new Error('Client How It Works template structure changed');
 return html.replace('</head>',narrowMatrixStyle+'</head>');
}
