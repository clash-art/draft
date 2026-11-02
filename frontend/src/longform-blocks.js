import {marked} from 'marked';
import DOMPurify from 'dompurify';
// Classifies the source Markdown into layout blocks. Every block keeps its original
// text; layout only decides grouping (section number + heading, image + caption).
const REFERENCES=/^参考(资料|文献|链接)$/;
// `<!-- page -->` on its own line starts a new page (used by condensed, figure-led editions).
// `![说明](图片 "full")` marks a dense diagram for an edge-to-edge plate; the edition decides which.
const PAGE_BREAK=/^\s*<!--\s*page\s*-->\s*$/;
const unescape=s=>String(s||'').replace(/\\([\\`*_{}\[\]()#+\-.!|~<>])/g,'$1');
const norm=s=>unescape(s).replace(/\s+/g,'').trim();
const inline=text=>marked.parseInline(text||'');
function onlyChild(token){const kids=(token.tokens||[]).filter(t=>!(t.type==='text'&&!t.text.trim())&&t.type!=='br');return kids.length===1?kids[0]:null}
// RichEditor saves HTML. Recover semantic flow blocks before measuring, rather
// than treating the whole saved document as one unsplittable HTML element.
export function htmlArticleBlocks(html){
 const safe=String(html).replace(/<!--\s*page\s*-->/g,'<hr data-page-break="true">');
 const doc=new DOMParser().parseFromString(DOMPurify.sanitize(safe),'text/html'),blocks=[];
 let lead=false,references=false;
 const paragraph=html=>{const el=doc.createElement('div');el.innerHTML=html;if(!el.textContent.trim()&&!el.querySelector('img,table'))return;blocks.push({role:references?'ref':lead?'p':'lead',html});lead=true};
 const walk=node=>{
  if(node.nodeType===3){if(node.textContent.trim())paragraph(node.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;'));return}
  if(node.nodeType===8){if(PAGE_BREAK.test(`<!--${node.textContent}-->`))blocks.push({role:'break'});return}
  if(node.nodeType!==1)return;
  const tag=node.tagName;
  if(tag==='HR'&&node.hasAttribute('data-page-break')){blocks.push({role:'break'});return}
  if(/^H[1-6]$/.test(tag)){references=REFERENCES.test(norm(node.textContent));blocks.push({role:references?'refs-heading':'heading',level:Number(tag[1]),html:node.innerHTML});return}
  if(tag==='UL'||tag==='OL'){
   [...node.children].filter(n=>n.tagName==='LI').forEach((li,i)=>{if(!li.textContent.trim()&&!li.querySelector('img'))return;const list=node.cloneNode(false);if(tag==='OL')list.setAttribute('start',String(Number(node.getAttribute('start')||1)+i));list.append(li.cloneNode(true));blocks.push({role:'list',listItem:true,html:list.outerHTML})});return;
  }
  if(tag==='IMG'){blocks.push({role:'figure',src:node.getAttribute('src'),alt:node.getAttribute('alt')||'',caption:'',full:node.getAttribute('title')==='full'});return}
  if(tag==='FIGURE'){
   const imgs=node.querySelectorAll('img'),caption=node.querySelector('figcaption');
   if(imgs.length===1&&node.textContent.replace(caption?.textContent||'','').trim()===''){walk(imgs[0]);blocks.at(-1).caption=caption?.innerHTML||'';return}
  }
  if(['SECTION','DIV','MAIN','ARTICLE','FIGURE'].includes(tag)){[...node.childNodes].forEach(walk);return}
  if(tag==='P'){
   // Range preserves inline emphasis and hyperlinks on either side of images.
   let range=doc.createRange();range.setStart(node,0);
   for(const img of node.querySelectorAll('img')){range.setEndBefore(img);const box=doc.createElement('div');box.append(range.cloneContents());paragraph(box.innerHTML);walk(img);range=doc.createRange();range.setStartAfter(img)}
   range.setEnd(node,node.childNodes.length);const box=doc.createElement('div');box.append(range.cloneContents());paragraph(box.innerHTML);return;
  }
  const role={BLOCKQUOTE:'quote',PRE:'code',TABLE:'table',HR:'hr'}[tag];
  if(role){blocks.push({role,html:node.outerHTML});return}
  paragraph(node.outerHTML);
 };
 [...doc.body.childNodes].forEach(walk);
 for(let i=0;i<blocks.length-1;i++)if(['lead','p'].includes(blocks[i].role)&&blocks[i+1].role==='heading'){
  const label=doc.createElement('div');label.innerHTML=blocks[i].html;
  if(/^\d{1,2}$/.test(label.textContent.trim()))blocks.splice(i,2,{role:'section',number:label.textContent.trim(),html:blocks[i+1].html});
 }
 for(let i=0;i<blocks.length-1;i++)if(blocks[i].role==='figure'&&['lead','p'].includes(blocks[i+1].role)){
  const cap=doc.createElement('div');cap.innerHTML=blocks[i+1].html;
  if(norm(blocks[i].alt)&&norm(cap.textContent)===norm(blocks[i].alt)){blocks[i].caption=blocks[i+1].html;blocks.splice(i+1,1)}
 }
 return blocks;
}
export function parseReference(text){
 const m=unescape(text).trim().match(/^(〔\d+〕|\[\d+\]|［\d+］|\d+[.、])\s*([\s\S]*?)\s*(https?:\/\/\S+|(?:[\w-]+\.)+[a-z]{2,}\/\S*)?\s*$/);
 if(!m)return null;
 return {number:m[1],name:m[2].replace(/\s+/g,' ').trim(),url:m[3]||''};
}
export function articleBlocks(markdown){
 if(typeof DOMParser!=='undefined'&&/^\s*<(?:!doctype|html|body|section|div|main|article|p|h[1-6]|ul|ol|blockquote|figure|img|table|pre|hr)\b/i.test(markdown||''))return htmlArticleBlocks(markdown);
 const tokens=marked.lexer(markdown||'').filter(t=>t.type!=='space');
 const blocks=[];let references=false,lead=false;
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],next=tokens[i+1],prev=blocks[blocks.length-1];
  if(t.type==='html'&&PAGE_BREAK.test(t.text)){blocks.push({role:'break'});continue}
  if(t.type==='heading'){
   if(REFERENCES.test(norm(t.text))){references=true;blocks.push({role:'refs-heading',html:inline(t.text)});continue}
   blocks.push({role:'heading',level:t.depth,html:inline(t.text)});continue;
  }
  if(references&&t.type==='paragraph'){const ref=parseReference(t.text);blocks.push(ref?{role:'ref',...ref}:{role:'ref',html:inline(t.text)});continue}
  if(references){blocks.push({role:'ref',html:marked.parser([t])});continue}
  if(t.type==='paragraph'){
   const text=t.text.trim(),child=onlyChild(t);
   if(/^\d{1,2}$/.test(text)&&next?.type==='heading'&&!REFERENCES.test(norm(next.text))){blocks.push({role:'section',number:text,html:inline(next.text)});i++;continue}
   if(child?.type==='image'){
    const caption=next?.type==='paragraph'&&norm(next.text)===norm(child.text)&&norm(next.text)?next:null;
    blocks.push({role:'figure',src:child.href,alt:unescape(child.text),caption:caption?inline(caption.text):'',full:child.title==='full'});if(caption)i++;continue;
   }
   if(child?.type==='strong'&&norm(text).length<=30&&next?.type==='paragraph'){blocks.push({role:'label',html:inline(text)});continue}
   const pair=text.match(/^([^：:\s][^：:\n]{0,23}[：:])([\s\S]+)$/);
   if(pair&&(prev?.role==='label'||prev?.role==='pair')){blocks.push({role:'pair',key:inline(pair[1]),html:inline(pair[2])});continue}
   blocks.push({role:lead?'p':'lead',html:inline(t.text)});lead=true;continue;
  }
  if(t.type==='list'){
   t.items.forEach((item,index)=>blocks.push({role:'list',listItem:true,html:marked.parser([{...t,items:[item],start:t.ordered?Number(t.start||1)+index:t.start}])}));
   continue;
  }
  const role={blockquote:'quote',code:'code',table:'table',hr:'hr',html:'html'}[t.type]||'p';
  blocks.push({role,html:marked.parser([t])});
 }
 return blocks;
}
export function articleSections(blocks){return blocks.filter(b=>b.role==='section').map(b=>({number:b.number,html:b.html}))}
// Reading stats for decorative cover metadata: CJK characters plus Latin words, before references.
export function articleStats(markdown,blocks=articleBlocks(markdown)){
 const body=unescape(String(markdown||'').split(/^#{1,6}\s*参考(资料|文献|链接)\s*$/m)[0]).replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/https?:\/\/\S+/g,'');
 const cjk=(body.match(/[\u3400-\u9fff]/g)||[]).length,words=(body.match(/[A-Za-z0-9][A-Za-z0-9.+\-_]*/g)||[]).length;
 const chars=cjk+words;
 return {chars,minutes:Math.max(1,Math.round(chars/400)),figures:blocks.filter(b=>b.role==='figure').length,references:blocks.filter(b=>b.role==='ref').length};
}
