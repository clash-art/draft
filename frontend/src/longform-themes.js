import DOMPurify from 'dompurify';
// Page themes for Xiaohongshu longform. All styling is inline so exported PNGs and the
// in-app HTML preview match regardless of surrounding app CSS. Elements marked
// data-deco carry no article text and are excluded from content verification.
// Sizes are CSS px on a 360px-wide page (exported at 3x, 1080px); every text size is
// derived from the body size so a template scales as a whole.
// Colour is soft and low-saturation: each theme has its own paper and one muted (Morandi)
// accent, used only for numbers, small labels, thin rules and links. An edition palette may
// override these tokens; emphasis otherwise comes from weight, size, rules and underlines.
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
 for(const a of node.querySelectorAll('a'))Object.assign(a.style,{display:'inline',color:t.ink,textDecoration:'underline',textDecorationColor:t.accent,textDecorationThickness:'1px',textUnderlineOffset:'2px',wordBreak:'break-all',gap:'0'});
 for(const s of node.querySelectorAll('strong,b'))Object.assign(s.style,{fontWeight:'700',color:t.ink,...(t.strongStyle||{})});
 for(const c of node.querySelectorAll('code'))Object.assign(c.style,{fontFamily:MONO,fontSize:'0.86em',background:t.surface,padding:'0 3px',wordBreak:'break-all'});
 for(const e of node.querySelectorAll('em,i'))Object.assign(e.style,{fontStyle:'normal',color:t.ink,textDecoration:'underline',textUnderlineOffset:'2px'});
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

const DEFAULTS={paper:'#ffffff',surface:'#f3f3f2',ink:'#1c1c1c',body:'#2a2a2a',muted:'#727272',rule:'#d6d6d3',accent:'#7a7a7a',onPrimary:'#ffffff'};
// Optional palette override from edition data; the theme's own muted tokens are the default.
const PALETTE_KEYS={paper:'paper',surface:'surface',ink:'ink',text:'body',muted:'muted',primary:'accent',on_primary:'onPrimary',accent:'accent2',rule:'rule'};
export function themeColors(base,template,palette){
 const out={...DEFAULTS,...base};
 if(hex(template?.accent)&&template.accent.toLowerCase()!=='#333333')out.accent=template.accent;
 for(const source of [template?.palette,palette])if(source)for(const [key,name] of Object.entries(PALETTE_KEYS))if(hex(source[key]))out[name]=source[key];
 out.accent2=out.accent2||out.accent;
 return out;
}
// compact>0 tightens only the reference list, used to avoid a near-empty final page.
function tokens(template,base,{compact=0,palette}={}){
 const colors=themeColors(base,template,palette);base={...base,...colors};
 const size=Number(template?.font_size)||base.size,leading=Number(template?.line_height)||base.leading;
 const refGap=Number(template?.reference_gap)||base.refGap;
 const px=k=>(Math.round(size*k*4)/4)+'px';
 const figureTone=['original','muted','duotone'].includes(template?.figure_tone)?template.figure_tone:'muted';
 return {...base,size,leading,px,figureTone,gap:Number(template?.paragraph_gap)||base.gap,refSize:Number(template?.reference_size)||base.refSize,refGap:Math.max(1,refGap-compact),refLeading:1.45-0.05*compact};
}
// Shared figure builder. A full-bleed plate drops the frame and runs edge to edge; its
// caption returns to the text column.
function figure(t,b,image,n,{frame={},img={},caption={},tag}={}){
 const picture=el('img',{display:'block',maxWidth:'100%',width:'auto',height:'auto',margin:'0 auto',...img},[],{src:image.src,alt:b.alt||'','data-ref':image.ref||''});
 if(b.full){frame={borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`};caption={...caption,padding:`0 ${t.pad.right}px 0 ${t.pad.left}px`}}
 const box=el('div',{...frame},[picture]);
 const kids=[box];
 if(b.caption){const cap=html(el('div',{...caption}),b.caption,t);if(tag)cap.prepend(tag(n));kids.push(cap)}
 else if(tag)kids.push(el('div',{...caption},[tag(n)]));
 return el('figure',{margin:'0',padding:'0'},kids);
}
const plainCaption=(t,extra={})=>({marginTop:'5px',fontSize:t.px(0.72),lineHeight:'1.5',color:t.muted,textAlign:'left',...extra});
// One compact row per reference: number, name and full link inline.
function refEntry(t,b,s={}){
 const row={display:'grid',gridTemplateColumns:`${Math.round(t.refSize*3.3)}px 1fr`,columnGap:'0',margin:`0 0 ${t.refGap}px`,fontSize:t.refSize+'px',lineHeight:String(t.refLeading),color:t.body,textAlign:'left',textWrap:'pretty',...(s.row||{})};
 if(!b.number)return html(el('div',{...row,display:'block'}),b.html,t);
 const detail=el('div',{minWidth:'0'},[el('span',{marginRight:'5px',color:t.ink,fontWeight:'700',...s.name},[fixedSpaces(b.name)])]);
 if(b.url)detail.append(el('span',{fontFamily:SANS,fontSize:(t.refSize-0.5)+'px',wordBreak:'break-all',color:t.muted,...s.url},[b.url]));
 return el('div',row,[el('span',{whiteSpace:'nowrap',letterSpacing:'-0.04em',color:t.ink,fontWeight:'700',...s.num},[b.number]),detail]);
}
function pointList(items,make){return items.slice(0,5).map((s,i)=>make(s,i,s.label))}
const coverPage=(t,width,height,style)=>el('article',{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,display:'flex',flexDirection:'column',...style},[],{'data-cover':'true'});
const smallCaps=(t,extra={})=>({fontFamily:MONO,fontSize:'7.5px',lineHeight:'1.3',letterSpacing:'0.2em',textTransform:'uppercase',color:t.muted,...extra});
const pageNo=(index,total)=>`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;

// 刊物: magazine feature. Serif throughout, warm off-white, drop cap, big centred numerals.
const FOLIO={id:'folio',size:13,leading:1.72,gap:7,refSize:9,refGap:3,paper:'#f3efe9',surface:'#e9e3da',ink:'#24201c',body:'#2e2924',muted:'#7d7268',rule:'#d3c9bc',accent:'#8b7765',pad:{top:40,right:28,bottom:34,left:28}};
function folio(template,opts){
 const t=tokens(template,FOLIO,opts);const {px}=t,line=t.size*t.leading;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead(b){const p=html(el('p',text(t,{color:t.ink})),b.html,t);const first=p.firstChild;
   if(first?.nodeType===3&&first.textContent.trim()){const s=first.textContent.replace(/^\s+/,''),ch=[...s][0];first.textContent=s.slice(ch.length);
    p.prepend(el('span',{float:'left',fontSize:Math.round(line*1.8)+'px',lineHeight:Math.round(line*2)+'px',height:Math.round(line*2)+'px',margin:'1px 6px 0 0',color:t.ink,fontWeight:'900',fontFamily:SERIF},[ch]))}
   return p},
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'16px 0 10px',textAlign:'center'},[
   el('div',{fontFamily:SERIF,fontSize:px(2.3),lineHeight:'1',fontWeight:'400',color:t.accent},[b.number]),
   deco('div',{width:'24px',height:'1px',background:t.accent,margin:'7px auto 7px'}),
   phrased(html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:px(1.3),lineHeight:'1.4',fontWeight:'900',color:t.ink,...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontFamily:SERIF,fontSize:px(1.1),lineHeight:'1.45',fontWeight:'900',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'11px 0 5px',fontFamily:SERIF,fontSize:px(1),lineHeight:'1.4',fontWeight:'900',color:t.ink,fontStyle:'normal'}),b.html,t),
  pair(b){const p=el('p',text(t,{fontSize:px(0.95),lineHeight:'1.62',margin:'0 0 4px'}));p.append(html(el('strong',{fontWeight:'900',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`0.75px solid ${t.ink}`,background:'#ffffff'},caption:plainCaption(t,{fontFamily:SERIF,padding:'0 2px'}),tag:n=>deco('span',{color:t.accent,fontWeight:'700',marginRight:'5px'},[`图${n}`])}),
  figureMargin:'10px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'12px 8px',padding:'0',color:t.ink,fontSize:px(1.08),lineHeight:'1.6',fontWeight:'700',textAlign:'center'}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 8px',textAlign:'center'},[html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.4',color:t.ink,fontWeight:'900'}),b.html,t),deco('div',{width:'24px',height:'1px',background:t.ink,margin:'6px auto 0'})]),
  ref:b=>refEntry(t,b,{num:{color:t.accent}}),
  end:()=>deco('div',{textAlign:'center',margin:'10px 0 6px',fontFamily:SERIF,fontSize:'10px',color:t.accent},['■']),
  frame(page,{index,total,section}){
   page.append(deco('div',oneLine({position:'absolute',top:'16px',left:t.pad.left+'px',right:t.pad.right+'px',textAlign:'center',fontFamily:SERIF,fontSize:'8px',lineHeight:'11px',color:t.muted,letterSpacing:'0.1em'}),[section?headingText(section.html):'']));
   page.append(deco('div',{position:'absolute',bottom:'13px',left:'0',right:'0',textAlign:'center',fontFamily:SERIF,fontSize:'8.5px',lineHeight:'11px',color:t.ink},[String(index)]));
  },
  cover({title:main,subtitle:sub,points:items,image,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SERIF,padding:'26px 28px 26px'});
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontSize:'9px',letterSpacing:'0.3em',color:t.accent,paddingBottom:'6px',borderBottom:`1px solid ${t.ink}`},[el('span',{},['LONG READ']),el('span',{letterSpacing:'0.1em'},[`${stats.minutes} 分钟`])]));
   if(image)page.append(deco('div',{margin:'16px -28px 0',height:Math.round(height*0.4)+'px',overflow:'hidden'},[el('img',{display:'block',width:'100%',height:'100%',objectFit:'cover'},[],{src:image.src,alt:''})]));
   page.append(el('div',{flex:'1',minHeight:'16px'}));
   page.append(deco('h1',{margin:'0',fontFamily:SERIF,fontSize:image?'42px':'50px',lineHeight:'1.14',fontWeight:'900',letterSpacing:'-0.02em',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'16px',fontFamily:SERIF,fontSize:'20px',lineHeight:'1.4',color:t.body,fontWeight:'400',...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'18px'},pointList(items,(s,i,label)=>el('div',{fontSize:'14px',lineHeight:'1.5',color:t.ink,padding:'2px 0'},[`${s.number}　${label}`])))));
   page.append(deco('div',{marginTop:'22px',height:'3px',borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`}));
   return page;
  },
 };
}

// 蓝图: technical spec sheet. Dot-grid paper, mono small caps, dashed frames, black tabs.
const BLUEPRINT={id:'blueprint',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#fbfbfa',surface:'#eef1f4',ink:'#16191d',body:'#2a2e33',muted:'#7a828c',rule:'#bfc7d0',accent:'#6e8098',pad:{top:40,right:26,bottom:34,left:26}};
function blueprint(template,opts){
 const t=tokens(template,BLUEPRINT,opts);const {px}=t,dash=`1px dashed ${t.rule}`;
 const paper={background:t.paper,backgroundImage:`radial-gradient(${t.rule} 0.6px,transparent 0.7px)`,backgroundSize:'12px 12px',backgroundPosition:'6px 6px'};
 const tab=extra=>({display:'inline-block',fontFamily:MONO,fontSize:'8px',fontWeight:'700',lineHeight:'1',color:t.accent,border:`1px solid ${t.accent}`,padding:'2px 4px',...extra});
 return {...t,
  shell:{...paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,padding:'7px 10px',border:`1px solid ${t.ink}`,background:'#ffffff'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px'},[
   el('div',{display:'flex',alignItems:'center',gap:'6px'},[deco('span',smallCaps(t,{color:t.accent}),['Section']),el('span',tab(),[b.number]),deco('span',{flex:'1',borderTop:dash})]),
   phrased(html(el('h3',{margin:'7px 0 0',fontFamily:SERIF,fontSize:px(1.32),lineHeight:'1.38',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.08),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label:b=>el('div',{margin:'10px 0 5px',display:'flex',alignItems:'center',gap:'6px'},[deco('span',{width:'6px',height:'6px',background:t.accent,flexShrink:'0'}),html(el('span',{fontSize:px(0.92),lineHeight:'1.4',fontWeight:'800',color:t.ink}),b.html,t)]),
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 3px',padding:'3px 8px',border:dash,background:'#ffffff'}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{background:'#ffffff',padding:'5px',border:dash},caption:plainCaption(t,{padding:'0 14px'}),tag:n=>deco('span',smallCaps(t,{fontSize:'7px',color:t.accent,fontWeight:'700',marginRight:'6px'}),[`Fig.${String(n).padStart(2,'0')}`])}),
  figureMargin:'8px -16px 10px',bleed:16,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 10px',borderLeft:`2px solid ${t.accent}`,background:t.surface,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 7px'},[el('div',{display:'flex',alignItems:'center',gap:'6px'},[deco('span',smallCaps(t),['References']),deco('span',{flex:'1',borderTop:dash})]),html(el('h3',{margin:'5px 0 0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'900'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{fontFamily:MONO,fontSize:'0.9em',color:t.accent},row:{padding:'0 0 1px',borderBottom:dash}}),
  end:()=>deco('div',{display:'flex',alignItems:'center',gap:'8px',margin:'12px 0 6px'},[el('span',{flex:'1',borderTop:dash}),el('span',{width:'6px',height:'6px',background:t.ink}),el('span',{flex:'1',borderTop:dash})]),
  frame(page,{index,total,section}){
   page.append(deco('div',{position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',paddingBottom:'5px',borderBottom:dash},[el('span',smallCaps(t),['Long read']),el('span',oneLine({...smallCaps(t,{letterSpacing:'0.04em',textTransform:'none'}),maxWidth:'220px',fontFamily:SANS,fontSize:'8px'}),[section?`${section.number} · ${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',bottom:'12px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'flex-end',fontFamily:MONO,fontSize:'8.5px',color:t.ink,fontWeight:'700',letterSpacing:'0.08em'},[pageNo(index,total)]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=coverPage(t,width,height,{...paper,fontFamily:SANS,padding:'24px 24px 22px'});
   const mark=pos=>deco('span',{position:'absolute',width:'10px',height:'10px',...pos});
   page.append(mark({top:'12px',left:'12px',borderTop:`1px solid ${t.ink}`,borderLeft:`1px solid ${t.ink}`}),mark({top:'12px',right:'12px',borderTop:`1px solid ${t.ink}`,borderRight:`1px solid ${t.ink}`}),mark({bottom:'12px',left:'12px',borderBottom:`1px solid ${t.ink}`,borderLeft:`1px solid ${t.ink}`}),mark({bottom:'12px',right:'12px',borderBottom:`1px solid ${t.ink}`,borderRight:`1px solid ${t.ink}`}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between'},[el('span',smallCaps(t,{fontSize:'9px',color:t.accent}),['Long read']),el('span',smallCaps(t,{fontSize:'9px'}),[`${stats.figures} figures · ${stats.references} refs`])]));
   page.append(el('div',{flex:'1'}));
   page.append(deco('h1',{margin:'0',fontFamily:SERIF,fontSize:'46px',lineHeight:'1.18',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'16px',alignSelf:'flex-start',border:`1px solid ${t.ink}`,background:'#ffffff',fontSize:'16px',lineHeight:'1.4',fontWeight:'700',padding:'6px 10px',color:t.ink,...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'14px'},pointList(items,(s,i,label)=>el('div',{display:'flex',gap:'8px',padding:'4px 0',borderTop:dash,fontSize:'13.5px',lineHeight:'1.35',fontWeight:'700'},[el('span',smallCaps(t,{fontSize:'9px',color:t.accent,width:'16px'}),[s.number]),label])))));
   page.append(el('div',{flex:'1.3'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',borderTop:dash,paddingTop:'6px'},[el('span',smallCaps(t,{fontSize:'8.5px'}),['Spec sheet']),el('span',smallCaps(t,{fontSize:'8.5px'}),[`${stats.minutes} min read`])]));
   return page;
  },
 };
}

// 推文: X post screenshots. Cover is a headline over an embedded post; every inner page reads as
// one post in a thread, with the account header and the action row.
const TWEET={id:'tweet',size:13.5,leading:1.6,gap:8,refSize:9,refGap:3,paper:'#ffffff',ink:'#0f1419',body:'#0f1419',muted:'#5f6b76',rule:'#e3e7ea',surface:'#f5f7f8',accent:'#7b8a99',pad:{top:52,right:22,bottom:40,left:22}};
const ICON={
 reply:'M4 12a8 8 0 0 1 8-8h0a8 8 0 0 1 0 16H8l-4 3v-5',
 repost:'M7 7h10v6 M4 10l3-3 3 3 M17 17H7v-6 M20 14l-3 3-3-3',
 like:'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
 bookmark:'M7 4h10v16l-5-4-5 4z',
 share:'M12 15V4 M8 8l4-4 4 4 M5 14v6h14v-6',
 badge:'M12 2l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.9 1 2.8-2.5 1.8-.9 2.8-3-.2L12 22l-2.4-1.8-3 .2-.9-2.8-2.5-1.8 1-2.8-1-2.9 2.5-1.7.9-2.8 3 .2z M8.5 12l2.3 2.3 4.7-4.6',
};
function icon(name,size,color,{fill=false}={}){const s=deco('span',{display:'inline-flex',width:size+'px',height:size+'px',color,flexShrink:'0'});
 const paths=ICON[name].split(' M').map((d,i)=>(i?'M':'')+d);
 s.innerHTML=`<svg viewBox="0 0 24 24" width="${size}" height="${size}">${paths.map((d,i)=>`<path d="${d}" fill="${fill&&i===0?'currentColor':'none'}" stroke="${fill&&i===0?'none':fill?'#ffffff':'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;return s}
function tweet(template,opts){
 const t=tokens(template,TWEET,opts);const {px}=t;
 const account=byline=>({name:byline?.name||'长文笔记',handle:byline?.handle||''});
 const avatar=(name,size)=>deco('span',{width:size+'px',height:size+'px',borderRadius:'50%',background:t.accent,color:t.paper,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:Math.round(size*0.42)+'px',flexShrink:'0'},[[...String(name)][0]]);
 const header=(who,size,extra)=>deco('div',{display:'flex',alignItems:'center',gap:'8px'},[avatar(who.name,size),el('div',{display:'flex',flexDirection:'column',minWidth:'0'},[el('span',{display:'flex',alignItems:'center',gap:'3px',fontWeight:'800',fontSize:Math.round(size*0.42)+'px',lineHeight:'1.2',color:t.ink},[who.name,icon('badge',Math.round(size*0.42),t.accent,{fill:true})]),el('span',{fontSize:Math.round(size*0.36)+'px',lineHeight:'1.3',color:t.muted},[[who.handle,extra].filter(Boolean).join(' · ')])])]);
 const actions=size=>deco('div',{display:'flex',justifyContent:'space-between',padding:'0 4px'},['reply','repost','like','bookmark','share'].map(k=>icon(k,size,t.muted)));
 let who=account(null);
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{textAlign:'left'})),b.html,t),
  p:b=>html(el('p',text(t,{textAlign:'left'})),b.html,t),
  section(b){return el('header',{margin:'12px 0 6px'},[
   phrased(html(el('h3',{margin:'0',fontSize:px(1.2),lineHeight:'1.38',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),{}),
   el('div',{marginTop:'2px',fontSize:px(0.82),lineHeight:'1.4',color:t.muted},[el('span',{},[b.number]),deco('span',{},['/'])])])},
  heading:b=>html(el('h4',{margin:'10px 0 4px',fontSize:px(1.05),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'10px 0 4px',fontSize:px(1),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.96),lineHeight:'1.55',margin:'0 0 4px'}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,borderRadius:'12px',overflow:'hidden',background:'#fff'},caption:plainCaption(t,{padding:'0 4px'})}),
  figureMargin:'6px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 11px',border:`1px solid ${t.rule}`,borderRadius:'12px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'10px 0 7px'},[html(el('h3',{margin:'0',fontSize:px(1.1),lineHeight:'1.35',color:t.ink,fontWeight:'800'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.muted}}),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px'},[header(who,28,`${index}/${total}`)]));
   page.append(deco('div',{position:'absolute',bottom:'10px',left:t.pad.left+'px',right:t.pad.right+'px',paddingTop:'7px',borderTop:`1px solid ${t.rule}`},[actions(13)]));
  },
  cover({title:main,subtitle:sub,points:items,byline,stats,width,height}){
   who=account(byline);
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'34px 22px 24px'});
   page.append(deco('h1',{margin:'0',fontSize:'40px',lineHeight:'1.2',fontWeight:'900',color:t.ink,textAlign:'left',letterSpacing:'-0.01em',...BALANCE},[main]));
   page.append(deco('div',{height:'1px',background:t.rule,margin:'18px 0 0'}));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   const body=[header(who,34)];
   if(sub)body.push(el('div',{fontSize:'17px',lineHeight:'1.45',color:t.ink,...BALANCE},[sub]));
   if(items.length)body.push(optional(el('div',{},pointList(items,(s,i,label)=>el('div',{fontSize:'14px',lineHeight:'1.5',color:t.ink},[`${i+1}/ ${label}`])))));
   body.push(el('div',{fontSize:'11.5px',color:t.muted},[`长文 · ${stats.figures} 张图 · ${stats.minutes} 分钟读完`]));
   body.push(el('div',{borderTop:`1px solid ${t.rule}`,paddingTop:'9px'},[actions(15)]));
   page.append(deco('div',{border:`1px solid ${t.rule}`,borderRadius:'16px',padding:'14px 14px 10px',display:'flex',flexDirection:'column',gap:'10px',background:'#fff'},body));
   page.append(el('div',{flex:'1.5',minHeight:'14px'}));
   page.append(deco('div',{height:'1px',background:t.rule}));
   return page;
  },
 };
}

// 研报: research report. Sans, strict left column, segmented progress, mono data labels.
const BRIEF={id:'brief',size:13,leading:1.68,gap:7,refSize:9,refGap:3,paper:'#eef0ef',surface:'#e3e7e4',ink:'#1b1f1d',body:'#2b302d',muted:'#6f7872',rule:'#cfd5d1',accent:'#7c8b78',pad:{top:42,right:26,bottom:32,left:26}};
function brief(template,opts){
 const t=tokens(template,BRIEF,opts);const {px}=t;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.04),lineHeight:'1.65'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px',paddingTop:'6px',borderTop:`2px solid ${t.ink}`},[
   el('div',{fontFamily:MONO,fontSize:'8px',lineHeight:'1.4',letterSpacing:'0.12em',color:t.accent,fontWeight:'700'},[deco('span',{},['§ ']),el('span',{},[b.number])]),
   phrased(html(el('h3',{margin:'3px 0 0',fontFamily:SANS,fontSize:px(1.25),lineHeight:'1.36',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.08),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'10px 0 5px',fontSize:px(0.86),lineHeight:'1.4',fontWeight:'800',color:t.ink,letterSpacing:'0.04em',paddingBottom:'3px',borderBottom:`1px solid ${t.ink}`}),b.html,t),
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0',padding:'4px 0',borderBottom:`1px solid ${t.rule}`}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,background:'#ffffff',padding:'4px'},caption:plainCaption(t),tag:n=>deco('span',{fontFamily:MONO,fontSize:'7.5px',fontWeight:'700',color:t.accent,marginRight:'6px',letterSpacing:'0.06em'},[`FIG ${String(n).padStart(2,'0')}`])}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'6px 10px',background:t.surface,borderLeft:`2px solid ${t.ink}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'10px 0 6px',paddingTop:'5px',borderTop:`2px solid ${t.ink}`},[deco('div',{fontFamily:MONO,fontSize:'8px',letterSpacing:'0.12em',color:t.accent,fontWeight:'700'},['APPENDIX']),html(el('h3',{margin:'2px 0 0',fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'800'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{fontFamily:MONO,fontSize:'0.92em',color:t.accent},row:{padding:'0 0 1px',borderBottom:`1px solid ${t.rule}`}}),
  end:()=>deco('div',{margin:'12px 0 6px',fontFamily:MONO,fontSize:'7.5px',letterSpacing:'0.3em',color:t.muted,textAlign:'right'},['END']),
  frame(page,{index,total,section,sectionIndex,sectionCount,title}){
   if(sectionCount)page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',gap:'3px'},Array.from({length:sectionCount},(_,i)=>el('span',{flex:'1',height:'2px',background:i<=sectionIndex?t.accent:t.rule}))));
   page.append(deco('div',oneLine({position:'absolute',top:'21px',left:t.pad.left+'px',right:t.pad.right+'px',fontSize:'8px',lineHeight:'11px',color:t.muted}),[section?`§ ${section.number}　${headingText(section.html)}`:'']));
   page.append(deco('div',{position:'absolute',bottom:'12px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',fontSize:'7.5px',lineHeight:'11px',color:t.muted},[el('span',oneLine({maxWidth:'230px'}),[title]),el('span',{fontFamily:MONO,color:t.ink,fontWeight:'700',fontSize:'8.5px'},[pageNo(index,total)])]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'0 26px 22px'});
   page.append(deco('div',{height:'3px',background:t.accent,margin:'0 -26px'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontFamily:MONO,fontSize:'9px',letterSpacing:'0.16em',color:t.ink,marginTop:'14px',fontWeight:'700'},[el('span',{},['RESEARCH BRIEF']),el('span',{color:t.muted},[`${stats.minutes} MIN`])]));
   page.append(el('div',{flex:'0.8'}));
   page.append(deco('h1',{margin:'0',fontSize:'44px',lineHeight:'1.18',fontWeight:'900',color:t.ink,letterSpacing:'-0.01em',textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'14px',fontSize:'18px',lineHeight:'1.4',color:t.muted,fontWeight:'600',...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'16px',borderTop:`1px solid ${t.ink}`},pointList(items,(s,i,label)=>el('div',{display:'flex',gap:'10px',padding:'5px 0',borderBottom:`1px solid ${t.rule}`,fontSize:'13.5px',fontWeight:'700'},[el('span',{fontFamily:MONO,fontSize:'10px',width:'18px'},[s.number]),label])))));
   page.append(el('div',{flex:'1'}));
   page.append(deco('div',{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:`2px solid ${t.ink}`,paddingTop:'7px'},[[stats.figures,'Figures'],[stats.references,'References'],[stats.minutes,'Minutes']].map(([n,l])=>el('div',{},[el('div',{fontFamily:MONO,fontSize:'22px',lineHeight:'1.1',fontWeight:'700',color:t.ink},[String(n)]),el('div',{fontFamily:MONO,fontSize:'8px',letterSpacing:'0.12em',color:t.accent,textTransform:'uppercase'},[l])]))));
   return page;
  },
 };
}

// 报刊: newspaper. Masthead, heavy double rules, serif headline at poster scale, dense columns of type.
const PRESS={id:'press',size:12.5,leading:1.66,gap:6,refSize:8.5,refGap:2,paper:'#fcfbf9',ink:'#121212',body:'#1c1c1c',muted:'#6e6a66',rule:'#d2cfcb',accent:'#a0624f',pad:{top:44,right:24,bottom:32,left:24}};
function press(template,opts){
 const t=tokens(template,PRESS,opts);const {px}=t,line=t.size*t.leading;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead(b){const p=html(el('p',text(t,{color:t.ink,fontWeight:'700'})),b.html,t);const first=p.firstChild;
   if(first?.nodeType===3&&first.textContent.trim()){const s=first.textContent.replace(/^\s+/,''),ch=[...s][0];first.textContent=s.slice(ch.length);
    p.prepend(el('span',{float:'left',fontSize:Math.round(line*2.2)+'px',lineHeight:Math.round(line*2)+'px',height:Math.round(line*2)+'px',margin:'2px 6px 0 0',color:t.ink,fontWeight:'900',fontFamily:SERIF},[ch]))}
   return p},
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'12px 0 7px',borderTop:`3px solid ${t.ink}`,paddingTop:'5px'},[
   el('div',{fontFamily:SANS,fontSize:'8px',lineHeight:'1.3',fontWeight:'800',letterSpacing:'0.2em',color:t.accent},[b.number]),
   phrased(html(el('h3',{margin:'2px 0 0',fontFamily:SERIF,fontSize:px(1.4),lineHeight:'1.28',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t)),
   deco('div',{height:'1px',background:t.ink,marginTop:'6px'})])},
  heading:b=>html(el('h4',{margin:'11px 0 5px',fontFamily:SERIF,fontSize:px(1.1),lineHeight:'1.4',fontWeight:'900',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'9px 0 4px',fontFamily:SANS,fontSize:px(0.82),lineHeight:'1.4',fontWeight:'800',letterSpacing:'0.12em',color:t.accent}),b.html,t),
  pair(b){const p=el('p',text(t,{fontSize:px(0.96),lineHeight:'1.55',margin:'0 0 3px',paddingBottom:'3px',borderBottom:`1px solid ${t.rule}`}));p.append(html(el('strong',{fontWeight:'900',color:t.ink,fontFamily:SANS}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,padding:'5px 0'},caption:plainCaption(t,{fontFamily:SANS,padding:'0 2px'}),tag:n=>deco('span',{fontWeight:'800',color:t.ink,marginRight:'5px'},[`图${n}`])}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'6px 0',borderTop:`1px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,color:t.ink,fontSize:px(1.08),lineHeight:'1.55',fontWeight:'700',textAlign:'center'}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 6px',borderTop:`3px solid ${t.ink}`,paddingTop:'5px'},[html(el('h3',{margin:'0',fontFamily:SERIF,fontSize:px(1.15),lineHeight:'1.35',color:t.ink,fontWeight:'900'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{fontFamily:SANS,fontSize:'0.9em',color:t.accent}}),
  end:()=>deco('div',{textAlign:'right',margin:'4px 0 6px'},[el('span',{display:'inline-block',width:'7px',height:'7px',background:t.ink})]),
  frame(page,{index,section,title}){
   page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'10px',paddingBottom:'4px',borderBottom:`1px solid ${t.ink}`,fontFamily:SANS,fontSize:'7.5px',lineHeight:'11px',color:t.ink},[el('span',oneLine({fontWeight:'800',letterSpacing:'0.12em',maxWidth:'170px'}),[splitTitle(title)[0]]),el('span',oneLine({color:t.muted,maxWidth:'150px'}),[section?`${section.number}　${headingText(section.html)}`:''])]));
   page.append(deco('div',{position:'absolute',top:'31px',left:t.pad.left+'px',right:t.pad.right+'px',height:'1px',background:t.ink}));
   page.append(deco('div',{position:'absolute',bottom:'11px',left:'0',right:'0',textAlign:'center',fontFamily:SERIF,fontSize:'8.5px',lineHeight:'11px',color:t.ink},[`— ${index} —`]));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SERIF,padding:'22px 22px 20px'});
   page.append(deco('div',{textAlign:'center',fontFamily:SERIF,fontSize:'30px',lineHeight:'1.15',fontWeight:'900',letterSpacing:'0.24em',paddingBottom:'6px'},['长文周刊']));
   page.append(deco('div',{borderTop:`3px solid ${t.ink}`,borderBottom:`1px solid ${t.ink}`,height:'2px'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',fontFamily:SANS,fontSize:'9px',padding:'4px 0',borderBottom:`1px solid ${t.ink}`,color:t.ink},[el('span',{},['LONG READ']),el('span',{},[`${stats.figures} 图 · ${stats.references} 参考 · ${stats.minutes} 分钟`])]));
   page.append(el('div',{flex:'1'}));
   page.append(deco('h1',{margin:'0',fontFamily:SERIF,fontSize:'54px',lineHeight:'1.1',fontWeight:'900',color:t.ink,textAlign:'left',letterSpacing:'-0.02em',...BALANCE},[main]));
   page.append(deco('div',{height:'1px',background:t.ink,margin:'16px 0 10px'}));
   if(sub)page.append(deco('div',{fontFamily:SERIF,fontSize:'19px',lineHeight:'1.4',fontWeight:'700',color:t.accent,...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'12px'},pointList(items,(s,i,label)=>el('div',{fontSize:'13.5px',lineHeight:'1.5',fontWeight:'700'},[`${s.number}　${label}`])))));
   page.append(el('div',{flex:'0.6'}));
   page.append(deco('div',{borderTop:`1px solid ${t.ink}`,borderBottom:`3px solid ${t.ink}`,height:'2px'}));
   return page;
  },
 };
}

// 标记: poster explainer. Huge black sans, thick underlines, black reverse blocks for emphasis.
const MARKER={id:'marker',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#f3eeea',surface:'#e9dfd8',ink:'#1e1a18',body:'#2d2826',muted:'#7e736d',rule:'#d9cdc5',accent:'#b07f6b',pad:{top:40,right:26,bottom:34,left:26}};
function marker(template,opts){
 const t=tokens(template,MARKER,opts);const {px}=t;
 const underline={textDecoration:'underline',textDecorationColor:t.accent,textDecorationThickness:'2px',textUnderlineOffset:'3px'};
 Object.assign(t,{strongStyle:{fontWeight:'800',...underline}});
 const block=extra=>({display:'inline-block',background:t.ink,color:t.paper,...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.08),fontWeight:'700',lineHeight:'1.6'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'14px 0 8px'},[
   el('div',{display:'flex',alignItems:'baseline',gap:'8px'},[el('span',{fontSize:px(2.6),lineHeight:'0.9',fontWeight:'900',color:t.ink,letterSpacing:'-0.04em'},[b.number]),deco('span',{flex:'1',height:'2px',background:t.accent,alignSelf:'center'})]),
   phrased(html(el('h3',{margin:'6px 0 0',fontSize:px(1.4),lineHeight:'1.32',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.1),lineHeight:'1.45',fontWeight:'900',color:t.ink}),b.html,t),
  label(b){const s=html(el('span',block({fontSize:px(0.9),lineHeight:'1.5',padding:'1px 7px',fontWeight:'800'})),b.html,t);s.querySelectorAll('strong').forEach(x=>Object.assign(x.style,{color:t.paper,textDecoration:'none'}));return el('div',{margin:'10px 0 5px'},[s])},
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.55',margin:'0 0 4px',paddingLeft:'9px',borderLeft:`3px solid ${t.accent}`}));p.append(html(el('strong',{fontWeight:'900',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1.5px solid ${t.ink}`},caption:plainCaption(t,{fontWeight:'600',color:t.ink})}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 11px',background:t.surface,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading),fontWeight:'700'}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 7px'},[html(el('h3',{margin:'0',fontSize:px(1.25),lineHeight:'1.35',color:t.ink,fontWeight:'900',paddingBottom:'4px',borderBottom:`2px solid ${t.accent}`}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{fontWeight:'900',color:t.accent}}),
  end:()=>deco('div',{margin:'12px 0 6px'},[el('span',{display:'block',width:'36px',height:'4px',background:t.accent})]),
  frame(page,{index,total,title}){
   page.append(deco('div',oneLine({position:'absolute',top:'15px',left:t.pad.left+'px',right:'80px',fontSize:'8px',lineHeight:'11px',color:t.ink,fontWeight:'800'}),[splitTitle(title)[0]]));
   page.append(deco('div',{position:'absolute',top:'12px',right:t.pad.right+'px',fontSize:'16px',lineHeight:'1',fontWeight:'900',color:t.ink,letterSpacing:'-0.03em'},[String(index).padStart(2,'0')]));
   page.append(deco('div',{position:'absolute',bottom:'14px',left:t.pad.left+'px',right:t.pad.right+'px',height:'2px',background:t.accent}));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'30px 24px 24px'});
   page.append(deco('div',{fontSize:'11px',fontWeight:'900',letterSpacing:'0.06em',color:t.ink},[`长文 / ${stats.minutes} 分钟`]));
   page.append(el('div',{flex:'0.6'}));
   page.append(deco('h1',{margin:'0',fontSize:'56px',lineHeight:'1.12',fontWeight:'900',color:t.ink,textAlign:'left',letterSpacing:'-0.03em',...BALANCE},[main]));
   page.append(deco('div',{height:'6px',background:t.accent,width:'72px',margin:'20px 0 16px'}));
   if(sub)page.append(deco('div',{alignSelf:'flex-start',fontSize:'20px',lineHeight:'1.4',fontWeight:'800',color:t.ink,...underline,...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'14px'},pointList(items,(s,i,label)=>el('div',{fontSize:'15px',lineHeight:'1.5',fontWeight:'800',color:t.ink},[`${i+1}. ${label}`])))));
   page.append(el('div',{flex:'1'}));
   return page;
  },
 };
}

// 轻读: plain notebook post. White page, consistent header and footer bars, sans text, underlined headings.
const NOTE={id:'note',size:13,leading:1.72,gap:8,refSize:9,refGap:3,paper:'#ffffff',surface:'#f3eff2',ink:'#221f22',body:'#2d2a2d',muted:'#7b7379',rule:'#e3dde1',accent:'#8f7a8c',pad:{top:44,right:26,bottom:38,left:26}};
function note(template,opts){
 const t=tokens(template,NOTE,opts);const {px}=t;
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section(b){return el('header',{margin:'12px 0 8px'},[
   phrased(html(el('h3',{margin:'0',fontSize:px(1.25),lineHeight:'1.42',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),{}),
   el('div',{display:'flex',alignItems:'center',gap:'6px',marginTop:'5px'},[el('span',{fontSize:px(0.78),fontWeight:'800',color:t.accent,letterSpacing:'0.08em'},[b.number]),deco('span',{flex:'1',height:'1px',background:t.accent})])])},
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.08),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'10px 0 5px',fontSize:px(0.98),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.94),lineHeight:'1.6',margin:'0 0 4px'}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`},caption:plainCaption(t,{textAlign:'center',padding:'0 14px'})}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 11px',background:t.surface,borderLeft:`2px solid ${t.accent}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 8px'},[html(el('h3',{margin:'0',fontSize:px(1.15),lineHeight:'1.4',fontWeight:'800',color:t.ink,paddingBottom:'4px',borderBottom:`1px solid ${t.ink}`}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent}}),
  end:()=>deco('div',{textAlign:'center',margin:'12px 0 6px',fontSize:'8px',letterSpacing:'0.4em',color:t.accent},['END']),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',gap:'12px',paddingBottom:'6px',borderBottom:`1px solid ${t.ink}`,fontSize:'8px',lineHeight:'11px',color:t.ink},[el('span',oneLine({maxWidth:'230px',fontWeight:'700'}),[splitTitle(title)[0]]),el('span',{},[`${index}/${total}`])]));
   page.append(deco('div',{position:'absolute',bottom:'14px',left:t.pad.left+'px',right:t.pad.right+'px',borderTop:`1px solid ${t.rule}`}));
  },
  cover({title:main,subtitle:sub,points:items,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'34px 26px 26px'});
   page.append(deco('div',{fontSize:'11px',color:t.muted,fontWeight:'600'},[`长文 · ${stats.figures} 张图解 · ${stats.minutes} 分钟`]));
   page.append(el('div',{flex:'0.7'}));
   page.append(deco('h1',{margin:'0',fontSize:'46px',lineHeight:'1.2',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'16px',fontSize:'19px',lineHeight:'1.45',color:t.accent,fontWeight:'600',...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'18px',borderTop:`1px solid ${t.ink}`},pointList(items,(s,i,label)=>el('div',{fontSize:'14px',lineHeight:'1.4',padding:'6px 0',borderBottom:`1px solid ${t.rule}`,fontWeight:'700'},[label])))));
   page.append(el('div',{flex:'1'}));
   page.append(deco('div',{borderTop:`1px solid ${t.ink}`,paddingTop:'7px',fontSize:'10px',color:t.muted},['长按收藏，慢慢读']));
   return page;
  },
 };
}

const THEMES={folio,brief,note,blueprint,tweet,press,marker};
// Older templates (journal/lab/wechat/...) map onto the closest current theme.
const LEGACY={journal:'folio',essay:'folio',letter:'folio',lab:'brief',graphite:'brief',wechat:'note',column:'marker'};
export function themeFor(template,opts={}){const key=THEMES[template?.layout]?template.layout:LEGACY[template?.layout]||'folio';return THEMES[key](template||{},opts)}
export const THEME_LAYOUTS=Object.keys(THEMES);
