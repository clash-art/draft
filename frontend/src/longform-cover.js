// Adapted from Lieflat HTML Design (MIT). Original HTML and license are vendored in references/lieflat.
import editorial from '../../references/lieflat/cover-editorial.html?raw';
import geek from '../../references/lieflat/cover-geek-report.html?raw';
import consulting from '../../references/lieflat/cover-consulting-report.html?raw';
import clean from '../../references/lieflat/cover-clean-review.html?raw';
const sources={editorial,'geek-report':geek,'consulting-report':consulting,'clean-review':clean};
const props=['display','position','top','right','bottom','left','width','height','max-width','max-height','min-width','min-height','box-sizing','overflow','padding','margin','border','border-top','border-bottom','border-left','border-right','border-radius','background','color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','white-space','overflow-wrap','writing-mode','grid-template-columns','grid-column','gap','align-items','justify-content','justify-self','flex-direction','flex','opacity','z-index','transform'];
export async function articleCover(edition,body,width,height){
 const kind=edition.template?.cover_style,raw=sources[kind];if(!raw)return null;
 const doc=new DOMParser().parseFromString(raw,'text/html'),card=doc.querySelector('.card');
 const headings=[...body.querySelectorAll('h2,h3')].map(h=>h.textContent.trim()).filter(t=>!/^参考/.test(t));
 // Replace all example copy. Cover excerpts are exact source headings, never AI summaries.
 for(const el of card.querySelectorAll('*'))for(const node of [...el.childNodes])if(node.nodeType===3)node.textContent='';
 const put=(selector,text)=>{const el=card.querySelector(selector);if(el)el.textContent=text||''};
 put('h1',edition.title);put('.mast span:first-child','长文 / READING');put('.mast span:last-child',edition.template.name);put('.issue-no','01 / COVER');put('.deckline',headings[0]);put('.footer span:first-child',edition.author||'');put('.footer span:last-child','全文见后页');
 put('.bar .label','GEEK REPORT');put('.bar span:last-child','长文 / 完整阅读');put('.kicker span:first-child',edition.template.name);put('.kicker span:last-child','01');put('.subtitle',headings[0]);put('.terminal b','CONTENTS');put('.terminal p',headings.slice(1,3).join(' / '));
 put('.logo','阅读报告');put('.meta','专题长文');put('.label','LONGFORM / REPORT');put('.sub',headings[0]);put('.firm','全文见后页');
 put('.top span:first-child','长文 / 清晰版');put('.badge','01');put('.model','READ');put('.summary b','正文目录');put('.summary p',headings[0]);
 card.querySelectorAll('.article,.metric').forEach((el,i)=>{const text=el.querySelector('span');if(text)text.textContent=headings[i]||'';const number=el.querySelector('b');if(number)number.textContent=headings[i]?String(i+1).padStart(2,'0'):'';const small=el.querySelector('small');if(small)small.textContent=''});
 card.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));card.removeAttribute('aria-label');
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0',width:'600px'});document.body.append(host);const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');
 let css=doc.querySelector('style').textContent.split('@media')[0].replaceAll(':root',':host');
 style.textContent=css+'\n.card{width:600px;height:800px;max-width:none;box-shadow:none;border-radius:0;font-family:"PingFang SC",sans-serif}.card::after{display:none}';shadow.append(style,card);
 try{
  await document.fonts.ready;
  const title=card.querySelector('h1');let size=parseFloat(getComputedStyle(title).fontSize);const maxTitleHeight=kind==='editorial'?260:210;
  while(title.getBoundingClientRect().height>maxTitleHeight&&size>28){size-=1;title.style.fontSize=size+'px'}
  const elements=[card,...card.querySelectorAll('*')],resolved=elements.map(el=>{const computed=getComputedStyle(el);return props.map(p=>[p,computed.getPropertyValue(p)])});
  elements.forEach((el,i)=>{el.removeAttribute('style');resolved[i].forEach(([k,v])=>el.style.setProperty(k,v))});
  const frame=document.createElement('article');Object.assign(frame.style,{width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:getComputedStyle(card).backgroundColor});frame.dataset.cover='true';
  const scale=Math.min(width/600,height/800);Object.assign(card.style,{position:'absolute',top:((height-800*scale)/2)+'px',left:((width-600*scale)/2)+'px',transform:`scale(${scale})`,transformOrigin:'top left'});frame.append(card);return frame;
 }finally{host.remove()}
}
