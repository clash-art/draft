import DOMPurify from 'dompurify';
// Page themes for Xiaohongshu longform. All styling is inline so exported PNGs and the
// in-app HTML preview match regardless of surrounding app CSS. Elements marked
// data-deco carry no article text and are excluded from content verification.
// Sizes are CSS px on a 360px-wide page (exported at 3x, 1080px); every text size is
// derived from the body size so a template scales as a whole.
// Each theme follows one saved reference post (its colour mood, type and cover composition)
// and one tasteful accent used for numbers, small labels, rules and links, never large fills
// or gradients. An edition palette may override these tokens.
// Page fonts are the bundled open-licensed faces (see fonts.js); the system names after them only
// serve characters outside the bundled coverage. Latin pairs: Inter with the sans, the serif's and
// rounded face's own Latin, JetBrains Mono for figures and labels. Inter also backs the CJK faces for
// the spacing characters they lack (the fixed CJK/Latin quarter-em space).
export const SANS='"Draft Inter","Draft Sans SC","PingFang SC","Noto Sans CJK SC",sans-serif';
export const SERIF='"Draft Serif SC","Draft Inter","Songti SC","Noto Serif CJK SC",serif';
export const MONO='"Draft Mono","Draft Sans SC","Draft Inter",monospace';
export const ROUNDED='"Draft Rounded SC","Draft Inter","PingFang SC",sans-serif';
// Display face (得意黑) for very large titles only; it has one weight, so callers set 400.
export const DISPLAY='"Draft Smiley","Draft Sans SC","Draft Inter","PingFang SC",sans-serif';
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
const COLOR_KEYS=['paper','surface','ink','body','muted','rule','accent','backdrop'];
function tokens(template,base,{compact=0,palette}={}){
 const from=BASES[template?.palette_from];
 if(from&&from!==base){base={...base,backdrop:undefined};for(const k of COLOR_KEYS)if(from[k])base[k]=from[k]}
 const colors=themeColors(base,template,palette);base={...base,...colors,backdrop:base.backdrop||colors.paper};
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
const coverPage=(t,width,height,style)=>el('article',{fontSynthesis:'none',boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',background:t.paper,color:t.ink,display:'flex',flexDirection:'column',...style},[],{'data-cover':'true'});
const smallCaps=(t,extra={})=>({fontFamily:MONO,fontSize:'7.5px',lineHeight:'1.3',letterSpacing:'0.2em',textTransform:'uppercase',color:t.muted,...extra});
const pageNo=(index,total)=>`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;

// 蓝图: technical spec sheet. Dot-grid paper, mono small caps, dashed frames, black tabs.
const BLUEPRINT={id:'blueprint',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#ffffff',surface:'#f2f5fd',ink:'#0b0c0e',body:'#24262b',muted:'#6d7380',rule:'#c9d3ea',accent:'#2f5bea',pad:{top:40,right:26,bottom:34,left:26}};
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
   const page=coverPage(t,width,height,{...paper,fontFamily:SANS,padding:'24px 20px 22px'});
   const mark=pos=>deco('span',{position:'absolute',width:'10px',height:'10px',...Object.fromEntries(Object.entries(pos).map(([k,v])=>[k,String(v).replace(t.ink,t.accent)]))});
   page.append(mark({top:'12px',left:'12px',borderTop:`1px solid ${t.ink}`,borderLeft:`1px solid ${t.ink}`}),mark({top:'12px',right:'12px',borderTop:`1px solid ${t.ink}`,borderRight:`1px solid ${t.ink}`}),mark({bottom:'12px',left:'12px',borderBottom:`1px solid ${t.ink}`,borderLeft:`1px solid ${t.ink}`}),mark({bottom:'12px',right:'12px',borderBottom:`1px solid ${t.ink}`,borderRight:`1px solid ${t.ink}`}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between'},[el('span',smallCaps(t,{fontSize:'9px',color:t.accent}),['Long read']),el('span',smallCaps(t,{fontSize:'9px'}),[`${stats.figures} figures · ${stats.references} refs`])]));
   page.append(el('div',{flex:'1'}));
   page.append(deco('h1',{margin:'0',fontFamily:SERIF,fontSize:'52px',lineHeight:'1.16',fontWeight:'700',letterSpacing:'-0.01em',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{marginTop:'18px',alignSelf:'flex-start',border:`1px solid ${t.accent}`,background:'#ffffff',fontSize:'18px',lineHeight:'1.4',fontWeight:'700',padding:'6px 10px',color:t.ink,...BALANCE},[sub]));
   if(items.length)page.append(optional(deco('div',{marginTop:'14px'},pointList(items,(s,i,label)=>el('div',{display:'flex',gap:'8px',padding:'4px 0',borderTop:dash,fontSize:'13.5px',lineHeight:'1.35',fontWeight:'700'},[el('span',smallCaps(t,{fontSize:'9px',color:t.accent,width:'16px'}),[s.number]),label])))));
   page.append(el('div',{flex:'1.3'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',borderTop:dash,paddingTop:'6px'},[el('span',smallCaps(t,{fontSize:'8.5px'}),['Spec sheet']),el('span',smallCaps(t,{fontSize:'8.5px'}),[`${stats.minutes} min read`])]));
   return page;
  },
 };
}

// 推文: light X post screenshots. Cover is a headline over an embedded post; every inner page reads as
// one post in a thread, with the account header and the action row.
const TWEET={id:'tweet',size:13.5,leading:1.6,gap:8,refSize:9,refGap:3,paper:'#ffffff',ink:'#1f2420',body:'#2c322d',muted:'#748074',rule:'#dfe5dd',surface:'#f1f4ef',accent:'#6f8a6e',pad:{top:52,right:22,bottom:40,left:22}};
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
  section(b){return el('header',{margin:'12px 0 6px',display:'flex',flexDirection:'column-reverse'},[
   el('div',{marginTop:'2px',fontSize:px(0.82),lineHeight:'1.4',color:t.muted},[el('span',{},[b.number]),deco('span',{},['/'])]),
   phrased(html(el('h3',{margin:'0',fontSize:px(1.2),lineHeight:'1.38',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),{})])},
  heading:b=>html(el('h4',{margin:'10px 0 4px',fontSize:px(1.05),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  label:b=>html(el('div',{margin:'10px 0 4px',fontSize:px(1),lineHeight:'1.45',fontWeight:'800',color:t.ink}),b.html,t),
  pair(b){const p=el('p',text(t,{textAlign:'left',fontSize:px(0.96),lineHeight:'1.55',margin:'0 0 4px'}));p.append(html(el('strong',{fontWeight:'800',color:t.ink}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p},
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,borderRadius:'12px',overflow:'hidden',background:t.paper},caption:plainCaption(t,{padding:'0 4px'})}),
  figureMargin:'6px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 11px',border:`1px solid ${t.rule}`,borderRadius:'12px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'10px 0 7px'},[html(el('h3',{margin:'0',fontSize:px(1.1),lineHeight:'1.35',color:t.ink,fontWeight:'800'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.muted}}),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px'},[header(who,28,`${index}/${total}`)]));
   page.append(deco('div',{position:'absolute',bottom:'10px',left:t.pad.left+'px',right:t.pad.right+'px',paddingTop:'7px',borderTop:`1px solid ${t.rule}`},[actions(13)]));
  },
  cover({title:main,subtitle:sub,points:items,byline,stats,total,width,height}){
   who=account(byline);
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'34px 22px 24px'});
   page.append(deco('h1',{margin:'0',fontSize:'52px',lineHeight:'1.18',fontWeight:'700',color:t.ink,textAlign:'left',letterSpacing:'-0.01em',...BALANCE},[main]));
   page.append(deco('div',{height:'1px',background:t.rule,margin:'18px 0 0'}));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   const body=[header(who,34)];
   if(sub)body.push(el('div',{fontSize:'18px',lineHeight:'1.45',color:t.ink,...BALANCE},[sub]));
   if(items.length)body.push(optional(el('div',{},pointList(items,(s,i,label)=>el('div',{fontSize:'14px',lineHeight:'1.5',color:t.ink},[`${i+1}/ ${label}`])))));
   body.push(el('div',{fontSize:'11.5px',color:t.muted},[`长文 · ${stats.figures} 张图 · ${stats.minutes} 分钟读完`]));
   body.push(el('div',{borderTop:`1px solid ${t.rule}`,paddingTop:'9px'},[actions(15)]));
   page.append(deco('div',{border:`1px solid ${t.rule}`,borderRadius:'16px',padding:'14px 14px 10px',display:'flex',flexDirection:'column',gap:'10px',background:t.surface},body));
   page.append(el('div',{flex:'1',minHeight:'14px'}));
   page.append(deco('div',{fontSize:'11px',color:t.muted,display:'flex',justifyContent:'space-between'},[el('span',{},['长文串 · 往下翻']),el('span',{color:t.accent,fontWeight:'700'},[`1 / ${total}`])]));
   return page;
  },
 };
}


// Shared pieces for the reference-style themes below.
const stroke=(color,thickness,offset)=>({textDecorationLine:'underline',textDecorationColor:color,textDecorationThickness:thickness,textUnderlineOffset:offset,textDecorationSkipInk:'none'});
const CN_NUM=['〇','一','二','三','四','五','六','七','八','九','十'];
const cn=n=>CN_NUM[Number(n)]||String(n);
const nameOf=byline=>byline?.name||'长文笔记';
const headOf=s=>String(s).split(/[：:]/)[0];
const tailOf=s=>{const m=String(s).match(/[：:](.+)$/);return m?m[1]:String(s)};
const avatar=(name,size,style={})=>deco('span',{width:size+'px',height:size+'px',boxSizing:'border-box',borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:'0',fontFamily:SANS,fontWeight:'700',fontSize:Math.round(size*0.42)+'px',...style},[[...String(name)][0]]);
const coverImg=(image,box={},img={})=>deco('div',{overflow:'hidden',...box},[el('img',{display:'block',width:'100%',height:'100%',objectFit:'cover',...img},[],{src:image.src,alt:''})]);
const keyPair=(t,p,b,key={})=>{p.append(html(el('strong',{fontWeight:'800',color:t.ink,...key}),b.key,t));p.append(...html(el('span'),b.html,t).childNodes);return p};

// 线稿 (after Mind Lab's UI4A post): a white dot-grid cover with a serif title over a blue-ink annotated
// diagram; inner pages are plain white sans with blue left bars and blue underlined emphasis.
const WIREFRAME={id:'wireframe',size:13,leading:1.78,gap:9,refSize:9,refGap:3,paper:'#ffffff',surface:'#f2f5fb',ink:'#111418',body:'#2b2f36',muted:'#7a808a',rule:'#dfe4ee',accent:'#3a72e0',pad:{top:34,right:24,bottom:32,left:24}};
function wireframe(template,opts){
 const t=tokens(template,WIREFRAME,opts);const {px}=t;
 const blue={color:t.accent,fontWeight:'700',textDecoration:'underline',textDecorationColor:t.accent,textDecorationThickness:'1px',textUnderlineOffset:'3px'};
 Object.assign(t,{strongStyle:blue});
 const bar=extra=>({borderLeft:`3px solid ${t.accent}`,paddingLeft:'8px',...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'14px 0 9px',...bar({display:'flex',alignItems:'baseline',gap:'7px'})},[el('span',{fontFamily:MONO,fontSize:px(0.85),fontWeight:'800',color:t.accent},[b.number]),phrased(html(el('h3',{margin:'0',fontSize:px(1.22),lineHeight:'1.4',fontWeight:'800',color:t.ink,textAlign:'left',...BALANCE}),b.html,t))]),
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.04),lineHeight:'1.55',...blue}),b.html,t),
  label:b=>html(el('div',{margin:'10px 0 4px',fontSize:px(0.98),lineHeight:'1.5',...blue}),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',fontSize:px(0.95),lineHeight:'1.6',margin:'0 0 6px 2px',...bar({borderLeftWidth:'2px',paddingLeft:'10px'})})),b,blue),
  figure:(b,image,n)=>figure(t,b,image,n,{caption:plainCaption(t,{textAlign:'center',padding:'0 10px'})}),
  figureMargin:'8px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 10px',background:t.surface,...bar(),color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 8px',...bar()},[html(el('h3',{margin:'0',fontSize:px(1.12),lineHeight:'1.4',color:t.ink,fontWeight:'800'}),b.html,t)]),
  ref:b=>refEntry(t,b,{num:{color:t.accent}}),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',bottom:'12px',right:t.pad.right+'px',fontFamily:MONO,fontSize:'8px',color:t.muted,letterSpacing:'0.08em'},[pageNo(index,total)]));
  },
  cover({title:main,subtitle:sub,sections,image,byline,stats,width,height}){
   const grid={backgroundImage:`radial-gradient(${mix(t.rule,t.muted,0.3)} 0.7px,transparent 0.8px)`,backgroundSize:'14px 14px',backgroundPosition:'7px 7px'};
   const page=coverPage(t,width,height,{...grid,fontFamily:SERIF,padding:'26px 22px 18px'});
   page.append(deco('h1',{margin:'0',fontFamily:SERIF,fontSize:'27px',lineHeight:'1.32',fontWeight:'600',color:t.ink,textAlign:'left',maxWidth:'280px'},[main,sub?el('br'):null,sub||null]));
   const notes=sections.slice(0,4).map(s=>headOf(s.label));
   const spots=[{top:'-10px',left:'-6px',rotate:'-3deg'},{top:'22%',right:'-10px',rotate:'2deg'},{bottom:'18%',left:'-10px',rotate:'2deg'},{bottom:'-10px',right:'8px',rotate:'-2deg'}];
   const tag=(label,{rotate,...pos})=>el('span',{position:'absolute',...pos,transform:`rotate(${rotate})`,background:t.paper,border:`1px solid ${t.accent}`,color:t.accent,fontFamily:SANS,fontSize:'9.5px',lineHeight:'1.3',padding:'1px 5px',whiteSpace:'nowrap'},[`${label} →`]);
   if(image)page.append(deco('div',{position:'relative',margin:'20px 12px 0'},[el('img',{display:'block',width:'100%',height:'auto',border:`1px solid ${t.accent}`,background:'#ffffff'},[],{src:image.src,alt:''}),...notes.map((s,i)=>tag(s,spots[i]))]));
   else page.append(optional(deco('div',{marginTop:'22px'},sections.map(s=>el('div',bar({fontFamily:SANS,fontSize:'14px',lineHeight:'1.5',margin:'0 0 8px',color:t.ink}),[s.label])))));
   page.append(deco('div',{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'},[el('span',{display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:t.ink},[el('span',{width:'11px',height:'11px',border:`1.5px solid ${t.ink}`,borderRadius:'2px',boxSizing:'border-box'}),nameOf(byline)]),el('span',{fontFamily:MONO,fontSize:'8px',color:t.muted,letterSpacing:'0.08em'},[`${stats.figures} FIGS · ${stats.minutes} MIN`])]));
   return page;
  },
 };
}

// 随笔 (after 小盖's posts): a personal text post. Avatar header on every page, large serif body,
// a blank line between paragraphs and no decoration at all.
const PLAIN={id:'plain',size:13.5,leading:1.6,gap:9,refSize:9,refGap:3,paper:'#ffffff',surface:'#f2f2f2',ink:'#111111',body:'#1c1c1c',muted:'#9a9a9a',rule:'#e6e6e6',accent:'#576b95',pad:{top:58,right:18,bottom:20,left:18}};
function plain(template,opts){
 const t=tokens(template,PLAIN,opts);const {px}=t;
 const head=(byline,sub)=>deco('div',{display:'flex',alignItems:'center',gap:'9px'},[avatar(nameOf(byline),32,{background:t.surface,color:t.ink,border:`1px solid ${t.rule}`}),el('div',{display:'flex',flexDirection:'column',gap:'3px'},[el('span',{fontFamily:SANS,fontSize:'13px',fontWeight:'700',color:t.ink,lineHeight:'1.2'},[nameOf(byline)]),el('span',{fontFamily:SANS,fontSize:'10px',color:t.muted,lineHeight:'1.2'},[sub])])]);
 const bold={fontSize:px(1),lineHeight:String(t.leading),fontWeight:'700',color:t.ink};
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead:b=>html(el('p',text(t)),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'2px 0 10px',display:'flex',gap:'6px',alignItems:'baseline'},[el('span',{...bold,fontSize:px(1.08)},[b.number]),phrased(html(el('h3',{margin:'0',...bold,fontSize:px(1.08),textAlign:'left'}),b.html,t))]),
  heading:b=>html(el('h4',{margin:'0 0 8px',...bold}),b.html,t),
  label:b=>html(el('div',{margin:'0 0 6px',...bold}),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{margin:'0 0 8px'})),b,{fontWeight:'700'}),
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderRadius:'4px',overflow:'hidden'},caption:plainCaption(t,{fontFamily:SANS,textAlign:'center'})}),
  figureMargin:'2px 0 14px',bleed:0,
  quote:b=>html(el('blockquote',{margin:`0 0 ${t.gap}px`,padding:'0 0 0 12px',borderLeft:`3px solid ${t.rule}`,color:t.muted,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>html(el('h3',{margin:'2px 0 8px',...bold,fontSize:px(1.05)}),b.html,t),
  ref:b=>refEntry(t,b,{num:{color:t.muted,fontWeight:'400'},url:{color:t.accent}}),
  end:null,
  frame(page,{index,total,byline}){
   page.append(deco('div',{position:'absolute',top:'16px',left:t.pad.left+'px',right:t.pad.right+'px'},[head(byline,[byline?.handle,`${index}/${total}`].filter(Boolean).join(' · '))]));
  },
  cover({title:main,subtitle:sub,points,sections,byline,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SERIF,padding:'16px 18px 20px'});
   page.append(head(byline,byline?.handle||'长文'));
   page.append(deco('h1',{margin:'24px 0 0',fontSize:'25px',lineHeight:'1.45',fontWeight:'700',color:t.ink,textAlign:'left'},[main]));
   if(sub)page.append(deco('p',{margin:'12px 0 0',fontSize:'15.5px',lineHeight:'1.62',color:t.body},[`${sub}。`]));
   const items=(points.length?points:sections).slice(0,5);
   if(items.length)page.append(optional(deco('div',{marginTop:'18px',display:'flex',flexDirection:'column',gap:'12px'},items.map(s=>el('p',{margin:'0',fontSize:'15.5px',lineHeight:'1.55',color:t.body},[`${s.number}　${s.label}`])))));
   page.append(deco('p',{margin:'auto 0 0',fontSize:'11.5px',color:t.muted,fontFamily:SANS},[`约 ${stats.minutes} 分钟读完 · ${stats.figures} 张图`]));
   return page;
  },
 };
}

// 图文 (after 驴小草's covers): a photo across the top with small margins, a bold serif title,
// a grey subtitle behind a black bar and a closing rule.
const PHOTO={id:'photo',size:13,leading:1.76,gap:9,refSize:9,refGap:3,paper:'#ffffff',surface:'#f4f4f3',ink:'#141414',body:'#2a2a2a',muted:'#8a8a8a',rule:'#dedede',accent:'#3d3d3d',pad:{top:38,right:24,bottom:36,left:24}};
function photo(template,opts){
 const t=tokens(template,PHOTO,opts);const {px}=t;
 const lede=extra=>({borderLeft:`3px solid ${t.ink}`,paddingLeft:'10px',color:mix(t.body,t.muted,0.45),fontFamily:SANS,...extra});
 const serif=(size,extra)=>({fontFamily:SERIF,fontSize:px(size),fontWeight:'900',color:t.ink,...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,lede({fontSize:px(1.02),lineHeight:'1.7',fontWeight:'500'}))),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'16px 0 10px'},[el('div',{fontSize:px(0.72),letterSpacing:'0.2em',color:t.muted,fontWeight:'700'},[b.number]),phrased(html(el('h3',serif(1.42,{margin:'4px 0 0',lineHeight:'1.38',textAlign:'left',...BALANCE})),b.html,t))]),
  heading:b=>html(el('h4',serif(1.12,{margin:'12px 0 6px',lineHeight:'1.45'})),b.html,t),
  label:b=>html(el('div',serif(1.02,{margin:'11px 0 5px',lineHeight:'1.45'})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',fontSize:px(0.95),lineHeight:'1.6',margin:'0 0 5px'})),b),
  figure:(b,image,n)=>figure(t,b,image,n,{caption:plainCaption(t,lede({marginTop:'7px',borderLeftWidth:'2px',paddingLeft:'7px'}))}),
  figureMargin:'10px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',...lede({fontSize:t.size+'px',lineHeight:String(t.leading)})}),b.html,t),
  refsHeading:b=>html(el('h3',serif(1.2,{margin:'14px 0 8px',lineHeight:'1.4'})),b.html,t),
  ref:b=>refEntry(t,b),
  end:()=>deco('div',{margin:'14px 0 6px',height:'1px',background:t.rule}),
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',top:'16px',left:t.pad.left+'px',width:'22px',height:'5px',background:t.rule,borderRadius:'1px'}));
   page.append(deco('div',{position:'absolute',bottom:'14px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',paddingTop:'6px',borderTop:`1px solid ${t.rule}`,fontSize:'8.5px',color:t.muted},[el('span',oneLine({maxWidth:'240px'}),[splitTitle(title)[0]]),el('span',{},[`${index} / ${total}`])]));
  },
  cover({title:main,subtitle:sub,image,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SERIF,padding:'14px 16px 18px'});
   page.append(deco('div',{width:'34px',height:'6px',background:t.rule,borderRadius:'1px',margin:'0 0 10px 2px'}));
   if(image)page.append(coverImg(image,{height:Math.round(height*0.5)+'px',flexShrink:'0'}));
   page.append(deco('div',{padding:'0 8px',display:'flex',flexDirection:'column',flex:'1'},[
    el('h1',{margin:image?'22px 0 0':'64px 0 0',fontFamily:SERIF,fontSize:image?'27px':'36px',lineHeight:'1.4',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]),
    sub?el('div',lede({marginTop:'14px',fontSize:'13.5px',lineHeight:'1.6',fontWeight:'500'}),[sub]):null,
    el('div',{flex:'1'}),
    el('div',{borderTop:`1px solid ${mix(t.rule,t.ink,0.2)}`,paddingTop:'7px',display:'flex',justifyContent:'space-between',fontFamily:SANS,fontSize:'9.5px',color:t.muted},[el('span',{},[`${stats.figures} 张图`]),el('span',{},[`约 ${stats.minutes} 分钟`])])]));
   return page;
  },
 };
}

// 转述 (after 李白科技说's X-post explainers): a serif headline over pale grey bands, an embedded post with
// text wrapping beside it, and yellow highlighter on the key phrases inside.
const XSTYLE={id:'xstyle',size:13,leading:1.74,gap:8,refSize:9,refGap:3,paper:'#ffffff',surface:'#f3f3f3',ink:'#111111',body:'#222222',muted:'#8c8c8c',rule:'#e4e4e4',accent:'#c79a1e',highlight:'#faefb4',pad:{top:32,right:22,bottom:28,left:22}};
function xstyle(template,opts){
 const t=tokens(template,XSTYLE,opts);const {px}=t,band=mix(t.rule,t.paper,0.15);
 const marker={fontWeight:'700',background:t.highlight,padding:'0 1px'};
 Object.assign(t,{strongStyle:marker});
 const banded=extra=>({...stroke(band,'0.42em','-0.3em'),...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SERIF},
  lead:b=>html(el('p',text(t,{color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'16px 0 10px'},[el('div',{fontFamily:SANS,fontSize:px(0.72),color:t.muted,letterSpacing:'0.1em',marginBottom:'3px'},[b.number]),phrased(html(el('h3',{margin:'0',fontSize:px(1.38),lineHeight:'1.45',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE}),b.html,t),banded())]),
  heading:b=>html(el('h4',{margin:'12px 0 6px',fontSize:px(1.1),lineHeight:'1.55',fontWeight:'900',color:t.ink}),b.html,t),
  label:b=>el('div',{margin:'10px 0 5px'},[html(el('span',{fontSize:px(1),lineHeight:'1.6',color:t.ink,...marker,padding:'0 2px'}),b.html,t)]),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',margin:'0 0 6px'})),b,marker),
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1px solid ${t.rule}`,borderRadius:'8px',overflow:'hidden'},caption:plainCaption(t,{fontFamily:SANS,textAlign:'center'})}),
  figureMargin:'6px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'0 0 0 10px',borderLeft:`2px solid ${t.ink}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>html(el('h3',{margin:'14px 0 8px',fontSize:px(1.2),lineHeight:'1.45',color:t.ink,fontWeight:'900',...banded()}),b.html,t),
  ref:b=>refEntry(t,b,{num:{color:t.muted}}),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',top:'14px',left:t.pad.left+'px',right:t.pad.right+'px',height:'1px',background:t.rule}));
   page.append(deco('div',{position:'absolute',bottom:'11px',left:'0',right:'0',textAlign:'center',fontFamily:SANS,fontSize:'8px',color:t.muted},[`${index} / ${total}`]));
  },
  cover({title:main,subtitle:sub,points,sections,image,byline,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SERIF,padding:'18px 20px 16px',display:'block'});
   page.append(deco('div',{height:'1px',background:mix(t.rule,t.ink,0.15)}));
   page.append(deco('h1',{margin:'22px 0 0',fontSize:'31px',lineHeight:'1.5',fontWeight:'900',color:t.ink,textAlign:'left',...banded({textDecorationThickness:'0.42em',textUnderlineOffset:'-0.3em'})},[main+(sub?'，':''),sub||null]));
   page.append(deco('p',{margin:'14px 0 12px',fontSize:'14px',lineHeight:'1.7',color:t.body},[`${stats.minutes} 分钟读完，${stats.figures} 张图讲清楚。`]));
   const post=image?el('div',{float:'left',width:'46%',margin:'4px 12px 6px 0',border:`1px solid ${t.rule}`,borderRadius:'8px',padding:'6px',boxSizing:'border-box'},[
    el('div',{display:'flex',alignItems:'center',gap:'4px',marginBottom:'5px'},[avatar(nameOf(byline),14,{background:t.ink,color:t.paper,fontSize:'7px'}),el('span',oneLine({fontFamily:SANS,fontSize:'7.5px',fontWeight:'700',color:t.ink}),[nameOf(byline)])]),
    el('img',{display:'block',width:'100%',height:'auto',borderRadius:'4px'},[],{src:image.src,alt:''})]):null;
   const items=(points.length?points:sections).slice(0,5);
   page.append(deco('div',{},[post,...items.map(s=>el('p',{margin:'0 0 6px',fontSize:'14px',lineHeight:'1.75',color:t.body,textAlign:'left'},[el('span',marker,[headOf(s.label)]),s.label.slice(headOf(s.label).length)]))]));
   return page;
  },
 };
}

// 开发日志 (after the user's own Managed Agents write-up): a plain post. The cover is one of the article's
// figures filling most of the card with the title set plainly under it; inner pages are figures and
// text on white, with a soft terracotta accent only on small numbers and links.
const DEVLOG={id:'devlog',size:12.5,leading:1.72,gap:7,refSize:9,refGap:3,paper:'#ffffff',surface:'#f6f4f2',ink:'#151515',body:'#2a2a2a',muted:'#8e8e8e',rule:'#e8e6e3',accent:'#c46a4a',pad:{top:40,right:22,bottom:36,left:22}};
function devlog(template,opts){
 const t=tokens(template,DEVLOG,opts);const {px}=t;
 let who=null;
 const bold=(size,extra)=>({fontSize:px(size),lineHeight:'1.4',fontWeight:'800',color:t.ink,...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'12px 0 8px'},[el('div',{fontFamily:MONO,fontSize:px(0.72),color:t.accent,letterSpacing:'0.08em'},[b.number]),phrased(html(el('h3',bold(1.36,{margin:'3px 0 0',lineHeight:'1.34',textAlign:'left',...BALANCE})),b.html,t))]),
  heading:b=>html(el('h4',bold(1.1,{margin:'12px 0 6px'})),b.html,t),
  label:b=>html(el('div',bold(1,{margin:'10px 0 5px'})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',fontSize:px(0.96),lineHeight:'1.6',margin:'0 0 5px'})),b),
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderRadius:'6px',overflow:'hidden',border:`1px solid ${t.rule}`},caption:plainCaption(t,{textAlign:'center'})}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'0 0 0 10px',borderLeft:`2px solid ${t.rule}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>html(el('h3',bold(1.2,{margin:'12px 0 8px'})),b.html,t),
  ref:b=>refEntry(t,b,{num:{fontFamily:MONO,color:t.accent,fontSize:'0.92em'}}),
  end:null,
  frame(page,{index,total,title,byline}){
   page.append(deco('div',oneLine({position:'absolute',top:'15px',left:t.pad.left+'px',right:t.pad.right+'px',fontSize:'8px',lineHeight:'11px',color:t.muted}),[splitTitle(title)[0]]));
   page.append(deco('div',{position:'absolute',bottom:'13px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',justifyContent:'space-between',alignItems:'baseline',fontSize:'8.5px',color:t.muted},[el('span',{fontWeight:'800',color:t.ink},[nameOf(byline||who)]),el('span',{fontFamily:MONO},[pageNo(index,total)])]));
  },
  cover({title:main,subtitle:sub,image,byline,stats,total,width,height}){
   who=byline;
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'16px 16px 14px'});
   if(image)page.append(coverImg(image,{height:Math.round(height*0.6)+'px',flexShrink:'0',borderRadius:'6px',border:`1px solid ${t.rule}`}));
   page.append(deco('h1',{margin:image?'18px 4px 0':'90px 4px 0',fontSize:image?'25px':'34px',lineHeight:'1.32',fontWeight:'900',color:t.ink,textAlign:'left',...BALANCE},[main]));
   if(sub)page.append(deco('div',{margin:'8px 4px 0',fontSize:'14px',lineHeight:'1.5',color:t.muted,fontWeight:'500'},[sub]));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'auto 4px 0',fontSize:'9px',color:t.muted},[el('span',{fontWeight:'800',color:t.ink,fontSize:'10.5px'},[nameOf(byline)]),el('span',{fontFamily:MONO},[`${stats.figures} figs · ${stats.minutes} min`])]));
   return page;
  },
 };
}

// 画布 (after the yellow-highlighter AI design notes): warm grey paper, a black tag, a huge sans title
// with a highlighter stroke, and a framed screenshot running off the edge.
const CANVAS={id:'canvas',size:13,leading:1.7,gap:7,refSize:9,refGap:3,paper:'#f1efe9',surface:'#e7e4db',ink:'#141414',body:'#2b2a27',muted:'#7d7a72',rule:'#d9d5ca',accent:'#e9c46a',pad:{top:42,right:24,bottom:34,left:24}};
function canvas(template,opts){
 const t=tokens(template,CANVAS,opts);const {px}=t,hl=stroke(t.accent,'0.36em','-0.24em');
 Object.assign(t,{strongStyle:{fontWeight:'800',...hl}});
 const tag=extra=>({display:'inline-block',background:t.ink,color:t.paper,fontFamily:MONO,fontSize:'8px',lineHeight:'1',letterSpacing:'0.08em',padding:'4px 7px',borderRadius:'4px',...extra});
 const bold=(size,extra)=>({fontSize:px(size),lineHeight:'1.45',fontWeight:'900',color:t.ink,...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.05),lineHeight:'1.68'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'14px 0 9px'},[el('span',tag(),[b.number]),phrased(html(el('h3',bold(1.32,{margin:'6px 0 0',lineHeight:'1.32',textAlign:'left',letterSpacing:'-0.01em'})),b.html,t),hl)]),
  heading:b=>html(el('h4',bold(1.12,{margin:'12px 0 6px'})),b.html,t),
  label:b=>html(el('div',bold(1,{margin:'10px 0 5px'})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',fontSize:px(0.95),lineHeight:'1.6',margin:'0 0 4px',padding:'3px 8px',background:'#ffffff',border:`1px solid ${t.rule}`,borderRadius:'6px'})),b),
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{border:`1.5px solid ${t.ink}`,borderRadius:'10px',overflow:'hidden',background:'#ffffff'},caption:plainCaption(t,{color:t.ink,fontWeight:'600'})}),
  figureMargin:'8px 0 10px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 11px',background:'#ffffff',borderRadius:'8px',border:`1px solid ${t.rule}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>el('header',{margin:'12px 0 8px'},[deco('span',tag(),['REF']),html(el('h3',bold(1.25,{margin:'7px 0 0',lineHeight:'1.35'})),b.html,t)]),
  ref:b=>refEntry(t,b),
  end:null,
  frame(page,{index,total,title}){
   page.append(deco('div',{position:'absolute',top:'14px',left:'0'},[el('span',tag({borderRadius:'0 4px 4px 0',paddingLeft:t.pad.left+'px'}),[splitTitle(title)[0]])]));
   page.append(deco('div',{position:'absolute',bottom:'13px',right:t.pad.right+'px',fontFamily:MONO,fontSize:'8px',color:t.muted},[pageNo(index,total)]));
  },
  cover({title:main,subtitle:sub,image,byline,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'16px 0 14px'});
   page.append(deco('div',{},[el('span',tag({fontSize:'10px',padding:'5px 10px 5px 18px',borderRadius:'0 6px 6px 0'}),[`${nameOf(byline)} · LONG READ`])]));
   page.append(deco('h1',{margin:'18px 18px 0',fontSize:'44px',lineHeight:'1.2',fontWeight:'900',color:t.ink,textAlign:'left',letterSpacing:'-0.02em'},[main]));
   if(sub)page.append(deco('div',{margin:'6px 0 0',paddingLeft:'18px'},[el('span',{fontSize:'30px',lineHeight:'1.3',fontWeight:'900',color:t.ink,...stroke(t.accent,'13px','-9px')},[sub])]));
   if(image)page.append(deco('div',{flex:'1',minHeight:'0',margin:'22px -16px 0 16px',border:`2px solid ${t.ink}`,borderRadius:'14px',overflow:'hidden',background:'#ffffff',position:'relative'},[el('img',{display:'block',width:'100%',height:'100%',objectFit:'cover',objectPosition:'left top'},[],{src:image.src,alt:''}),el('span',{position:'absolute',top:'12px',right:'30px',background:'#ffffff',border:`1.5px solid ${t.ink}`,borderRadius:'6px',padding:'4px 8px',fontSize:'11px',fontWeight:'800',color:t.ink},[`${stats.figures} 张图解`])]));
   else page.append(el('div',{flex:'1'}));
   page.append(deco('div',{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'10px 18px 0'},[el('span',{fontSize:'12px',fontWeight:'800',color:t.ink},[`约 ${stats.minutes} 分钟读完`]),el('span',{fontFamily:MONO,fontSize:'9px',color:t.muted},[`${stats.references} refs →`])]));
   return page;
  },
 };
}

// 手绘 (after 是金三啊's minimal posts): warm off-white paper with a barely visible dot texture, a small quiet
// grey doodle generated for the article (edition illustrations) and one chunky title in a single size.
const DOODLE={id:'doodle',size:13,leading:1.68,gap:7,refSize:9,refGap:3,paper:'#ffffff',backdrop:'#f8f7f3',surface:'#f0efea',ink:'#363636',body:'#3a3a3a',muted:'#8f8f8b',rule:'#e4e3de',accent:'#d39a52',pad:{top:50,right:24,bottom:28,left:24}};
function doodle(template,opts){
 const t=tokens(template,DOODLE,opts);const {px}=t;
 const dots={background:t.backdrop,backgroundImage:`radial-gradient(${mix(t.backdrop,t.ink,0.07)} 0.8px,transparent 0.9px)`,backgroundSize:'14px 14px'};
 const bold=(size,extra)=>({fontSize:px(size),lineHeight:'1.55',fontWeight:'800',color:t.ink,...extra});
 // Filled by the renderer from edition.illustrations: slot -> {src, concept}.
 const art={};
 const sticker=(item,size)=>item.src?deco('div',{width:size+'px',height:size+'px',flexShrink:'0'},[el('img',{display:'block',width:'100%',height:'100%',objectFit:'contain'},[],{src:item.src,alt:''})])
  :deco('div',{width:size+'px',height:size+'px',boxSizing:'border-box',border:`1.5px dashed ${t.muted}`,borderRadius:'16px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',padding:'8px',textAlign:'center',color:t.muted,fontSize:size>100?'11px':'7px',lineHeight:'1.35'},[el('span',{fontWeight:'800',letterSpacing:'0.08em'},['插图待生成']),size>100?el('span',{},[item.concept]):null]);
 return {...t,
  art,
  shell:{...dots,color:t.body,fontFamily:ROUNDED},
  lead:b=>html(el('p',text(t,{color:t.ink,textAlign:'left'})),b.html,t),
  p:b=>html(el('p',text(t,{textAlign:'left'})),b.html,t),
  section(b){const head=el('div',{flex:'1',minWidth:'0'},[el('div',{fontSize:px(0.8),fontWeight:'800',color:t.accent,marginBottom:'2px'},[b.number]),phrased(html(el('h3',bold(1.3,{margin:'0',lineHeight:'1.5',textAlign:'left'})),b.html,t))]);
   const item=art[`section:${b.number}`];return el('header',{margin:'8px 0 10px',display:'flex',alignItems:'flex-end',gap:'10px'},[head,item?sticker(item,46):null])},
  heading:b=>html(el('h4',bold(1.08,{margin:'10px 0 5px'})),b.html,t),
  label:b=>html(el('div',bold(1,{margin:'10px 0 4px'})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',margin:'0 0 6px'})),b),
  figure:(b,image,n)=>figure(t,b,image,n,{frame:{borderRadius:'10px',overflow:'hidden'},caption:plainCaption(t,{textAlign:'center'})}),
  figureMargin:'6px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'8px 12px',background:t.surface,borderRadius:'10px',color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>html(el('h3',bold(1.15,{margin:'8px 0 8px'})),b.html,t),
  ref:b=>refEntry(t,b,{num:{color:t.accent}}),
  end:null,
  frame(page,{index,total,byline}){
   page.append(deco('div',{position:'absolute',top:'18px',left:t.pad.left+'px',right:t.pad.right+'px',display:'flex',alignItems:'center',gap:'9px'},[avatar(nameOf(byline),28,{border:`1.5px solid ${t.ink}`,background:t.paper,color:t.ink}),el('div',{display:'flex',flexDirection:'column',gap:'2px'},[el('span',{fontSize:'12px',fontWeight:'800',color:t.ink,lineHeight:'1.2'},[nameOf(byline)]),el('span',{fontSize:'9.5px',color:t.muted,lineHeight:'1.2'},[[byline?.handle,`${index}/${total}`].filter(Boolean).join(' · ')])])]));
  },
  cover({title:main,lines,illustrations={},width,height}){
   const page=coverPage(t,width,height,{...dots,fontFamily:ROUNDED,position:'relative',padding:'0'});
   const item=illustrations.cover;
   if(item)page.append(deco('div',{position:'absolute',left:'30px',top:Math.round(height*0.16)+'px'},[sticker(item,140)]));
   const type={margin:'0',fontSize:'50px',lineHeight:'60px',fontWeight:'700',color:t.ink,letterSpacing:'0.02em',textAlign:'left'};
   page.append(deco('h1',{position:'absolute',left:'30px',right:'20px',top:Math.round(height*0.52)+'px',...type,...(lines?{}:BALANCE)},lines?lines.map(line=>el('div',{whiteSpace:'nowrap'},[line])):[main]));
   return page;
  },
 };
}

// 分册 (after the 美团 tech series covers): a pale butter cover with a centred title, an outlined pill and
// a Part grid from the sections; inner pages are white with highlighter headings.
const PARTS={id:'parts',size:13,leading:1.76,gap:9,refSize:9,refGap:3,paper:'#ffffff',backdrop:'#fbf4da',surface:'#fdf8e8',ink:'#121212',body:'#2b2b2b',muted:'#777777',rule:'#ece6cf',accent:'#e8bf2e',pad:{top:34,right:22,bottom:32,left:22}};
function parts(template,opts){
 const t=tokens(template,PARTS,opts);const {px}=t,band=stroke(mix(t.accent,t.paper,0.3),'0.5em','-0.36em');
 const bold=(size,extra)=>({fontSize:px(size),lineHeight:'1.45',fontWeight:'900',color:t.ink,...extra});
 const bar={borderLeft:`3px solid ${t.ink}`,paddingLeft:'7px'};
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontWeight:'700'})),b.html,t),
  p:b=>html(el('p',text(t)),b.html,t),
  section:b=>el('header',{margin:'16px 0 10px'},[el('h3',bold(1.35,{margin:'0',textAlign:'left'}),[el('span',{...band,marginRight:'6px'},[b.number]),phrased(html(el('span'),b.html,t),band)])]),
  heading:b=>html(el('h4',bold(1.1,{margin:'12px 0 6px',...bar})),b.html,t),
  label:b=>html(el('div',bold(1,{margin:'10px 0 5px',...bar})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',fontSize:px(0.96),lineHeight:'1.6',margin:'0 0 5px'})),b),
  figure:(b,image,n)=>figure(t,b,image,n,{caption:plainCaption(t,{textAlign:'center'})}),
  figureMargin:'8px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',{margin:'10px 0',padding:'7px 10px',background:t.surface,borderLeft:`3px solid ${t.accent}`,color:t.ink,fontSize:t.size+'px',lineHeight:String(t.leading)}),b.html,t),
  refsHeading:b=>html(el('h3',bold(1.25,{margin:'14px 0 8px',...band})),b.html,t),
  ref:b=>refEntry(t,b),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',top:'16px',left:t.pad.left+'px',width:'18px',height:'3px',background:t.accent}));
   page.append(deco('div',{position:'absolute',bottom:'12px',left:'0',right:'0',textAlign:'center',fontSize:'8px',color:t.muted},[`${index} / ${total}`]));
  },
  cover({title:main,subtitle:sub,points,sections,byline,stats,width,height}){
   const page=coverPage(t,width,height,{background:t.backdrop,fontFamily:SANS,padding:'26px 22px 16px'});
   page.append(deco('div',{position:'absolute',top:'-20px',right:'20px',fontFamily:SERIF,fontSize:'130px',lineHeight:'1',fontWeight:'900',color:mix(t.backdrop,t.accent,0.3)},['”']));
   page.append(deco('div',{position:'relative',textAlign:'center',fontSize:'11px',letterSpacing:'0.2em',color:t.ink},[`· ${nameOf(byline)} ·`]));
   page.append(deco('h1',{position:'relative',margin:'14px 0 0',textAlign:'center',fontSize:'31px',lineHeight:'1.32',fontWeight:'900',color:t.ink,...BALANCE},[main]));
   if(sub)page.append(deco('div',{alignSelf:'center',marginTop:'14px',border:`1.5px solid ${t.ink}`,borderRadius:'999px',padding:'5px 6px 5px 16px',fontSize:'12px',letterSpacing:'0.3em',color:t.ink},[sub]));
   const items=(points.length?points:sections).slice(0,6),odd=items.length%2;
   if(items.length)page.append(deco('div',{display:'grid',gridTemplateColumns:'1fr 1fr',rowGap:'14px',marginTop:'22px',textAlign:'center'},items.map((s,i)=>{const last=odd&&i===items.length-1;return el('div',{gridColumn:last?'1 / span 2':'auto',borderLeft:i%2&&!last?`1px solid ${mix(t.backdrop,t.ink,0.22)}`:'none',padding:'0 6px'},[el('div',{fontSize:'12.5px',fontWeight:'300',color:t.ink,lineHeight:'1.3'},[`part ${i+1}`]),el('div',{fontSize:'14.5px',fontWeight:'800',color:t.ink,lineHeight:'1.4',marginTop:'3px',...BALANCE},[tailOf(s.label)])])})));
   page.append(el('div',{flex:'1'}));
   page.append(optional(deco('div',{fontSize:'12px',lineHeight:'1.8',color:t.body},[`${stats.figures} 张图解 · ${stats.references} 篇参考 · 约 ${stats.minutes} 分钟`])));
   page.append(deco('div',{textAlign:'right',fontSize:'10.5px',color:t.muted,marginTop:'4px'},['左滑查看更多 →']));
   return page;
  },
 };
}

// 大字 (after the huge-type confession posts): white, very large plain text, one keyword on an orange
// block and a picture tucked into the bottom-right corner.
const BIGTYPE={id:'bigtype',size:13.5,leading:1.66,gap:7,refSize:9,refGap:3,paper:'#ffffff',surface:'#f5f5f5',ink:'#111111',body:'#1d1d1d',muted:'#8a8a8a',rule:'#e8e8e8',accent:'#eea56a',pad:{top:30,right:22,bottom:30,left:22}};
function bigtype(template,opts){
 const t=tokens(template,BIGTYPE,opts);const {px}=t,soft=mix(t.accent,t.paper,0.7);
 Object.assign(t,{strongStyle:{fontWeight:'700',background:soft,padding:'0 2px'}});
 const block={background:mix(t.accent,t.paper,0.5),padding:'0 4px'};
 const big=(size,extra)=>({fontSize:px(size),lineHeight:'1.42',fontWeight:'500',color:t.ink,...extra});
 const display=(size,extra)=>big(size,{fontFamily:DISPLAY,fontWeight:'400',letterSpacing:'0.01em',...extra});
 return {...t,
  shell:{background:t.paper,color:t.body,fontFamily:SANS},
  lead:b=>html(el('p',text(t,{color:t.ink,fontSize:px(1.06)})),b.html,t),
  p:b=>html(el('p',text(t,{textAlign:'left'})),b.html,t),
  section:b=>el('header',{margin:'12px 0 8px'},[el('h3',display(1.46,{margin:'0',textAlign:'left'}),[el('span',{...block,marginRight:'6px'},[b.number]),phrased(html(el('span'),b.html,t))])]),
  heading:b=>html(el('h4',big(1.14,{margin:'12px 0 6px',fontWeight:'600'})),b.html,t),
  label:b=>html(el('div',big(1.04,{margin:'10px 0 5px',fontWeight:'600'})),b.html,t),
  pair:b=>keyPair(t,el('p',text(t,{textAlign:'left',margin:'0 0 6px'})),b,{fontWeight:'700',background:soft,padding:'0 2px'}),
  figure:(b,image,n)=>figure(t,b,image,n,{caption:plainCaption(t)}),
  figureMargin:'8px 0 12px',bleed:0,
  quote:b=>html(el('blockquote',big(1.12,{margin:'10px 0',padding:'0 0 0 10px',borderLeft:`4px solid ${t.accent}`})),b.html,t),
  refsHeading:b=>html(el('h3',display(1.4,{margin:'14px 0 8px'})),b.html,t),
  ref:b=>refEntry(t,b),
  end:null,
  frame(page,{index,total}){
   page.append(deco('div',{position:'absolute',bottom:'11px',right:t.pad.right+'px',fontSize:'9px',color:t.muted},[`${index}/${total}`]));
  },
  cover({title:main,subtitle:sub,image,stats,width,height}){
   const page=coverPage(t,width,height,{fontFamily:SANS,padding:'28px 20px 0'});
   const m=main.match(/[A-Za-z][\w+.\- ]*[\u4e00-\u9fff]{0,3}/);
   const words=m?[main.slice(0,m.index),el('span',block,[m[0]]),main.slice(m.index+m[0].length)]:[main];
   const line={margin:'0',fontFamily:DISPLAY,fontSize:'48px',lineHeight:'1.36',fontWeight:'400',color:t.ink,textAlign:'left',letterSpacing:'0.01em',...BALANCE};
   page.append(deco('h1',line,words));
   if(sub)page.append(deco('div',line,[sub]));
   if(image)page.append(deco('div',{position:'absolute',right:'14px',bottom:'16px',width:'148px',borderRadius:'18px',overflow:'hidden',transform:'rotate(3deg)'},[el('img',{display:'block',width:'100%',height:'auto'},[],{src:image.src,alt:''})]));
   page.append(deco('div',{position:'absolute',left:'20px',bottom:'18px',fontSize:'11px',color:t.muted},[`约 ${stats.minutes} 分钟读完`]));
   return page;
  },
 };
}

const THEMES={blueprint,tweet,wireframe,photo,xstyle,canvas,doodle,devlog,plain,parts,bigtype};
const BASES={blueprint:BLUEPRINT,tweet:TWEET,wireframe:WIREFRAME,photo:PHOTO,xstyle:XSTYLE,canvas:CANVAS,doodle:DOODLE,devlog:DEVLOG,plain:PLAIN,parts:PARTS,bigtype:BIGTYPE};
// Retired themes and older WeChat-era layout ids map onto the closest current theme.
const LEGACY={folio:'photo',journal:'photo',essay:'plain',letter:'plain',lab:'devlog',graphite:'devlog',brief:'devlog',wechat:'plain',press:'plain',column:'bigtype',marker:'canvas',note:'tweet'};
const themeKey=layout=>THEMES[layout]?layout:LEGACY[layout]||'blueprint';
// A template is composed of parts: inner pages (layout), cover (cover_layout), colours
// (palette_from) and figure treatment (figure_tone). Unset parts follow the layout.
export function themeFor(template,opts={}){
 template=template||{};const theme=THEMES[themeKey(template.layout)](template,opts);
 if(template.cover_layout&&THEMES[template.cover_layout]&&template.cover_layout!==themeKey(template.layout)){
  const coverTheme=THEMES[template.cover_layout]({...template,palette_from:template.palette_from||themeKey(template.layout)},opts);
  theme.cover=coverTheme.cover;
 }
 return theme;
}
export const THEME_LAYOUTS=Object.keys(THEMES);
