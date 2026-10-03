import DOMPurify from 'dompurify';
// Page themes for Xiaohongshu longform. All styling is inline so exported PNGs and the
// in-app HTML preview match regardless of surrounding app CSS. Elements marked
// data-deco carry no article text and are excluded from content verification.
// Sizes are CSS px on a 360px-wide page (exported at 3x, 1080px); every text size is
// derived from the body size so a template scales as a whole.
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
// Cover extras that are dropped (last first) when a short page ratio cannot fit them.
const optional=node=>{node.dataset.coverOptional='true';return node};
const CJK='\u2e80-\u9fff\u3000-\u303f\uff00-\uffef';
const CJK_SPACE=new RegExp(`(?<=[${CJK}]) +| +(?=[${CJK}])`,'g');
// A space between CJK and Latin text is set as a fixed quarter-em space, which justification
// never stretches. Same length, so text offsets used for splitting stay valid.
export function fixedSpaces(text){return text.replace(CJK_SPACE,m=>'\u2005'.repeat(m.length))}
function settle(node){const w=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(!n.parentElement?.closest('code,pre,a'))n.textContent=fixedSpaces(n.textContent);return node}
function html(node,value,t){node.innerHTML=DOMPurify.sanitize(value||'');styleInline(node,t);return settle(node)}
// Resets properties that the workbench's global CSS sets on bare elements.
function styleInline(node,t){
 for(const a of node.querySelectorAll('a'))Object.assign(a.style,{display:'inline',color:t.link,textDecoration:'none',wordBreak:'break-all',gap:'0'});
 for(const s of node.querySelectorAll('strong,b'))Object.assign(s.style,{fontWeight:'700',color:t.strong,...(t.strongStyle||{})});
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
const text=(t,extra={})=>({margin:`0 0 ${t.gap}px`,fontSize:t.size+'px',lineHeight:String(t.leading),color:t.body,textAlign:'justify',textWrap:'pretty',overflowWrap:'anywhere',lineBreak:'strict',...extra});
function oneLine(style={}){return {whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',...style}}
function headingText(value){const d=document.createElement('div');d.innerHTML=DOMPurify.sanitize(value||'');return d.textContent}
export function splitTitle(title){const m=String(title||'').match(/^(.{4,}?)[：:｜|—]+\s*(.{2,})$/);return m?[m[1].trim(),m[2].trim()]:[String(title||''),'']}
// compact>0 tightens only the reference list, used to avoid a near-empty final page.
// Palette tokens (edition data, usually the article's project colours) map onto theme colours.
const PALETTE_KEYS={paper:'paper',surface:'surface',ink:'ink',text:'body',muted:'muted',primary:'accent',on_primary:'onPrimary',accent:'accent2',rule:'rule'};
export function themeColors(base,template,palette){
 const out={...base};const own=hex(template?.accent);if(own&&own.toLowerCase()!=='#333333')out.accent=own;
 for(const source of [template?.palette,palette])if(source)for(const [key,name] of Object.entries(PALETTE_KEYS))if(hex(source[key]))out[name]=source[key];
 out.surface=out.surface||mix(out.accent,out.paper,0.9);out.onPrimary=out.onPrimary||'#ffffff';out.accent2=out.accent2||out.accent;
 return out;
}
function tokens(template,base,{compact=0,palette}={}){
 const colors=themeColors(base,template,palette);base={...base,...colors};const accent=colors.accent;
 const size=Number(template?.font_size)||base.size,leading=Number(template?.line_height)||base.leading;
 const refGap=Number(template?.reference_gap)||base.refGap;
 const px=k=>(Math.round(size*k*4)/4)+'px';
 return {...base,accent,size,leading,px,gap:Number(template?.paragraph_gap)||base.gap,refSize:Number(template?.reference_size)||base.refSize,refGap:Math.max(1,refGap-compact),refLeading:1.45-0.05*compact};
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
// One compact row per reference: number, name and full link inline.
function refEntry(t,b,s){
 const row={display:'grid',gridTemplateColumns:`${Math.round(t.refSize*3.3)}px 1fr`,columnGap:'0',margin:`0 0 ${t.refGap}px`,fontSize:t.refSize+'px',lineHeight:String(t.refLeading),color:t.body,textAlign:'left',textWrap:'pretty',...(s.row||{})};
 if(!b.number)return html(el('div',{...row,display:'block'}),b.html,t);
 const detail=el('div',{minWidth:'0'},[el('span',{marginRight:'5px',...s.name},[fixedSpaces(b.name)])]);
 if(b.url)detail.append(el('span',{fontFamily:SANS,fontSize:(t.refSize-0.5)+'px',wordBreak:'break-all',...s.url},[b.url]));
 return el('div',row,[el('span',{whiteSpace:'nowrap',letterSpacing:'-0.04em',...s.num},[b.number]),detail]);
}
// Cover key points in large type; the cover is read as a feed thumbnail, so it carries no figure.
function points(items,make){return items.slice(0,5).map((s,i)=>make(s,i,s.label))}

const FOLIO={id:'folio',accent:'#9e3b26',size:13,leading:1.72,gap:7,refSize:9,refGap:3,paper:'#f6f1e7',ink:'#211d18',body:'#2c2620',muted:'#83786a',rule:'#d8cdbb',pad:{top:40,right:26,bottom:34,left:26}};
const BRIEF={id:'brief',accent:'#2b59c3',size:13,leading:1.68,gap:7,refSize:9,refGap:3,paper:'#ffffff',ink:'#101b2a',body:'#29333f',muted:'#6a7584',rule:'#e1e6ee',pad:{top:40,right:26,bottom:32,left:26}};
const NOTE={id:'note',accent:'#e0533d',size:13,leading:1.72,gap:7,refSize:9,refGap:3,paper:'#f3eee6',ink:'#24211d',body:'#2f2b27',muted:'#8a8178',rule:'#ece6dc',pad:{top:30,right:26,bottom:38,left:26}};

function folio(template,opts){
 const t=tokens(template,FOLIO,opts);Object.assign(t,{strong:t.ink,link:t.accent,codeBg:'#ece4d6'});
 const {px}=t,line=t.size*t.leading;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead(b){const p=html(el('p',text(t,{color:t.ink,textAlign:'left'})),b.html,t);
   const first=p.firstChild;
   if(first?.nodeType===3&&first.textContent.trim()){const s=first.textContent.replace(/^\s+/,''),ch=[...s][0];first.textContent=s.slice(ch.length);
    p.prepend(el('span',{float:'left',fontSize:Math.round(line*1.7)+'px',lineHeight:Math.round(line*2)+'px',height:Math.round(line*2)+'px',margin:'1px 6px 0 0',color:t.accent,fontWeight:'700',fontFamily:SERIF},[ch]))}
   return p},
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px',paddingTop:'7px',borderTop:`1px solid ${t.ink}`,display:'flex',alignItems:'flex-start',gap:'10px'},[
   el('span',{fontFamily:SERIF,fontSize:px(2),lineHeight:'1',color:t.accent,fontWeight:'700',flexShrink:'0',marginTop:'1px'},[b.number]),
   phrased(html(el('h3',{margin:'0',flex:'1',fontFamily:SERIF,fontSize:px(1.27),lineHeight:'1.4',fontWeight:'700',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontFamily:SERIF,fontSize:px(1.12),lineHeight:'1.45',fontWeight:'700',color:t.ink}),b.html,t),
  label(b){const d=el('div',{margin:'10px 0 5px',display:'flex',alignItems:'center',gap:'7px',fontFamily:SANS,fontSize:px(0.85),lineHeight:'1.4',letterSpacing:'0.1em',color:t.accent}),s=html(el('span',{}),b.html,t);s.querySelectorAll('strong').forEach(x=>x.style.color=t.accent);d.append(deco('span',{width:'12px',height:'1px',background:t.accent}),s);return d},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.6',margin:'0 0 4px',padding:'0 0 0 10px',borderLeft:`2px solid ${t.rule}`}));const k=html(el('strong',{fontWeight:'700',color:t.ink}),b.key,t);p.append(k);p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{background:'#fff',padding:'4px',border:`1px solid ${t.rule}`},caption:{marginTop:'5px',padding:'0 14px',fontFamily:SANS,fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left'},tag:n=>deco('span',{color:t.accent,letterSpacing:'0.08em',marginRight:'5px',fontWeight:'600'},[`图 ${String(n).padStart(2,'0')}`])}),
  figureMargin:'8px -16px 10px',bleed:16,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'1px 0 1px 12px',borderLeft:`2px solid ${t.accent}`,color:t.muted,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'14px 0 8px'},[deco('div',{fontFamily:SANS,fontSize:'7.5px',letterSpacing:'0.3em',color:t.accent,marginBottom:'3px'},['REFERENCES']),html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.4',color:t.ink,fontWeight:'700',paddingBottom:'5px',borderBottom:`1px solid ${t.ink}`}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:SERIF,fontWeight:'700'},name:{color:t.ink,fontWeight:'600'},url:{color:t.muted}}),
  end:()=>deco('div',{display:'flex',justifyContent:'center',alignItems:'center',gap:'8px',margin:'12px 0 6px'},[el('span',{width:'20px',height:'1px',background:t.rule}),el('span',{width:'5px',height:'5px',background:t.accent,transform:'rotate(45deg)'}),el('span',{width:'20px',height:'1px',background:t.rule})]),
  frame(page,{index,total,section}){
   page.append(deco('div',{position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'12px',paddingBottom:'5px',borderBottom:`1px solid ${t.rule}`,fontSize:'7.5px',lineHeight:'11px',color:t.muted},[el('span',{fontFamily:SANS,letterSpacing:'0.24em',flexShrink:'0'},['LONG READ']),el('span',oneLine({fontFamily:SERIF,maxWidth:'220px',fontSize:'8px'}),[section?`${section.number}　${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',bottom:'13px',left:'0',right:'0',display:'flex',justifyContent:'center',alignItems:'center',gap:'7px',fontFamily:SERIF,fontSize:'8.5px',lineHeight:'11px',color:t.muted},[el('span',{width:'14px',height:'1px',background:t.rule}),el('span',{color:t.accent,fontWeight:'700'},[String(index).padStart(2,'0')]),el('span',{},[`/ ${String(total).padStart(2,'0')}`]),el('span',{width:'14px',height:'1px',background:t.rule})]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SERIF,padding:'26px 28px 24px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',alignItems:'baseline',fontFamily:SANS,fontSize:'9px',letterSpacing:'0.26em',color:t.ink,paddingBottom:'6px',borderBottom:`2px solid ${t.ink}`},[el('span',{},['LONG READ']),el('span',{letterSpacing:'0.1em',color:t.muted},['长文精读'])]));
   page.append(deco('div',{height:'1px',background:t.ink,marginTop:'2px'}));
   page.append(deco('div',{width:'34px',height:'4px',background:t.accent,marginTop:'24px'}));
   page.append(deco('h1',{margin:'14px 0 0',fontFamily:SERIF,fontSize:'38px',lineHeight:'1.22',fontWeight:'900',letterSpacing:'-0.01em',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'12px',fontFamily:SERIF,fontSize:'19px',lineHeight:'1.4',color:t.accent,fontWeight:'700',...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'16px'}));
   if(items.length)page.append(optional(deco('div',{},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'baseline',gap:'10px',padding:'5px 0',borderTop:`1px solid ${t.rule}`,fontSize:'14.5px',lineHeight:'1.35'},[el('span',{color:t.accent,fontWeight:'800',width:'22px',flexShrink:'0',fontSize:'14px'},[s.number]),el('span',{flex:'1',color:t.ink,fontWeight:'700'},[label])])))));
   page.append(deco('div',{marginTop:'12px',paddingTop:'8px',borderTop:`2px solid ${t.ink}`,fontFamily:SANS,fontSize:'10px',letterSpacing:'0.08em',color:t.muted},[`${stats.figures} 张图解 · ${stats.references} 条参考 · 约 ${stats.minutes} 分钟`]));
   return page;
  },
 };
}

function brief(template,opts){
 const t=tokens(template,BRIEF,opts);const tint=mix(t.accent,'#ffffff',0.9),deep=mix(t.accent,'#0b1220',0.78),light=mix(t.accent,'#ffffff',0.55);
 Object.assign(t,{strong:t.ink,link:t.accent,codeBg:'#eef1f6',tint,deep,light});
 const {px}=t;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,padding:'0 0 0 10px',borderLeft:`3px solid ${t.accent}`})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'12px 0 7px'},[
   el('div',{display:'flex',alignItems:'center',gap:'6px',fontFamily:MONO,fontSize:'8px',lineHeight:'1.4',letterSpacing:'0.14em',color:t.accent,fontWeight:'700'},[deco('span',{},['SECTION']),el('span',{},[b.number]),deco('span',{flex:'1',height:'1px',background:t.rule,marginLeft:'6px'})]),
   phrased(html(el('h3',{margin:'5px 0 0',fontFamily:SANS,fontSize:px(1.25),lineHeight:'1.38',fontWeight:'700',color:t.ink,textAlign:'left',...BALANCE}),b.html,t)),
   deco('div',{width:'22px',height:'3px',background:t.accent,marginTop:'6px'})])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.1),lineHeight:'1.45',fontWeight:'700',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',{display:'inline-block',background:tint,color:t.accent,fontSize:px(0.85),lineHeight:'1.5',padding:'1px 8px',borderRadius:'3px',letterSpacing:'0.06em'}),b.html,t);s.querySelectorAll('strong').forEach(x=>x.style.color=t.accent);return el('div',{margin:'10px 0 5px'},[s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 8px',background:'#f5f7fa',borderRadius:'4px'}));p.append(html(el('strong',{fontWeight:'700',color:t.deep}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,borderRadius:'6px',overflow:'hidden',background:'#fff'},caption:{marginTop:'5px',padding:'0 12px',fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left'},tag:n=>deco('span',{fontFamily:MONO,fontSize:'7.5px',fontWeight:'700',color:t.accent,background:tint,padding:'1px 4px',borderRadius:'2px',marginRight:'6px',letterSpacing:'0.06em'},[`FIG ${String(n).padStart(2,'0')}`])}),
  figureMargin:'8px -16px 10px',bleed:16,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'6px 10px',background:tint,borderLeft:`3px solid ${t.accent}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'10px 0 6px'},[el('div',{display:'flex',alignItems:'center',gap:'6px',fontFamily:MONO,fontSize:'8px',letterSpacing:'0.14em',color:t.accent,fontWeight:'700'},[deco('span',{},['APPENDIX']),deco('span',{flex:'1',height:'1px',background:t.rule,marginLeft:'6px'})]),html(el('h3',{margin:'4px 0 0',fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'700',paddingBottom:'4px',borderBottom:`2px solid ${t.accent}`}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:MONO,fontWeight:'700',fontSize:'0.92em'},name:{color:t.ink,fontWeight:'600'},url:{color:t.accent,opacity:'0.85'},row:{padding:'0 0 1px',borderBottom:`1px solid ${t.rule}`}}),
  end:()=>deco('div',{display:'flex',alignItems:'center',gap:'8px',margin:'12px 0 6px',fontFamily:MONO,fontSize:'7.5px',letterSpacing:'0.3em',color:t.muted},[el('span',{flex:'1',height:'1px',background:t.rule}),el('span',{},['END']),el('span',{flex:'1',height:'1px',background:t.rule})]),
  frame(page,{index,total,section,sectionIndex,sectionCount,title}){
   if(sectionCount)page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',gap:'3px'},Array.from({length:sectionCount},(_,i)=>el('span',{flex:'1',height:'3px',borderRadius:'2px',background:i<=sectionIndex?t.accent:t.rule}))));
   page.append(deco('div',oneLine({position:'absolute',top:'22px',left:t.pad.left+'px',right:t.pad.right+'px',fontSize:'8px',lineHeight:'11px',color:t.muted}),[section?`§ ${section.number}　${headingText(section.html)}`:'']));
   page.append(deco('div',{position:'absolute',bottom:'12px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',fontSize:'7.5px',lineHeight:'11px',color:t.muted},[el('span',oneLine({maxWidth:'230px'}),[title]),el('span',{fontFamily:MONO,color:t.ink,fontWeight:'700',fontSize:'8.5px'},[`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`])]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const grid='rgba(255,255,255,0.06)';
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:deep,backgroundImage:`linear-gradient(${grid} 1px,transparent 1px),linear-gradient(90deg,${grid} 1px,transparent 1px)`,backgroundSize:'24px 24px',color:'#fff',fontFamily:SANS,padding:'26px 26px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontFamily:MONO,fontSize:'9px',letterSpacing:'0.18em',color:light},[el('span',{},['RESEARCH BRIEF']),el('span',{color:'rgba(255,255,255,0.55)'},[`${stats.minutes} MIN READ`])]));
   page.append(deco('div',{width:'34px',height:'4px',background:t.accent,marginTop:'34px'}));
   page.append(deco('h1',{margin:'16px 0 0',fontSize:'36px',lineHeight:'1.24',fontWeight:'900',color:'#fff',letterSpacing:'-0.005em',textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'12px',fontSize:'18px',lineHeight:'1.4',color:light,fontWeight:'700',...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'16px'}));
   if(items.length)page.append(optional(deco('div',{},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'baseline',gap:'10px',padding:'6px 0',borderTop:'1px solid rgba(255,255,255,0.14)',fontSize:'14.5px',lineHeight:'1.35'},[el('span',{fontFamily:MONO,color:light,fontWeight:'700',fontSize:'12px',width:'20px',flexShrink:'0'},[s.number]),el('span',{flex:'1',color:'#fff',fontWeight:'600'},[label])])))));
   page.append(optional(deco('div',{display:'flex',marginTop:'12px',gap:'10px'},[[stats.figures,'张图解'],[stats.references,'条参考'],[stats.minutes,'分钟读完']].map(([n,l])=>el('div',{flex:'1',borderTop:`2px solid ${t.accent}`,paddingTop:'5px'},[el('div',{fontFamily:MONO,fontSize:'20px',lineHeight:'1.2',fontWeight:'700',color:'#fff'},[String(n)]),el('div',{fontSize:'9.5px',color:'rgba(255,255,255,0.65)',marginTop:'1px'},[l])])))));
   return page;
  },
 };
}

function note(template,opts){
 const t=tokens(template,NOTE,opts);const tint=mix(t.accent,'#ffffff',0.8),soft=mix(t.accent,'#ffffff',0.93);
 Object.assign(t,{strong:t.ink,link:mix(t.accent,'#000000',0.15),codeBg:'#f4efe8',tint,soft});
 const {px}=t,mark=`linear-gradient(transparent 62%,${tint} 62%,${tint} 92%,transparent 92%)`;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  sheet:{position:'absolute',top:'10px',left:'10px',right:'10px',bottom:'28px',background:'#fff',borderRadius:'14px',boxShadow:'0 1px 2px rgba(60,40,20,0.06)'},
  lead:b=>html(el('p',text(t,{color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'12px 0 7px'},[
   el('div',{display:'inline-flex',alignItems:'center',gap:'4px',background:t.accent,color:'#fff',borderRadius:'999px',padding:'2px 9px',fontSize:'8px',lineHeight:'1.4',fontWeight:'700',letterSpacing:'0.1em'},[deco('span',{},['PART']),el('span',{},[b.number])]),
   phrased(html(el('h3',{margin:'6px 0 0',fontSize:px(1.27),lineHeight:'1.42',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'})])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.1),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label(b){const d=el('div',{margin:'10px 0 5px',display:'flex',alignItems:'center',gap:'6px',fontSize:px(0.96),lineHeight:'1.45',color:t.ink}),s=html(el('span',{}),b.html,t);d.append(deco('span',{width:'6px',height:'6px',borderRadius:'50%',background:t.accent,flexShrink:'0'}),s);return d},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 9px',background:t.soft,borderRadius:'8px'}));p.append(html(el('strong',{fontWeight:'700',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderRadius:'8px',overflow:'hidden',border:`1px solid ${t.rule}`,background:'#fff'},caption:{marginTop:'5px',fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'center',padding:'0 14px'}}),
  figureMargin:'8px -12px 10px',bleed:12,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 11px',background:t.soft,borderRadius:'8px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading(b){return el('header',{margin:'12px 0 8px'},[html(el('div',{display:'inline-block',background:t.accent,color:'#fff',borderRadius:'999px',padding:'3px 11px',fontSize:px(0.92),lineHeight:'1.4',fontWeight:'800',letterSpacing:'0.06em'}),b.html,t)])},
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontWeight:'800'},name:{color:t.ink,fontWeight:'700'},url:{color:t.muted}}),
  end:()=>deco('div',{textAlign:'center',margin:'12px 0 6px',fontSize:'8px',letterSpacing:'0.4em',color:t.accent,fontWeight:'700'},['— END —']),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',bottom:'9px',left:'22px',right:'22px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',fontSize:'7.5px',lineHeight:'11px',color:t.muted},[el('span',oneLine({maxWidth:'220px'}),[title]),el('span',{background:'#fff',color:t.ink,borderRadius:'999px',padding:'0 7px',fontWeight:'700',fontSize:'8px'},[`${index} / ${total}`])]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SANS,padding:'28px 26px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',gap:'6px',flexWrap:'wrap'},['长文',`${stats.minutes} 分钟读完`,`${stats.figures} 张图解`].map(s=>el('span',{background:'#fff',borderRadius:'999px',padding:'4px 11px',fontSize:'11px',lineHeight:'1.4',color:t.muted,fontWeight:'600'},['# '+s]))));
   page.append(deco('h1',{margin:'30px 0 0',fontSize:'38px',lineHeight:'1.3',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[el('span',{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'},[main])]));
   if(sub)page.append(deco('div',{marginTop:'12px',fontSize:'18px',lineHeight:'1.45',color:t.muted,fontWeight:'700',...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'16px'}));
   if(items.length)page.append(optional(deco('div',{background:'#fff',borderRadius:'14px',padding:'10px 14px'},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'center',gap:'10px',padding:'5px 0',borderTop:i?`1px dashed ${t.rule}`:'none',fontSize:'14.5px',lineHeight:'1.35'},[el('span',{width:'20px',height:'20px',borderRadius:'50%',background:i?t.soft:t.accent,color:i?t.accent:'#fff',fontSize:'11px',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:'0'},[String(Number(s.number)||i+1)]),el('span',{flex:'1',color:t.ink,fontWeight:'700'},[label])])))));
   return page;
  },
 };
}

const ICON={
 figure:'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4',
 link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
 clock:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3 2',
 badge:'M12 2l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.9 1 2.8-2.5 1.8-.9 2.8-3-.2L12 22l-2.4-1.8-3 .2-.9-2.8-2.5-1.8 1-2.8-1-2.9 2.5-1.7.9-2.8 3 .2z',
};
function icon(name,size,color,{fill=false}={}){const s=deco('span',{display:'inline-flex',width:size+'px',height:size+'px',color,flexShrink:'0'});s.innerHTML=`<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${ICON[name]}" fill="${fill?'currentColor':'none'}" stroke="currentColor" stroke-width="${fill?0:1.8}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;return s}
const smallCaps=(t,extra={})=>({fontFamily:MONO,fontSize:'7.5px',lineHeight:'1.3',letterSpacing:'0.22em',textTransform:'uppercase',color:t.muted,...extra});

// Technical explainer on dot-grid paper: cobalt blocks, dashed frames, mono small-caps labels.
const BLUEPRINT={id:'blueprint',accent:'#1a3ba8',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#f4f3ef',surface:'#e8edf8',ink:'#111111',body:'#2c2c2c',muted:'#85847f',rule:'#b9c3d9',pad:{top:40,right:26,bottom:34,left:26}};
function blueprint(template,opts){
 const t=tokens(template,BLUEPRINT,opts);Object.assign(t,{strong:t.ink,link:t.accent,codeBg:t.surface});
 const {px}=t,dash=`1px dashed ${t.rule}`,dots=`radial-gradient(${mix(t.rule,t.paper,0.25)} 0.7px,transparent 0.8px)`;
 const paper={background:t.paper,backgroundImage:dots,backgroundSize:'12px 12px',backgroundPosition:'6px 6px'};
 return {...t,
  shell:{...paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,padding:'7px 10px',border:dash,background:mix(t.paper,'#ffffff',0.6)})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px'},[
   el('div',{display:'flex',alignItems:'center',gap:'6px'},[deco('span',smallCaps(t),['Section']),el('span',{fontFamily:MONO,fontSize:'8px',fontWeight:'700',lineHeight:'1',color:t.onPrimary,background:t.accent,padding:'3px 5px'},[b.number]),deco('span',{flex:'1',borderTop:dash})]),
   phrased(html(el('h3',{margin:'7px 0 0',fontFamily:SERIF,fontSize:px(1.3),lineHeight:'1.38',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.08),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',{display:'inline-block',background:t.accent,color:t.onPrimary,fontSize:px(0.82),lineHeight:'1.5',padding:'1px 7px',fontWeight:'700'}),b.html,t);s.querySelectorAll('strong').forEach(x=>x.style.color=t.onPrimary);return el('div',{margin:'10px 0 5px'},[s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 8px',border:dash,background:mix(t.paper,'#ffffff',0.6)}));p.append(html(el('strong',{fontWeight:'800',color:t.accent}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{background:'#ffffff',padding:'5px',border:dash},caption:{marginTop:'5px',padding:'0 14px',fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left'},tag:n=>deco('span',smallCaps(t,{fontSize:'7px',color:t.accent,fontWeight:'700',marginRight:'6px'}),[`Fig.${String(n).padStart(2,'0')}`])}),
  figureMargin:'8px -16px 10px',bleed:16,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 10px',background:t.surface,borderLeft:`3px solid ${t.accent}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 7px'},[el('div',{display:'flex',alignItems:'center',gap:'6px'},[deco('span',smallCaps(t),['References']),deco('span',{flex:'1',borderTop:dash})]),html(el('h3',{margin:'5px 0 0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'900'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:MONO,fontWeight:'700',fontSize:'0.9em'},name:{color:t.ink,fontWeight:'700'},url:{color:t.muted},row:{padding:'0 0 1px',borderBottom:dash}}),
  end:()=>deco('div',{display:'flex',alignItems:'center',gap:'8px',margin:'12px 0 6px'},[el('span',{flex:'1',borderTop:dash}),el('span',{width:'6px',height:'6px',background:t.accent}),el('span',{flex:'1',borderTop:dash})]),
  frame(page,{index,total,section}){
   page.append(deco('div',{position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',paddingBottom:'5px',borderBottom:dash},[el('span',smallCaps(t),['Long read']),el('span',oneLine({...smallCaps(t,{letterSpacing:'0.06em',textTransform:'none'}),maxWidth:'220px',fontFamily:SANS,fontSize:'8px'}),[section?`${section.number} · ${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',bottom:'12px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'center'},[el('span',{width:'8px',height:'8px',background:t.accent}),el('span',{fontFamily:MONO,fontSize:'8.5px',color:t.ink,fontWeight:'700',letterSpacing:'0.08em'},[`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`])]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',...paper,color:t.ink,fontFamily:SANS,padding:'26px 26px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',paddingBottom:'6px',borderBottom:dash},[el('span',smallCaps(t,{fontSize:'9px'}),['Long read']),el('span',smallCaps(t,{fontSize:'9px'}),[`${stats.minutes} min`])]));
   page.append(deco('h1',{margin:'30px 0 0',fontFamily:SERIF,fontSize:'40px',lineHeight:'1.2',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'14px',alignSelf:'flex-start',background:t.accent,color:t.onPrimary,fontSize:'17px',lineHeight:'1.4',fontWeight:'800',padding:'7px 12px',...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   if(items.length)page.append(optional(deco('div',{display:'flex',flexDirection:'column',gap:'5px'},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'center',gap:'10px',padding:'6px 10px',border:dash,background:i?mix(t.paper,'#ffffff',0.6):t.surface},[el('span',smallCaps(t,{fontSize:'10px',color:t.accent,fontWeight:'700',letterSpacing:'0.08em',width:'18px',flexShrink:'0'}),[s.number]),el('span',{flex:'1',fontSize:'14.5px',lineHeight:'1.3',fontWeight:'800',color:t.ink},[label])])))));
   page.append(deco('div',{marginTop:'12px',display:'flex',gap:'14px'},[[stats.figures,'figures'],[stats.references,'references']].map(([n,l])=>el('span',smallCaps(t,{fontSize:'8.5px'}),[`${n} ${l}`]))));
   return page;
  },
 };
}

// X post style: big headline over an embedded post card, then plain dense text pages.
const TWEET={id:'tweet',accent:'#1d9bf0',size:13,leading:1.68,gap:7,refSize:9,refGap:3,paper:'#ffffff',ink:'#0f1419',body:'#1f2328',muted:'#536471',rule:'#e1e8ed',pad:{top:42,right:24,bottom:34,left:24}};
function tweet(template,opts){
 const t=tokens(template,TWEET,opts);Object.assign(t,{strong:t.ink,link:t.accent,codeBg:'#f2f4f5'});
 const {px}=t,card=`1px solid ${mix(t.rule,t.ink,0.08)}`;
 const avatar=(title,size)=>deco('span',{width:size+'px',height:size+'px',borderRadius:'50%',background:t.accent,color:t.onPrimary,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:Math.round(size*0.45)+'px',flexShrink:'0'},[[...String(title||'长')][0]]);
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.04)})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 7px',paddingTop:'8px',borderTop:`1px solid ${t.rule}`},[
   el('div',{marginBottom:'2px',fontSize:'8.5px',lineHeight:'1.4',color:t.muted,fontWeight:'700'},[el('span',{color:t.accent},[b.number]),deco('span',{},[' · 线程'])]),
   phrased(html(el('h3',{margin:'0',fontSize:px(1.27),lineHeight:'1.38',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.08),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',{color:t.ink,fontWeight:'800',fontSize:px(1)}),b.html,t);return el('div',{margin:'10px 0 4px',display:'flex',alignItems:'center',gap:'6px'},[deco('span',{width:'3px',alignSelf:'stretch',background:t.accent,borderRadius:'2px'}),s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 9px',border:card,borderRadius:'9px'}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:card,borderRadius:'12px',overflow:'hidden',background:'#fff'},caption:{marginTop:'5px',padding:'0 6px',fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left'}}),
  figureMargin:'8px -10px 10px',bleed:10,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 11px',border:card,borderRadius:'12px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 7px',paddingTop:'8px',borderTop:`1px solid ${t.rule}`},[html(el('h3',{margin:'0',fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'800'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.muted,fontWeight:'700'},name:{color:t.ink,fontWeight:'700'},url:{color:t.accent}}),
  end:()=>deco('div',{display:'flex',justifyContent:'center',margin:'12px 0 6px'},[el('span',{width:'4px',height:'4px',borderRadius:'50%',background:t.muted,boxShadow:`10px 0 0 ${t.muted},-10px 0 0 ${t.muted}`})]),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',top:'13px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',alignItems:'center',gap:'6px',fontSize:'8.5px',lineHeight:'1.2'},[avatar(title,18),el('span',oneLine({fontWeight:'800',color:t.ink,maxWidth:'200px'}),[splitTitle(title)[0]]),icon('badge',9,t.accent,{fill:true}),el('span',{color:t.muted,marginLeft:'auto'},[`${index}/${total}`])]));
   page.append(deco('div',{position:'absolute',bottom:'14px',left:t.pad.left+'px',right:t.pad.right+'px',height:'1px',background:t.rule}));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SANS,padding:'30px 24px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('h1',{margin:'0',fontSize:'38px',lineHeight:'1.22',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]));
   page.append(deco('div',{height:'1px',background:t.rule,margin:'16px 0 0'}));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   const body=[];
   if(sub)body.push(el('div',{fontSize:'17px',lineHeight:'1.45',fontWeight:'700',color:t.ink,...BALANCE},[sub]));
   if(items.length)body.push(optional(el('div',{marginTop:'8px'},points(items,(s,i,label)=>el('div',{fontSize:'14px',lineHeight:'1.5',color:t.body,padding:'1px 0'},[el('span',{color:t.muted,marginRight:'6px'},[`${i+1}/`]),label])))));
   page.append(deco('div',{border:card,borderRadius:'16px',padding:'12px 14px',display:'flex',flexDirection:'column',gap:'8px',background:'#fff'},[
    el('div',{display:'flex',alignItems:'center',gap:'8px'},[avatar(main,30),el('div',{display:'flex',flexDirection:'column'},[el('span',{display:'flex',alignItems:'center',gap:'3px',fontWeight:'800',fontSize:'13px',color:t.ink},['长文笔记',icon('badge',12,t.accent,{fill:true})]),el('span',{fontSize:'11px',color:t.muted},[`线程 · ${stats.minutes} 分钟读完`])])]),
    ...body,
    el('div',{display:'flex',gap:'16px',paddingTop:'8px',borderTop:`1px solid ${t.rule}`,fontSize:'11px',color:t.muted},[[ 'figure',stats.figures,'图'],['link',stats.references,'参考'],['clock',stats.minutes,'分钟']].map(([k,n,l])=>el('span',{display:'inline-flex',alignItems:'center',gap:'4px'},[icon(k,13,t.muted),`${n} ${l}`])))]));
   page.append(el('div',{flex:'1.4',minHeight:'14px'}));
   page.append(deco('div',{height:'1px',background:t.rule}));
   return page;
  },
 };
}

// Newspaper long-form: black on white, serif text, heavy rules, dense columns of type.
const PRESS={id:'press',accent:'#b3261e',size:12.5,leading:1.66,gap:6,refSize:8.5,refGap:2,paper:'#fdfcf9',ink:'#111111',body:'#1c1c1c',muted:'#6b6b6b',rule:'#d9d6cf',pad:{top:42,right:24,bottom:32,left:24}};
function press(template,opts){
 const t=tokens(template,PRESS,opts);Object.assign(t,{strong:t.ink,link:t.ink,codeBg:'#efede7'});
 const {px}=t,line=t.size*t.leading;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead(b){const p=html(el('p',text(t,{color:t.ink,fontWeight:'600'})),b.html,t);const first=p.firstChild;
   if(first?.nodeType===3&&first.textContent.trim()){const s=first.textContent.replace(/^\s+/,''),ch=[...s][0];first.textContent=s.slice(ch.length);
    p.prepend(el('span',{float:'left',fontSize:Math.round(line*2.2)+'px',lineHeight:Math.round(line*2)+'px',height:Math.round(line*2)+'px',margin:'2px 6px 0 0',color:t.ink,fontWeight:'900',fontFamily:SERIF},[ch]))}
   return p},
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'12px 0 7px',borderTop:`2.5px solid ${t.ink}`,paddingTop:'6px'},[
   el('div',{fontFamily:SANS,fontSize:'8px',lineHeight:'1.3',fontWeight:'800',letterSpacing:'0.2em',color:t.accent},[b.number]),
   phrased(html(el('h3',{margin:'3px 0 0',fontFamily:SERIF,fontSize:px(1.36),lineHeight:'1.3',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t)),
   deco('div',{height:'1px',background:t.ink,marginTop:'6px'})])},
  heading:b=>html(el('h4',{margin:'11px 0 5px',fontFamily:SERIF,fontSize:px(1.1),lineHeight:'1.4',fontWeight:'900',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'9px 0 4px',fontFamily:SANS,fontSize:px(0.82),lineHeight:'1.4',fontWeight:'800',letterSpacing:'0.12em',color:t.accent}),b.html,t),
  pair(b){const p=el('p',text(t,{fontSize:px(0.96),lineHeight:'1.55',margin:'0 0 3px',paddingBottom:'3px',borderBottom:`1px solid ${t.rule}`}));p.append(html(el('strong',{fontWeight:'900',color:t.ink,fontFamily:SANS}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,padding:'5px 0',background:t.paper},caption:{marginTop:'4px',padding:'0 10px',fontFamily:SANS,fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left'},tag:n=>deco('span',{fontWeight:'800',color:t.ink,marginRight:'5px'},[`图${n}`])}),
  figureMargin:'8px -10px 10px',bleed:10,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'6px 0',borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,color:t.ink,fontSize:px(1.08),lineHeight:'1.55',fontWeight:'700',textAlign:'center'}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 6px',borderTop:`2.5px solid ${t.ink}`,paddingTop:'5px'},[html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'900'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent,fontFamily:SANS,fontWeight:'800',fontSize:'0.9em'},name:{color:t.ink,fontWeight:'700'},url:{color:t.muted}}),
  end:()=>deco('div',{textAlign:'right',margin:'4px 0 6px'},[el('span',{display:'inline-block',width:'7px',height:'7px',background:t.ink})]),
  frame(page,{index,total,section,title}){
   page.append(deco('div',{position:'absolute',top:'13px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'10px',paddingBottom:'4px',borderBottom:`1px solid ${t.ink}`,boxShadow:`0 2px 0 ${t.paper},0 3px 0 ${t.ink}`,fontFamily:SANS,fontSize:'7.5px',lineHeight:'11px',color:t.ink},[el('span',oneLine({fontWeight:'800',letterSpacing:'0.12em',maxWidth:'170px'}),[splitTitle(title)[0]]),el('span',oneLine({color:t.muted,maxWidth:'150px'}),[section?`${section.number}　${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',bottom:'11px',left:'0',right:'0',textAlign:'center',fontFamily:SERIF,fontSize:'8.5px',lineHeight:'11px',color:t.ink},[`— ${index} —`]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SERIF,padding:'22px 24px 20px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{textAlign:'center',fontFamily:SERIF,fontSize:'24px',lineHeight:'1.2',fontWeight:'900',letterSpacing:'0.3em',paddingBottom:'6px'},['长文周刊']));
   page.append(deco('div',{borderTop:`3px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,height:'2px'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontFamily:SANS,fontSize:'9px',padding:'4px 0',borderBottom:`1px solid ${t.ink}`,color:t.ink},[el('span',{},['LONG READ']),el('span',{},[`${stats.figures} 图 · ${stats.references} 参考 · ${stats.minutes} 分钟`])]));
   page.append(deco('h1',{margin:'22px 0 0',fontFamily:SERIF,fontSize:'40px',lineHeight:'1.18',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'10px',fontFamily:SERIF,fontSize:'18px',lineHeight:'1.4',fontWeight:'700',color:t.accent,...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   if(items.length)page.append(optional(deco('div',{borderTop:`2.5px solid ${t.ink}`,paddingTop:'4px'},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'baseline',gap:'9px',padding:'5px 0',borderBottom:`1px solid ${t.rule}`},[el('span',{fontFamily:SANS,fontSize:'10px',fontWeight:'800',color:t.accent,width:'18px',flexShrink:'0'},[s.number]),el('span',{flex:'1',fontSize:'14.5px',lineHeight:'1.35',fontWeight:'800'},[label])])))));
   return page;
  },
 };
}

// Highlighter explainer: off-white paper, huge black type, one bright marker colour.
const MARKER={id:'marker',accent:'#ffd100',onPrimary:'#111111',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#faf9f6',ink:'#111111',body:'#242424',muted:'#7a7873',rule:'#e6e3dc',pad:{top:40,right:26,bottom:34,left:26}};
function marker(template,opts){
 const t=tokens(template,MARKER,opts);
 // A dark primary (a brand blue) is too heavy as a highlighter, so the stroke is lightened.
 const dark=contrastRatio(t.accent,'#111111')<7,stroke=dark?mix(t.accent,t.paper,0.72):t.accent,mark=`linear-gradient(transparent 58%,${stroke} 58%,${stroke} 92%,transparent 92%)`;
 Object.assign(t,{strong:t.ink,link:t.ink,codeBg:mix(stroke,t.paper,0.5),strongStyle:{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'}});
 const {px}=t,block={background:dark?t.accent:t.ink,color:dark?t.onPrimary:'#ffffff'};
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.04),fontWeight:'600'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px'},[
   el('div',{display:'inline-flex',alignItems:'center',gap:'4px',background:stroke,color:t.ink,padding:'2px 8px',fontSize:'8.5px',lineHeight:'1.4',fontWeight:'900',letterSpacing:'0.06em'},[deco('span',{},['Part']),el('span',{},[b.number])]),
   phrased(html(el('h3',{margin:'6px 0 0',fontSize:px(1.36),lineHeight:'1.35',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.1),lineHeight:'1.45',fontWeight:'900',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',{display:'inline-block',...block,fontSize:px(0.86),lineHeight:'1.5',padding:'1px 7px',fontWeight:'800'}),b.html,t);s.querySelectorAll('strong').forEach(x=>Object.assign(x.style,{color:block.color,backgroundImage:'none'}));return el('div',{margin:'10px 0 5px'},[s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 8px',background:'#ffffff',borderLeft:`3px solid ${stroke}`}));p.append(html(el('strong',{fontWeight:'900',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{background:'#fff',border:`1px solid ${t.rule}`,borderRadius:'6px',overflow:'hidden'},caption:{marginTop:'5px',padding:'0 12px',fontSize:px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'center'}}),
  figureMargin:'8px -16px 10px',bleed:16,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 11px',background:mix(stroke,t.paper,0.6),color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading),fontWeight:'600'}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 7px'},[html(el('h3',{display:'inline',margin:'0',fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'900',backgroundImage:mark}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.ink,fontWeight:'900'},name:{color:t.ink,fontWeight:'700'},url:{color:t.muted}}),
  end:()=>deco('div',{textAlign:'center',margin:'12px 0 6px'},[el('span',{display:'inline-block',width:'28px',height:'5px',background:stroke})]),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',alignItems:'center',gap:'6px',fontSize:'8px',lineHeight:'11px',color:t.ink,fontWeight:'800'},[el('span',{width:'7px',height:'7px',background:t.ink}),el('span',oneLine({maxWidth:'240px'}),[splitTitle(title)[0]])]));
   page.append(deco('div',{position:'absolute',bottom:'12px',right:t.pad.right+'px',background:stroke,color:t.ink,fontSize:'8.5px',fontWeight:'900',lineHeight:'1',padding:'3px 7px'},[`${String(index).padStart(2,'0')}/${String(total).padStart(2,'0')}`]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,fontFamily:SANS,padding:'30px 26px 22px',display:'flex',flexDirection:'column'},[],{'data-cover':'true'});
   page.append(deco('div',{display:'flex',gap:'6px'},[`${stats.minutes} 分钟读完`,`${stats.figures} 张图解`].map(s=>el('span',{fontSize:'10.5px',fontWeight:'800',padding:'3px 8px',border:`1.5px solid ${t.ink}`,lineHeight:'1.3'},[s]))));
   page.append(deco('h1',{margin:'26px 0 0',fontSize:'42px',lineHeight:'1.24',fontWeight:'900',color:t.ink,textAlign:'left',letterSpacing:'-0.01em',...BALANCE},[el('span',{backgroundImage:mark,boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'},[main])]));
   if(sub)page.append(deco('div',{marginTop:'14px',fontSize:'19px',lineHeight:'1.4',fontWeight:'800',color:t.ink,...BALANCE},[sub]));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   if(items.length)page.append(optional(deco('div',{display:'flex',flexDirection:'column',gap:'6px'},points(items,(s,i,label)=>el('div',{display:'flex',alignItems:'center',gap:'10px'},[el('span',{...(i?{background:'#ffffff',color:t.ink,border:`1.5px solid ${t.ink}`}:{...block,border:`1.5px solid ${block.background}`}),width:'22px',height:'22px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'900',flexShrink:'0',boxSizing:'border-box'},[String(i+1)]),el('span',{flex:'1',fontSize:'15px',lineHeight:'1.3',fontWeight:'800'},[label])])))));
   return page;
  },
 };
}
function contrastRatio(a,b){const l=c=>{const v=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4);return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]};const [x,y]=[l(a),l(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)}

const THEMES={folio,brief,note,blueprint,tweet,press,marker};
// Older templates (journal/lab/wechat/...) map onto the closest current theme.
const LEGACY={journal:'folio',essay:'folio',letter:'folio',lab:'brief',graphite:'brief',wechat:'note'};
export function themeFor(template,opts={}){const key=THEMES[template?.layout]?template.layout:LEGACY[template?.layout]||'folio';return THEMES[key](template||{},opts)}
export const THEME_LAYOUTS=Object.keys(THEMES);
