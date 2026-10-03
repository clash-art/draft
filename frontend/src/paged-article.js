import {articleCover} from './longform-cover';
import {pageSize} from './page-size';
import {toPng} from 'html-to-image';
import {longformPreview} from './longform-preview';
export const PAGE_WIDTH=360,PAGE_HEIGHT=480;
function pageShell(template={}){
 const {width,height}=pageSize(template);const page=document.createElement('article');
 Object.assign(page.style,{boxSizing:'border-box',width:width+'px',height:height+'px',padding:'18px 18px 30px',background:['essay','letter','journal'].includes(template.layout)?'#faf8f2':'#fff',color:'#252525',position:'relative',fontFamily:'"PingFang SC",sans-serif',fontSize:`${template.font_size||14}px`,lineHeight:String(template.line_height||1.65),overflow:'hidden'});
 const content=document.createElement('div');Object.assign(content.style,{height:(height-48)+'px',display:'flow-root',overflowWrap:'anywhere'});page.append(content);return {page,content};
}
function cutAt(node,count){
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let left=count,n;
 while((n=walker.nextNode())){if(left<=n.length)return [n,left];left-=n.length}return [node,node.childNodes.length];
}
function fragment(node,start,end){const range=document.createRange();const [a,ao]=cutAt(node,start),[b,bo]=cutAt(node,end);range.setStart(a,ao);range.setEnd(b,bo);const copy=node.cloneNode(false);copy.append(range.cloneContents());return copy}
export async function paginateArticle(edition,api,imageMap={}){
 const html=await longformPreview(edition,api,imageMap);
 const source=document.createElement('div');source.innerHTML=html;
 const title=document.createElement('h1');title.textContent=edition.title;Object.assign(title.style,{fontSize:'23px',lineHeight:'1.35',margin:'0 0 16px',fontFamily:['essay','journal'].includes(edition.template?.layout)?'"Songti SC",serif':'inherit',color:edition.template?.accent||'#333'});source.prepend(title);
 for(const img of source.querySelectorAll('img')){img.style.maxHeight=Math.min(310,pageSize(edition.template).height-100)+'px';img.style.objectFit='contain';await img.decode()}
 for(const el of source.querySelectorAll('pre,table')){el.style.whiteSpace='pre-wrap';el.style.overflowWrap='anywhere';el.style.maxWidth='100%';el.style.fontSize='12px'}
 await document.fonts.ready;
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0',width:'360px'});document.body.append(host);
 const pages=[];let current;
 const next=()=>{current=pageShell(edition.template);host.replaceChildren(current.page);pages.push(current.page)};
 const fits=()=>[...current.content.children].every(n=>n.getBoundingClientRect().bottom<=current.content.getBoundingClientRect().bottom+0.5)&&current.content.scrollWidth<=current.content.clientWidth+1;
 const tryNode=node=>{current.content.append(node);if(fits())return true;node.remove();return false};
 try{
  next();const blocks=[...source.childNodes].filter(n=>n.nodeType===1||n.textContent.trim());
  for(let i=0;i<blocks.length;i++){
   let block=blocks[i];if(block.nodeType!==1){const p=document.createElement('p');p.textContent=block.textContent;block=p}
   // Keep a heading with the following block, and an image with its caption when they fit together.
   if(i+1<blocks.length&&( /^H[1-6]$/.test(block.tagName)||block.querySelector('img'))){
    const group=document.createElement('div');group.append(block.cloneNode(true),blocks[i+1].cloneNode(true));
    if(tryNode(group)){i++;continue}
    if(current.content.childNodes.length){const probe=pageShell(edition.template);host.append(probe.page);probe.content.append(group);const rect=group.getBoundingClientRect();const ok=rect.bottom<=probe.content.getBoundingClientRect().bottom;probe.page.remove();if(ok){next();tryNode(group);i++;continue}}
   }
   if(tryNode(block.cloneNode(true)))continue;
   if(current.content.childNodes.length&&(block.querySelector('img')||block.tagName==='IMG'||block.tagName==='TABLE'||block.dataset.reference==='true'||/^H[1-6]$/.test(block.tagName))){next();if(tryNode(block.cloneNode(true)))continue}
   if(block.querySelector('img')||block.tagName==='IMG'||block.tagName==='TABLE')throw Error('有图片或表格超出页面，请调整模板字号或素材尺寸；全文未截断');
   const text=block.textContent;let offset=0;
   while(offset<text.length){
    let lo=0,hi=text.length-offset;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2),part=fragment(block,offset,offset+mid);if(tryNode(part)){part.remove();lo=mid}else hi=mid-1}
    if(!lo){if(current.content.childNodes.length){next();continue}throw Error('当前模板无法容纳正文，请调小字号')}
    // Do not break a UTF-16 surrogate pair.
    if(lo<text.length-offset&&/[\uD800-\uDBFF]/.test(text[offset+lo-1]))lo--;
    const part=fragment(block,offset,offset+lo);current.content.append(part);offset+=lo;if(offset<text.length)next();
   }
  }
  for(let i=pages.length-1;i>0;i--)if(!pages[i].firstChild.textContent.trim()&&!pages[i].querySelector('img,table,hr'))pages.splice(i,1);
  const originals=source.textContent.replace(/\s/g,''),result=pages.map(p=>p.firstChild.textContent).join('').replace(/\s/g,'');
  if(originals!==result)throw Error('分页内容校验失败，未生成图片');
  const originalImages=[...source.querySelectorAll('img')].map(img=>img.getAttribute('src'));
  const renderedImages=pages.flatMap(p=>[...p.querySelectorAll('img')].map(img=>img.getAttribute('src')));
  if(JSON.stringify(originalImages)!==JSON.stringify(renderedImages))throw Error('分页图片顺序或数量校验失败');
  pages.forEach((p,i)=>{const f=document.createElement('footer');const label=document.createElement('span');label.textContent=edition.title;Object.assign(label.style,{overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',maxWidth:'245px'});const number=document.createElement('span');number.textContent=`${i+1} / ${pages.length}`;f.append(label,number);Object.assign(f.style,{position:'absolute',bottom:'10px',right:'22px',left:'22px',display:'flex',justifyContent:'space-between',gap:'12px',borderTop:'1px solid #d9d6cf',paddingTop:'6px',fontSize:'9px',lineHeight:'12px',color:'#68655f'});p.append(f)});
  const {width,height}=pageSize(edition.template);const cover=await articleCover(edition,source,width,height);if(cover)pages.unshift(cover);
  return pages.map(p=>p.outerHTML);
 }finally{host.remove()}
}
export async function exportArticlePages(pages,api,onProgress=()=>{}){
 if(!pages.length)throw Error('请等待分页预览完成');
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0'});document.body.append(host);const refs=[];
 try{for(let i=0;i<pages.length;i++){onProgress(`导出第 ${i+1} / ${pages.length} 页`);host.innerHTML=pages[i];await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode()));const png=await toPng(host.firstElementChild,{width:parseFloat(host.firstElementChild.style.width),height:parseFloat(host.firstElementChild.style.height),pixelRatio:3,skipFonts:true});refs.push((await api('/api/upload',{name:`长文第 ${i+1} 页.png`,data:png.split(',')[1]})).ref)}return refs}finally{host.remove()}
}
