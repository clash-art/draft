import DOMPurify from 'dompurify';
// Page themes for Xiaohongshu longform. All styling is inline so exported PNGs and the
// in-app HTML preview match regardless of surrounding app CSS. Elements marked
// data-deco carry no article text and are excluded from content verification.
export const SANS='"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
export const SERIF='"Songti SC","Noto Serif CJK SC","Source Han Serif SC","STSong","SimSun",serif';
export const MONO='"SF Mono","JetBrains Mono",Menlo,Consolas,"Noto Sans Mono CJK SC",monospace';
const hex=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:null;
export function mix(a,b,t){const p=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const x=p(a),y=p(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
export function el(tag,style={},children=[],attrs={}){
 const node=document.createElement(tag);Object.assign(node.style,style);
 for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);
 for(const c of [].concat(children))if(c!=null)node.append(typeof c==='string'?document.createTextNode(c):c);
 return node;
}
const deco=(tag,style,children)=>el(tag,style,children,{'data-deco':'true','aria-hidden':'true'});
function html(node,value,t){node.innerHTML=DOMPurify.sanitize(value||'');styleInline(node,t);return node}
// Resets properties that the workbench's global CSS sets on bare elements.
function styleInline(node,t){
 for(const a of node.querySelectorAll('a'))Object.assign(a.style,{display:'inline',color:t.link,textDecoration:'none',wordBreak:'break-all',gap:'0'});
 for(const s of node.querySelectorAll('strong,b'))Object.assign(s.style,{fontWeight:'700',color:t.strong});
 for(const c of node.querySelectorAll('code'))Object.assign(c.style,{fontFamily:MONO,fontSize:'0.86em',background:t.codeBg,padding:'0 3px',borderRadius:'3px',wordBreak:'break-all'});
 for(const e of node.querySelectorAll('em,i'))Object.assign(e.style,{fontStyle:'normal',color:t.strong});
}
const BALANCE={textWrap:'balance'};
// Keeps "前缀：主题" headings from breaking inside the words after the colon.
function phrased(node,style){
 const m=!node.querySelector('*')&&node.textContent.match(/^(.+?[：:])(.+)$/);
 if(m)node.replaceChildren(...[m[1],m[2]].map(x=>el('span',{display:'inline-block',...style},[x])));
 else if(style)node.replaceChildren(el('span',style,[...node.childNodes]));
 return node;
}
const text=(t,extra={})=>({margin:`0 0 ${t.gap}px`,fontSize:t.size+'px',lineHeight:String(t.leading),color:t.body,textAlign:'justify',overflowWrap:'anywhere',lineBreak:'strict',...extra});
function oneLine(style={}){return {whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',...style}}
function headingText(value){const d=document.createElement('div');d.innerHTML=DOMPurify.sanitize(value||'');return d.textContent}
function splitTitle(title){const m=String(title||'').match(/^(.{4,}?)[：:｜|—]+\s*(.{2,})$/);return m?[m[1].trim(),m[2].trim()]:[String(title||''),'']}
// compact>0 tightens only the reference list, used to avoid a near-empty final page.
function tokens(template,base,{compact=0}={}){
 const accent=hex(template?.accent)||base.accent;
 const size=Number(template?.font_size)||base.size,leading=Number(template?.line_height)||base.leading;
 const refGap=Number(template?.reference_gap)||base.refGap;
 return {...base,accent,size,leading,gap:Number(template?.paragraph_gap)||base.gap,refSize:Number(template?.reference_size)||base.refSize,refGap:Math.max(2,refGap-3*compact),refLeading:1.5-0.07*compact};
}
// Shared figure builder: frame style differs per theme.
function figure(t,b,image,n,{frame={},img={},caption={},tag}={}){
 const picture=el('img',{display:'block',maxWidth:'100%',width:'auto',height:'auto',margin:'0 auto',...img},[],{src:image.src,alt:b.alt||'','data-ref':image.ref||''});
 const box=el('div',{...frame},[picture]);
 const kids=[box];
 if(b.caption){const cap=html(el('div',{...caption}),b.caption,t);if(tag)cap.prepend(tag(n));kids.push(cap)}
 else if(tag)kids.push(el('div',{...caption},[tag(n)]));
 return el('figure',{margin:'0',padding:'0'},kids);
}

const FOLIO={id:'folio',accent:'#9e3b26',size:15,leading:1.8,gap:11,refSize:11,refGap:7,paper:'#f6f1e7',ink:'#211d18',body:'#2c2620',muted:'#83786a',rule:'#d8cdbb',font:SERIF,pad:{top:48,right:30,bottom:44,left:30}};
const BRIEF={id:'brief',accent:'#2b59c3',size:15,leading:1.75,gap:10,refSize:11,refGap:6,paper:'#ffffff',ink:'#101b2a',body:'#29333f',muted:'#6a7584',rule:'#e1e6ee',font:SANS,pad:{top:46,right:26,bottom:40,left:26}};
const NOTE={id:'note',accent:'#e0533d',size:15,leading:1.8,gap:11,refSize:11,refGap:6,paper:'#f3eee6',ink:'#24211d',body:'#2f2b27',muted:'#8a8178',rule:'#ece6dc',font:SANS,pad:{top:34,right:30,bottom:48,left:30}};

function folio(template,opts){
 const t=tokens(template,FOLIO,opts);Object.assign(t,{strong:t.ink,link:t.accent,codeBg:'#ece4d6'});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead(b){const p=html(el('p',text(t,{fontSize:(t.size+0.5)+'px',color:t.ink,textAlign:'left'})),b.html,t);
   const first=p.firstChild;
   if(first?.nodeType===3&&first.textContent.trim()){const s=first.textContent.replace(/^\s+/,''),ch=[...s][0];first.textContent=s.slice(ch.length);
    p.prepend(el('span',{float:'left',fontSize:/[A-Za-z]/.test(ch)?'50px':'40px',lineHeight:'44px',height:'44px',margin:'5px 7px 0 0',color:t.accent,fontWeight:'700',fontFamily:SERIF},[ch]))}
   return p},
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'22px 0 12px',paddingTop:'10px',borderTop:`1px solid ${t.ink}`,display:'flex',alignItems:'flex-start',gap:'12px'},[
   el('span',{fontFamily:SERIF,fontSize:'34px',lineHeight:'1',color:t.accent,fontWeight:'700',flexShrink:'0',marginTop:'1px'},[b.number]),
   phrased(html(el('h3',{margin:'0',flex:'1',fontFamily:SERIF,fontSize:'19px',lineHeight:'1.45',fontWeight:'700',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'20px 0 8px',fontFamily:SERIF,fontSize:'17px',lineHeight:'1.45',fontWeight:'700',color:t.ink}),b.html,t),
  label(b){const d=el('div',{margin:'18px 0 7px',display:'flex',alignItems:'center',gap:'8px',fontFamily:SANS,fontSize:'12px',lineHeight:'1.4',letterSpacing:'0.12em',color:t.accent}),s=html(el('span',{}),b.html,t);s.querySelectorAll('strong').forEach(x=>x.style.color=t.accent);d.append(deco('span',{width:'14px',height:'1px',background:t.accent}),s);return d},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:(t.size-1)+'px',lineHeight:'1.7',margin:'0 0 6px',padding:'1px 0 1px 12px',borderLeft:`2px solid ${t.rule}`}));const k=html(el('strong',{fontWeight:'700',color:t.ink}),b.key,t);p.append(k);p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{background:'#fff',padding:'6px',border:`1px solid ${t.rule}`},caption:{marginTop:'8px',padding:'0 18px',fontFamily:SANS,fontSize:'10.5px',lineHeight:'1.6',color:t.muted,textAlign:'left'},tag:n=>deco('span',{color:t.accent,letterSpacing:'0.08em',marginRight:'6px',fontWeight:'600'},[`图 ${String(n).padStart(2,'0')}`])}),
  figureMargin:'14px -18px 18px',bleed:18,
  quote:b=>html(el('blockquote',{margin:'14px 0',padding:'2px 0 2px 14px',borderLeft:`2px solid ${t.accent}`,color:t.muted,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'24px 0 12px'},[deco('div',{fontFamily:SANS,fontSize:'9px',letterSpacing:'0.3em',color:t.accent,marginBottom:'4px'},['REFERENCES']),html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:'20px',lineHeight:'1.4',color:t.ink,fontWeight:'700',paddingBottom:'8px',borderBottom:`1px solid ${t.ink}`}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:SERIF,fontWeight:'700'},name:{color:t.ink,fontWeight:'600'},url:{color:t.muted}}),
  end:()=>deco('div',{display:'flex',justifyContent:'center',alignItems:'center',gap:'8px',margin:'20px 0 8px'},[el('span',{width:'22px',height:'1px',background:t.rule}),el('span',{width:'6px',height:'6px',background:t.accent,transform:'rotate(45deg)'}),el('span',{width:'22px',height:'1px',background:t.rule})]),
  frame(page,{index,total,section}){
   page.append(deco('div',{position:'absolute',top:'18px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'12px',paddingBottom:'7px',borderBottom:`1px solid ${t.rule}`,fontSize:'8.5px',lineHeight:'12px',color:t.muted},[el('span',{fontFamily:SANS,letterSpacing:'0.24em',flexShrink:'0'},['LONG READ']),el('span',oneLine({fontFamily:SERIF,maxWidth:'215px',fontSize:'9px'}),[section?`${section.number}　${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',bottom:'16px',left:'0',right:'0',display:'flex',justifyContent:'center',alignItems:'center',gap:'8px',fontFamily:SERIF,fontSize:'10px',lineHeight:'12px',color:t.muted},[el('span',{width:'16px',height:'1px',background:t.rule}),el('span',{color:t.accent,fontWeight:'700'},[String(index).padStart(2,'0')]),el('span',{},[`/ ${String(total).padStart(2,'0')}`]),el('span',{width:'16px',height:'1px',background:t.rule})]));
  },
  cover({title,image,sections,stats,width,height}){
   const [main,sub]=splitTitle(title);
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SERIF,padding:'24px 30px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',alignItems:'baseline',fontFamily:SANS,fontSize:'8.5px',letterSpacing:'0.26em',color:t.ink,paddingBottom:'6px',borderBottom:`2px solid ${t.ink}`},[el('span',{},['LONG READ']),el('span',{letterSpacing:'0.08em',color:t.muted},[`${stats.figures} 图 · ${stats.references} 条参考 · 约 ${stats.minutes} 分钟`])]));
   page.append(deco('div',{height:'1px',background:t.ink,marginTop:'2px'}));
   page.append(deco('h1',{margin:'22px 0 0',fontFamily:SERIF,fontSize:'29px',lineHeight:'1.24',fontWeight:'800',letterSpacing:'-0.01em',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'9px',fontFamily:SERIF,fontSize:'16px',lineHeight:'1.45',color:t.accent,fontWeight:'600'},[sub]));
   if(image)page.append(el('div',{flex:'1 1 auto',minHeight:'80px',marginTop:'16px',display:'flex',alignItems:'center',justifyContent:'center'},[el('div',{background:'#fff',padding:'5px',border:`1px solid ${t.rule}`,maxHeight:'100%',display:'flex'},[el('img',{display:'block',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',objectFit:'contain'},[],{src:image.src,alt:'','data-ref':image.ref,'data-cover-image':'true'})])]));
   else page.append(el('div',{flex:'1'}));
   if(sections.length)page.append(deco('div',{marginTop:'14px'},[el('div',{fontFamily:SANS,fontSize:'8.5px',letterSpacing:'0.3em',color:t.accent,marginBottom:'5px'},['CONTENTS']),...sections.map(s=>el('div',{display:'flex',alignItems:'baseline',gap:'8px',padding:'3px 0',borderTop:`1px solid ${t.rule}`,fontSize:'11.5px',lineHeight:'1.45'},[el('span',{color:t.accent,fontWeight:'700',width:'18px',flexShrink:'0'},[s.number]),el('span',oneLine({flex:'1',color:t.ink}),[headingText(s.html)]),el('span',{color:t.muted,fontSize:'10px',fontFamily:SANS},[String(s.page)])]))]));
   return page;
  },
 };
}

function brief(template,opts){
 const t=tokens(template,BRIEF,opts);const tint=mix(t.accent,'#ffffff',0.9),deep=mix(t.accent,'#0b1220',0.78),light=mix(t.accent,'#ffffff',0.55);
 Object.assign(t,{strong:t.ink,link:t.accent,codeBg:'#eef1f6',tint,deep,light});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{fontSize:(t.size+0.5)+'px',color:t.ink,padding:'0 0 0 12px',borderLeft:`3px solid ${t.accent}`})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'20px 0 10px'},[
   el('div',{display:'flex',alignItems:'center',gap:'6px',fontFamily:MONO,fontSize:'9.5px',lineHeight:'1.4',letterSpacing:'0.14em',color:t.accent,fontWeight:'700'},[deco('span',{},['SECTION']),el('span',{},[b.number]),deco('span',{flex:'1',height:'1px',background:t.rule,marginLeft:'6px'})]),
   phrased(html(el('h3',{margin:'7px 0 0',fontFamily:SANS,fontSize:'19px',lineHeight:'1.42',fontWeight:'700',color:t.ink,textAlign:'left',...BALANCE}),b.html,t)),
   deco('div',{width:'26px',height:'3px',background:t.accent,marginTop:'8px'})])},
  heading:b=>html(el('h4',{margin:'18px 0 8px',fontSize:'16.5px',lineHeight:'1.45',fontWeight:'700',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',{display:'inline-block',background:tint,color:t.accent,fontSize:'12px',lineHeight:'1.5',padding:'2px 9px',borderRadius:'3px',letterSpacing:'0.06em'}),b.html,t);s.querySelectorAll('strong').forEach(x=>x.style.color=t.accent);return el('div',{margin:'16px 0 7px'},[s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:(t.size-1)+'px',lineHeight:'1.65',margin:'0 0 5px',padding:'7px 10px',background:'#f5f7fa',borderRadius:'4px'}));p.append(html(el('strong',{fontWeight:'700',color:t.deep}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,borderRadius:'6px',overflow:'hidden',background:'#fff'},caption:{marginTop:'7px',padding:'0 14px',fontSize:'10.5px',lineHeight:'1.6',color:t.muted,textAlign:'left'},tag:n=>deco('span',{fontFamily:MONO,fontSize:'8.5px',fontWeight:'700',color:t.accent,background:tint,padding:'1px 5px',borderRadius:'2px',marginRight:'7px',letterSpacing:'0.06em'},[`FIG ${String(n).padStart(2,'0')}`])}),
  figureMargin:'14px -14px 16px',bleed:14,
  quote:b=>html(el('blockquote',{margin:'14px 0',padding:'8px 12px',background:tint,borderLeft:`3px solid ${t.accent}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'22px 0 12px'},[el('div',{display:'flex',alignItems:'center',gap:'6px',fontFamily:MONO,fontSize:'9.5px',letterSpacing:'0.14em',color:t.accent,fontWeight:'700'},[deco('span',{},['APPENDIX']),deco('span',{flex:'1',height:'1px',background:t.rule,marginLeft:'6px'})]),html(el('h3',{margin:'7px 0 0',fontSize:'19px',lineHeight:'1.4',color:t.ink,fontWeight:'700'}),b.html,t),deco('div',{width:'26px',height:'3px',background:t.accent,marginTop:'9px'})]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:MONO,fontWeight:'700',fontSize:'0.92em'},name:{color:t.ink,fontWeight:'600'},url:{color:t.accent,opacity:'0.85',fontFamily:MONO,fontSize:Math.max(8.5,t.refSize-1.5)+'px'},row:{padding:'0 0 5px',borderBottom:`1px solid ${t.rule}`}}),
  end:()=>deco('div',{display:'flex',alignItems:'center',gap:'8px',margin:'18px 0 6px',fontFamily:MONO,fontSize:'8.5px',letterSpacing:'0.3em',color:t.muted},[el('span',{flex:'1',height:'1px',background:t.rule}),el('span',{},['END']),el('span',{flex:'1',height:'1px',background:t.rule})]),
  frame(page,{index,total,section,sectionIndex,sectionCount,title}){
   if(sectionCount)page.append(deco('div',{position:'absolute',top:'16px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',gap:'3px'},Array.from({length:sectionCount},(_,i)=>el('span',{flex:'1',height:'3px',borderRadius:'2px',background:i<=sectionIndex?t.accent:t.rule}))));
   page.append(deco('div',oneLine({position:'absolute',top:'25px',left:t.pad.left+'px',right:t.pad.right+'px',fontSize:'9px',lineHeight:'12px',color:t.muted}),[section?`§ ${section.number}　${headingText(section.html)}`:'']));
   page.append(deco('div',{position:'absolute',bottom:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',fontSize:'8.5px',lineHeight:'12px',color:t.muted},[el('span',oneLine({maxWidth:'230px'}),[title]),el('span',{fontFamily:MONO,color:t.ink,fontWeight:'700',fontSize:'9px'},[`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`])]));
  },
  cover({title,image,sections,stats,width,height}){
   const [main,sub]=splitTitle(title),line='rgba(255,255,255,0.06)';
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:deep,backgroundImage:`linear-gradient(${line} 1px,transparent 1px),linear-gradient(90deg,${line} 1px,transparent 1px)`,backgroundSize:'24px 24px',color:'#fff',fontFamily:SANS,padding:'24px 26px 20px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontFamily:MONO,fontSize:'8.5px',letterSpacing:'0.18em',color:light},[el('span',{},['RESEARCH BRIEF']),el('span',{color:'rgba(255,255,255,0.55)'},[`${stats.minutes} MIN READ`])]));
   page.append(deco('h1',{margin:'22px 0 0',fontSize:'27px',lineHeight:'1.28',fontWeight:'800',color:'#fff',letterSpacing:'-0.005em',textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'8px',fontSize:'15px',lineHeight:'1.45',color:light,fontWeight:'600'},[sub]));
   if(image)page.append(el('div',{flex:'1 1 auto',minHeight:'80px',marginTop:'16px',display:'flex',alignItems:'center'},[el('div',{background:'#fff',padding:'5px',borderRadius:'6px',maxHeight:'100%',display:'flex'},[el('img',{display:'block',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',objectFit:'contain',borderRadius:'3px'},[],{src:image.src,alt:'','data-ref':image.ref,'data-cover-image':'true'})])]));
   else page.append(el('div',{flex:'1'}));
   if(sections.length)page.append(deco('div',{marginTop:'12px'},sections.map(s=>el('div',{display:'flex',alignItems:'baseline',gap:'9px',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.12)',fontSize:'11px',lineHeight:'1.45'},[el('span',{fontFamily:MONO,color:light,fontWeight:'700',fontSize:'10px'},[s.number]),el('span',oneLine({flex:'1',color:'rgba(255,255,255,0.88)'}),[headingText(s.html)]),el('span',{fontFamily:MONO,color:'rgba(255,255,255,0.5)',fontSize:'9.5px'},[`P.${String(s.page).padStart(2,'0')}`])]))));
   page.append(deco('div',{display:'flex',marginTop:'12px',gap:'8px'},[[stats.figures,'幅配图'],[stats.references,'条参考资料'],[stats.minutes,'分钟阅读']].map(([n,l])=>el('div',{flex:'1',borderTop:`2px solid ${t.accent}`,paddingTop:'5px'},[el('div',{fontFamily:MONO,fontSize:'17px',lineHeight:'1.2',fontWeight:'700',color:'#fff'},[String(n)]),el('div',{fontSize:'8.5px',color:'rgba(255,255,255,0.6)',marginTop:'1px'},[l])]))));
   return page;
  },
 };
}

function note(template,opts){
 const t=tokens(template,NOTE,opts);const tint=mix(t.accent,'#ffffff',0.8),soft=mix(t.accent,'#ffffff',0.93);
 Object.assign(t,{strong:t.ink,link:mix(t.accent,'#000000',0.15),codeBg:'#f4efe8',tint,soft});
 const mark=`linear-gradient(transparent 62%,${tint} 62%,${tint} 92%,transparent 92%)`;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  sheet:{position:'absolute',top:'12px',left:'12px',right:'12px',bottom:'34px',background:'#fff',borderRadius:'16px',boxShadow:'0 1px 2px rgba(60,40,20,0.06)'},
  lead:b=>html(el('p',text(t,{fontSize:(t.size+0.5)+'px',color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'22px 0 10px'},[
   el('div',{display:'inline-flex',alignItems:'center',gap:'5px',background:t.accent,color:'#fff',borderRadius:'999px',padding:'3px 10px',fontSize:'9.5px',lineHeight:'1.4',fontWeight:'700',letterSpacing:'0.1em'},[deco('span',{},['PART']),el('span',{},[b.number])]),
   phrased(html(el('h3',{margin:'9px 0 0',fontSize:'19px',lineHeight:'1.5',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'})])},
  heading:b=>html(el('h4',{margin:'18px 0 8px',fontSize:'16.5px',lineHeight:'1.5',fontWeight:'800',color:t.ink}),b.html,t),
  label(b){const d=el('div',{margin:'16px 0 7px',display:'flex',alignItems:'center',gap:'7px',fontSize:'13.5px',lineHeight:'1.5',color:t.ink}),s=html(el('span',{}),b.html,t);d.append(deco('span',{width:'7px',height:'7px',borderRadius:'50%',background:t.accent,flexShrink:'0'}),s);return d},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:(t.size-1)+'px',lineHeight:'1.65',margin:'0 0 6px',padding:'8px 12px',background:t.soft,borderRadius:'10px'}));p.append(html(el('strong',{fontWeight:'700',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderRadius:'10px',overflow:'hidden',border:`1px solid ${t.rule}`,background:'#fff'},caption:{marginTop:'7px',fontSize:'10.5px',lineHeight:'1.6',color:t.muted,textAlign:'center',padding:'0 16px'}}),
  figureMargin:'14px -10px 16px',bleed:10,
  quote:b=>html(el('blockquote',{margin:'14px 0',padding:'10px 14px',background:t.soft,borderRadius:'10px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading(b){return el('header',{margin:'22px 0 12px'},[html(el('div',{display:'inline-block',background:t.accent,color:'#fff',borderRadius:'999px',padding:'4px 12px',fontSize:'13px',lineHeight:'1.4',fontWeight:'800',letterSpacing:'0.06em'}),b.html,t)])},
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontWeight:'800'},name:{color:t.ink,fontWeight:'700'},url:{color:t.muted}}),
  end:()=>deco('div',{textAlign:'center',margin:'18px 0 6px',fontSize:'9px',letterSpacing:'0.4em',color:t.accent,fontWeight:'700'},['— END —']),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',bottom:'12px',left:'24px',right:'24px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',fontSize:'8.5px',lineHeight:'12px',color:t.muted},[el('span',oneLine({maxWidth:'220px'}),[title]),el('span',{background:'#fff',color:t.ink,borderRadius:'999px',padding:'1px 8px',fontWeight:'700',fontSize:'9px'},[`${index} / ${total}`])]));
  },
  cover({title,image,sections,stats,width,height}){
   const [main,sub]=splitTitle(title);
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SANS,padding:'26px 24px 20px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',gap:'6px',flexWrap:'wrap'},['长文',`${stats.minutes} 分钟读完`,`${stats.figures} 张图解`].map(s=>el('span',{background:'#fff',borderRadius:'999px',padding:'3px 10px',fontSize:'9.5px',lineHeight:'1.4',color:t.muted},['# '+s]))));
   page.append(deco('h1',{margin:'18px 0 0',fontSize:'29px',lineHeight:'1.32',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[el('span',{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'},[main])]));
   if(sub)page.append(deco('div',{marginTop:'8px',fontSize:'15px',lineHeight:'1.5',color:t.muted,fontWeight:'600'},[sub]));
   if(image)page.append(el('div',{flex:'1 1 auto',minHeight:'80px',marginTop:'16px',display:'flex',alignItems:'center',justifyContent:'center'},[el('div',{background:'#fff',padding:'7px',borderRadius:'14px',boxShadow:'0 6px 18px rgba(80,50,20,0.10)',maxHeight:'100%',display:'flex'},[el('img',{display:'block',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',objectFit:'contain',borderRadius:'8px'},[],{src:image.src,alt:'','data-ref':image.ref,'data-cover-image':'true'})])]));
   else page.append(el('div',{flex:'1'}));
   if(sections.length)page.append(deco('div',{marginTop:'14px',background:'#fff',borderRadius:'14px',padding:'9px 14px'},sections.map((s,i)=>el('div',{display:'flex',alignItems:'center',gap:'9px',padding:'3px 0',borderTop:i?`1px dashed ${t.rule}`:'none',fontSize:'11px',lineHeight:'1.5'},[el('span',{width:'17px',height:'17px',borderRadius:'50%',background:i?t.soft:t.accent,color:i?t.accent:'#fff',fontSize:'9px',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:'0'},[String(Number(s.number)||i+1)]),el('span',oneLine({flex:'1',color:t.ink,fontWeight:'600'}),[headingText(s.html)]),el('span',{color:t.muted,fontSize:'9.5px'},[`P${s.page}`])]))));
   return page;
  },
 };
}

function refEntry(t,b,s){
 const row={display:'grid',gridTemplateColumns:'36px 1fr',columnGap:'0',margin:`0 0 ${t.refGap}px`,fontSize:t.refSize+'px',lineHeight:String(t.refLeading),color:t.body,textAlign:'left',...(s.row||{})};
 if(!b.number)return html(el('div',{...row,display:'block'}),b.html,t);
 const detail=el('div',{minWidth:'0'},[el('span',{...s.name},[b.name])]);
 if(b.url)detail.append(el('div',{fontFamily:SANS,fontSize:Math.max(8.5,t.refSize-1)+'px',lineHeight:'1.45',wordBreak:'break-all',marginTop:'1px',...s.url},[b.url]));
 return el('div',row,[el('span',{whiteSpace:'nowrap',letterSpacing:'-0.04em',...s.num},[b.number]),detail]);
}

const THEMES={folio,brief,note};
// Older templates (journal/lab/wechat/...) map onto the closest current theme.
const LEGACY={journal:'folio',essay:'folio',letter:'folio',lab:'brief',graphite:'brief',wechat:'note'};
export function themeFor(template,opts={}){const key=THEMES[template?.layout]?template.layout:LEGACY[template?.layout]||'folio';return THEMES[key](template||{},opts)}
export const THEME_LAYOUTS=Object.keys(THEMES);
