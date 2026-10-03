import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {toPng} from 'html-to-image';
import {articleCover} from './longform-cover';
import {pageSize} from './page-size';
import {articleBlocks,articleSections,articleStats} from './longform-blocks';
import {themeFor,splitTitle,mix} from './longform-themes';
export const PAGE_WIDTH=360,PAGE_HEIGHT=480;
const SPLITTABLE=new Set(['lead','p','quote','list']);
const KEEP_WITH_NEXT=new Set(['section','heading','label','refs-heading']);
// Characters that must not start a line (and therefore a continued page).
const NO_LINE_START=/[，。、；：？！）》」』”’…—\)\],.;:?!%·]/;
const imageRef=src=>/^images\/[a-f0-9]{32}\.png$/.test(src||'')?src:'';
async function resolveImage(src,api,imageMap){const ref=imageRef(src);return {ref,src:ref?imageMap[ref]||(await api('/api/image/preview',{ref})).preview:src}}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
// Pulls a figure toward the theme's tone: a duotone from a softened ink to the paper, blended
// with a little of the original colour ('muted') or fully ('duotone'). Original pixels are kept
// for 'original' and for anything the canvas cannot read.
export async function toneImage(src,theme){
 const mode=theme.figureTone;if(mode==='original'||!src)return src;
 try{
  const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
  const data=g.getImageData(0,0,c.width,c.height),d=data.data;
  const dark=rgb(mix(theme.ink,theme.accent,0.35)),light=rgb(mix(theme.paper,'#ffffff',0.6)),keep=mode==='duotone'?0:0.22;
  for(let i=0;i<d.length;i+=4){const l=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255;
   for(let k=0;k<3;k++){const tone=dark[k]+(light[k]-dark[k])*l;d[i+k]=Math.round(tone*(1-keep)+d[i+k]*keep)}}
  g.putImageData(data,0,0);return c.toDataURL('image/png');
 }catch{return src}
}
function cutAt(node,count){
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let left=count,n;
 while((n=walker.nextNode())){if(left<=n.length)return [n,left];left-=n.length}return [node,node.childNodes.length];
}
function fragment(node,start,end){const range=document.createRange();const [a,ao]=cutAt(node,start),[b,bo]=cutAt(node,end);range.setStart(a,ao);range.setEnd(b,bo);const copy=node.cloneNode(false);copy.append(range.cloneContents());return copy}
// Text that counts as article content: everything except decoration.
export function contentText(node){const copy=node.cloneNode(true);copy.querySelectorAll('[data-deco]').forEach(d=>d.remove());return copy.textContent.replace(/\s/g,'')}
function sourceText(body){const div=document.createElement('div');div.innerHTML=DOMPurify.sanitize(marked.parse(body||''));return div}
function shell(theme,width,height){
 const page=document.createElement('article');
 Object.assign(page.style,{boxSizing:'border-box',width:width+'px',height:height+'px',position:'relative',overflow:'hidden',fontSize:theme.size+'px',lineHeight:String(theme.leading),...theme.shell});
 if(theme.sheet){const sheet=document.createElement('div');sheet.dataset.deco='true';Object.assign(sheet.style,theme.sheet);page.append(sheet)}
 const content=document.createElement('div');
 Object.assign(content.style,{position:'absolute',top:theme.pad.top+'px',left:theme.pad.left+'px',right:theme.pad.right+'px',height:(height-theme.pad.top-theme.pad.bottom)+'px',display:'flow-root',overflowWrap:'anywhere'});
 content.dataset.content='true';page.append(content);return {page,content};
}
function buildBlock(theme,block,images,figures){
 const make={lead:theme.lead,p:theme.p,section:theme.section,heading:theme.heading,label:theme.label,pair:theme.pair,quote:theme.quote,'refs-heading':theme.refsHeading,ref:theme.ref}[block.role];
 let node;
 if(block.role==='figure'){node=theme.figure(block,images.get(block),++figures.n);node.style.margin=block.full?`4px -${theme.pad.right}px 8px -${theme.pad.left}px`:theme.figureMargin;if(block.full)node.dataset.full='true'}
 else if(make)node=make(block);
 else{node=document.createElement('div');node.innerHTML=DOMPurify.sanitize(block.html||'');Object.assign(node.style,{margin:`0 0 ${theme.gap}px`,fontSize:theme.size+'px',lineHeight:String(theme.leading),color:theme.body});
  for(const el of node.querySelectorAll('pre,table'))Object.assign(el.style,{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxWidth:'100%',fontSize:'12px',lineHeight:'1.6'});
  for(const a of node.querySelectorAll('a'))Object.assign(a.style,{display:'inline',color:theme.ink,wordBreak:'break-all'})}
 node.dataset.role=block.role;return node;
}
export async function paginateArticle(edition,api,imageMap={}){return (await layoutArticle(edition,api,imageMap)).pages}
// Returns page HTML plus layout metadata (sections, page roles) for verification and fixtures.
// A final page holding only a few references is avoided by tightening the reference list.
export async function layoutArticle(edition,api,imageMap={}){
 const cache={...imageMap},cached=async(path,data)=>{if(path!=='/api/image/preview')return api(path,data);if(!cache[data.ref])cache[data.ref]=(await api(path,data)).preview;return {preview:cache[data.ref]}};
 let result;
 for(let compact=0;compact<=2;compact++){
  result=await layoutOnce(edition,cached,cache,{compact});
  const last=result.meta.pages.at(-1);
  if(!(last.roles.length===1&&last.roles[0]==='ref'&&last.fill<0.35))break;
 }
 return result;
}
async function layoutOnce(edition,api,imageMap,opts){
 const template=edition.template||{},theme=themeFor(template,{...opts,palette:edition.palette}),{width,height}=pageSize(template);
 const blocks=articleBlocks(edition.body);
 const images=new Map();
 for(const b of blocks)if(b.role==='figure'){const r=await resolveImage(b.src,api,imageMap);images.set(b,{...r,src:await toneImage(r.src,theme)})}
 const plan=edition.cover_page||{};
 const coverImage=plan.image?await resolveImage(plan.image,api,imageMap).then(async r=>({...r,src:await toneImage(r.src,theme)})):null;
 // Concept illustrations generated for this article; a slot without an image renders as a marked placeholder.
 const illustrations=Object.fromEntries(await Promise.all((Array.isArray(edition.illustrations)?edition.illustrations:[]).map(async x=>[x.slot,{concept:x.concept||'',src:x.image?(await resolveImage(x.image,api,imageMap)).src:null}])));
 if(theme.art)Object.assign(theme.art,illustrations);
 await document.fonts.ready;
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0',width:width+'px'});document.body.append(host);
 try{
  const figures={n:0},nodes=blocks.map(b=>buildBlock(theme,b,images,figures));
  const endAt=blocks.findIndex(b=>b.role==='refs-heading');
  // The end mark closes the body, so it goes before any page break that precedes the references.
  let endPos=endAt<0?blocks.length:endAt;while(endPos>0&&blocks[endPos-1].role==='break')endPos--;
  if(theme.end){const end=theme.end();end.dataset.role='end';nodes.splice(endPos,0,end);blocks.splice(endPos,0,{role:'end'})}
  await Promise.all(nodes.flatMap(n=>[...n.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))));
  const measure=shell(theme,width,height);host.append(measure.page);
  const pages=[];let current,section=null,sectionIndex=-1;const sectionPages=[];
  const next=()=>{current={...shell(theme,width,height),section,sectionIndex,roles:[]};host.append(current.page);pages.push(current)};
  const bottom=()=>current.content.getBoundingClientRect().bottom;
  const fits=()=>{const last=current.content.lastElementChild;return !last||(last.getBoundingClientRect().bottom<=bottom()+0.5&&current.content.scrollWidth<=current.content.clientWidth+1+Math.max(theme.bleed||0,current.content.querySelector('[data-full]')?theme.pad.right:0))};
  const empty=()=>!current.content.childElementCount;
  const place=node=>{if(empty())node.style.marginTop='0';current.content.append(node);if(fits())return true;node.remove();return false};
  const used=()=>{const last=current.content.lastElementChild;if(!last)return 0;return last.getBoundingClientRect().bottom+parseFloat(getComputedStyle(last).marginBottom||0)-current.content.getBoundingClientRect().top};
  const free=()=>current.content.clientHeight-used();
  const heightOf=node=>{const c=node.cloneNode(true);measure.content.replaceChildren(c);const r=c.getBoundingClientRect(),s=getComputedStyle(c);const h=r.height+parseFloat(s.marginTop)+parseFloat(s.marginBottom);measure.content.replaceChildren();return h};
  const lineOf=node=>{const c=node.cloneNode(false);c.textContent='字';measure.content.replaceChildren(c);const s=getComputedStyle(c),h=parseFloat(s.lineHeight)||parseFloat(s.fontSize)*1.7;measure.content.replaceChildren();return h};
  const linesOf=node=>{const c=node.cloneNode(true);c.style.margin='0';measure.content.replaceChildren(c);const s=getComputedStyle(c);const h=c.getBoundingClientRect().height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);measure.content.replaceChildren();return Math.round(h/lineOf(node))};
  // Space the following block needs so a heading/label is never stranded at a page bottom.
  const minNext=i=>{const b=blocks[i],n=nodes[i];if(!b)return 0;
   if(SPLITTABLE.has(b.role)){const h=heightOf(n),two=lineOf(n)*2+parseFloat(getComputedStyle(n).marginTop||0)+4;return Math.min(h,two)}
   if(b.role==='figure')return heightOf(n)*0.72;
   if(KEEP_WITH_NEXT.has(b.role))return heightOf(n)+minNext(i+1);
   return heightOf(n)};
  const imageHeight=node=>{const c=node.cloneNode(true);measure.content.replaceChildren(c);const h=c.querySelector('img')?.getBoundingClientRect().height||0;measure.content.replaceChildren();return h};
  const shrinkFigure=(node,room,floor=0.85)=>{const img=node.querySelector('img');if(!img)return false;const cap=img.style.maxHeight,full=imageHeight(node);if(full<40)return false;
   for(let k=0.97;k>=floor-0.001;k-=0.03){img.style.maxHeight=Math.floor(full*k)+'px';if(heightOf(node)<=room)return true}img.style.maxHeight=cap;return false};
  const capFigure=node=>{const img=node.querySelector('img');if(img)img.style.maxHeight=Math.round(current.content.clientHeight*(node.dataset.full?0.8:0.62))+'px'};
  // Text after a figure up to an authored page break belongs on the figure's page.
  const segmentRest=i=>{let h=0;for(let j=i+1;j<blocks.length;j++){const r=blocks[j].role;if(r==='break')return h;if(r==='figure'||r==='refs-heading')return null;if(r!=='end')h+=heightOf(nodes[j])}return null};
  // Reading order is strict: figures stay exactly where the source places them.
  const newPage=next;
  next();
  for(let i=0;i<nodes.length;i++){
   const b=blocks[i],node=nodes[i];
   if(b.role==='break'){if(!empty())newPage();continue}
   if(b.role==='end'){if(!empty())place(node);continue}
   if(b.role==='section'){section={number:b.number,html:b.html};sectionIndex++}
   if(KEEP_WITH_NEXT.has(b.role)){
    if(!empty()&&free()<heightOf(node)+minNext(i+1))newPage();
    if(!place(node)){if(!empty())newPage();if(!place(node))throw Error('标题超出页面，请调小字号；全文未截断')}
    if(b.role==='section'){if(current.content.firstElementChild===node){current.section=section;current.sectionIndex=sectionIndex}sectionPages.push({...section,page:pages.length})}
    current.roles.push(b.role);continue;
   }
   if(b.role==='figure'){
    capFigure(node);
    const rest=segmentRest(i);
    if(rest!==null){const room=free()-rest;if(room>0&&heightOf(node)>room)shrinkFigure(node,room,node.dataset.full?0.72:0.8)}
    if(place(node)){current.roles.push('figure');continue}
    if(!empty()&&shrinkFigure(node,free())&&place(node)){current.roles.push('figure');continue}
    if(!empty())newPage();
    if(place(node)||shrinkFigure(node,current.content.clientHeight)&&place(node)){current.roles.push('figure');continue}
    throw Error('图片超出页面，请调整模板字号或素材尺寸；全文未截断');
   }
   if(!SPLITTABLE.has(b.role)){
    if(place(node)){current.roles.push(b.role);continue}
    if(!empty()){newPage();if(place(node)){current.roles.push(b.role);continue}}
    if(b.role==='ref')throw Error('参考资料条目超出页面；全文未截断');
    if(['table','code','html'].includes(b.role)&&node.querySelector('img,table'))throw Error('有图片或表格超出页面，请调整模板字号或素材尺寸；全文未截断');
   }
   // Text flow: split by characters with orphan, widow and punctuation control.
   const text=node.textContent;let offset=0;
   while(offset<text.length){
    const rest=fragment(node,offset,text.length);
    if(offset)rest.style.marginTop='0';
    if(place(rest)){current.roles.push(b.role);offset=text.length;break}
    let lo=0,hi=text.length-offset;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2),part=fragment(node,offset,offset+mid);if(offset)part.style.marginTop='0';if(place(part)){part.remove();lo=mid}else hi=mid-1}
    const adjust=n=>{let k=n;
     while(k>1&&NO_LINE_START.test(text[offset+k]||''))k--;
     if(/[A-Za-z0-9]/.test(text[offset+k]||'')){let w=k;while(w>1&&/[A-Za-z0-9._\-\/:]/.test(text[offset+w-1]))w--;if(k-w<24&&w>1)k=w}
     if(/[\uD800-\uDBFF]/.test(text[offset+k-1]||''))k--;return k};
    lo=adjust(lo);
    const head=fragment(node,offset,offset+lo);if(offset)head.style.marginTop='0';
    if(lo<=0||linesOf(head)<2){if(!empty()){newPage();continue}if(lo<=0)throw Error('当前模板无法容纳正文，请调小字号')}
    const tailLines=linesOf(fragment(node,offset+lo,text.length)),headLines=linesOf(head);
    if(tailLines<2&&headLines>=3){
     let a=0,z=lo;const target=(headLines-1)*lineOf(node)+1;
     while(a<z){const mid=Math.ceil((a+z)/2),part=fragment(node,offset,offset+mid);part.style.margin='0';measure.content.replaceChildren(part);const s=getComputedStyle(part);const h=part.getBoundingClientRect().height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);measure.content.replaceChildren();if(h<=target)a=mid;else z=mid-1}
     if(a>0)lo=adjust(a);
    }else if(tailLines<2&&!empty()){newPage();continue}
    const part=fragment(node,offset,offset+lo);if(offset)part.style.marginTop='0';
    part.style.marginBottom='0';
    current.content.append(part);
    if(lastLineFill(part)>0.96)part.style.textAlignLast='justify';
    current.roles.push(b.role);offset+=lo;newPage();
   }
  }
  measure.page.remove();
  for(let i=pages.length-1;i>0;i--)if(!pages[i].content.childElementCount)pages.splice(i,1);
  const source=sourceText(edition.body);
  if(contentText(source)!==pages.map(p=>contentText(p.content)).join(''))throw Error('分页内容校验失败，未生成图片');
  const want=[...source.querySelectorAll('img')].map(img=>img.getAttribute('src'));
  const got=pages.flatMap(p=>figuresOf(p.content).map(img=>img.dataset.ref||img.getAttribute('src')));
  if(JSON.stringify(want)!==JSON.stringify(got))throw Error('分页图片顺序或数量校验失败');
  if(pages.some(p=>figuresOf(p.content).some(img=>img.getBoundingClientRect().height<40)))throw Error('有图片未能完整显示，未生成图片');
  const title=edition.title||'',sections=articleSections(blocks),stats=articleStats(edition.body,blocks);
  const offsetCover=1;
  // The cover is read as a feed thumbnail: title and key points only, figures stay on inner pages.
  const legacyCover=template.cover_style?await articleCover(edition,source,width,height):null;
  const total=pages.length+1;
  const content=coverContent(edition,sectionPages),parts=sectionPages.map(s=>({number:s.number,label:sourceTextOf(s.html)}));
  const cover=legacyCover||theme.cover({...content,sections:parts,illustrations,image:coverImage,stats,total,width,height});
  pages.forEach((p,i)=>{delete p.content.dataset.content;theme.frame(p.page,{index:i+2,total,section:p.section,sectionIndex:p.sectionIndex,sectionCount:sections.length,title,byline:content.byline})});
  host.append(cover);
  const overflows=()=>{const bottom=cover.getBoundingClientRect().bottom-parseFloat(getComputedStyle(cover).paddingBottom||0);return [...cover.querySelectorAll('*')].some(c=>!c.closest('[style*="position: absolute"]')&&c.getBoundingClientRect().bottom>bottom+0.5)};
  for(const extra of [...cover.querySelectorAll('[data-cover-optional]')].reverse()){if(legacyCover||!overflows())break;extra.remove()}
  if(!legacyCover&&overflows())throw Error('封面内容超出页面，请缩短标题');
  const html=[cover.outerHTML,...pages.map(p=>p.page.outerHTML)];
  const meta={max_pages:MAX_PAGES,over_limit:html.length>MAX_PAGES,template:{id:template.id,name:template.name,layout:template.layout,page_ratio:template.page_ratio||'3:4'},compact:opts.compact,page_count:html.length,
   sections:sectionPages.map(s=>({number:s.number,title:sourceTextOf(s.html),page:s.page+offsetCover})),
   pages:[{page:1,roles:['cover']},...pages.map((p,i)=>({page:i+2,section:p.section?.number||null,roles:[...new Set(p.roles)],figures:figuresOf(p.content).map(img=>img.dataset.ref),references:p.roles.filter(r=>r==='ref').length,fill:fillOf(p.content),starts:contentText(p.content).slice(0,16)}))]};
  return {pages:html,meta};
 }finally{host.remove()}
}
// Article figures only; decorative illustrations inside data-deco are not body images.
const figuresOf=node=>[...node.querySelectorAll('img')].filter(img=>!img.closest('[data-deco]'));
function fillOf(content){const last=content.lastElementChild;return last?Math.round(Math.min(1,(last.getBoundingClientRect().bottom-content.getBoundingClientRect().top)/content.clientHeight)*100)/100:0}
// Cover text is edition content (cover_page, chosen by the agent); without it, fall back to
// the title split at its colon and the section headings.
function coverContent(edition,sectionPages){
 const plan=edition.cover_page||{},[main,sub]=splitTitle(edition.title||'');
 const points=Array.isArray(plan.points)&&(plan.points.length||edition.cover_page)?plan.points.map((label,i)=>({number:String(i+1).padStart(2,'0'),label:String(label)})):sectionPages.map(s=>({number:s.number,label:sourceTextOf(s.html)}));
 return {title:plan.title||main,subtitle:plan.subtitle??sub,points,byline:plan.byline||null};
}
// Width of a block's last line relative to its text column (0–1).
function lastLineFill(node){
 const range=document.createRange();range.selectNodeContents(node);
 const rects=[...range.getClientRects()].filter(r=>r.width>0);if(!rects.length)return 1;
 const bottom=Math.max(...rects.map(r=>r.bottom)),line=rects.filter(r=>r.bottom>bottom-2);
 const box=node.getBoundingClientRect(),s=getComputedStyle(node);
 const width=box.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);
 return width>0?(Math.max(...line.map(r=>r.right))-Math.min(...line.map(r=>r.left)))/width:1;
}
function sourceTextOf(value){const d=document.createElement('div');d.innerHTML=DOMPurify.sanitize(value||'');return d.textContent}
// Xiaohongshu notes take at most 10 images, cover included.
export const MAX_PAGES=10;
export async function exportArticlePages(pages,api,onProgress=()=>{},{maxPages=MAX_PAGES}={}){
 if(!pages.length)throw Error('请等待分页预览完成');
 if(pages.length>maxPages)throw Error(`小红书笔记最多 ${MAX_PAGES} 张图（含封面），当前 ${pages.length} 页；请精简正文或调整分页后再导出`);
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0'});document.body.append(host);const refs=[];
 try{for(let i=0;i<pages.length;i++){onProgress(`导出第 ${i+1} / ${pages.length} 页`);host.innerHTML=pages[i];await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode()));const png=await toPng(host.firstElementChild,{width:parseFloat(host.firstElementChild.style.width),height:parseFloat(host.firstElementChild.style.height),pixelRatio:3,skipFonts:true});refs.push((await api('/api/upload',{name:`长文第 ${i+1} 页.png`,data:png.split(',')[1]})).ref)}return refs}finally{host.remove()}
}
