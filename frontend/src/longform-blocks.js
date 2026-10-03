import {marked} from 'marked';
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
export function parseReference(text){
 const m=unescape(text).trim().match(/^(〔\d+〕|\[\d+\]|［\d+］|\d+[.、])\s*([\s\S]*?)\s*(https?:\/\/\S+|(?:[\w-]+\.)+[a-z]{2,}\/\S*)?\s*$/);
 if(!m)return null;
 return {number:m[1],name:m[2].replace(/\s+/g,' ').trim(),url:m[3]||''};
}
export function articleBlocks(markdown){
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
  const role={blockquote:'quote',list:'list',code:'code',table:'table',hr:'hr',html:'html'}[t.type]||'p';
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
