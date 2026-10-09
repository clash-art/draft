import {marked} from 'marked';
import DOMPurify from 'dompurify';
// Typography is applied to a disposable preview, never written back into source text.
export async function longformPreview(edition,api,imageMap={}){
 const doc=new DOMParser().parseFromString(DOMPurify.sanitize(marked.parse(edition.body||'')),'text/html');
 const t=edition.template||{},accent=/^#[0-9a-f]{6}$/i.test(t.accent||'')?t.accent:'#333333';
 for(const p of doc.querySelectorAll('p,li'))Object.assign(p.style,{fontSize:`${t.font_size||16}px`,lineHeight:String(t.line_height||1.85),margin:`0 0 ${t.paragraph_gap||18}px`,overflowWrap:'anywhere'});
 for(const h of doc.querySelectorAll('h1,h2,h3,h4'))Object.assign(h.style,{color:accent,lineHeight:'1.4',margin:'18px 0 9px',fontFamily:['essay','letter','journal','spark'].includes(t.layout)?'"Songti SC",serif':'inherit',textAlign:'left',borderLeft:'none',paddingLeft:'0',borderBottom:t.layout==='lab'?`1px solid ${accent}`:'none',paddingBottom:t.layout==='lab'?'5px':'0',fontSize:'18px'});
 for(const block of doc.querySelectorAll('blockquote'))Object.assign(block.style,{borderLeft:`1px solid ${accent}`,padding:'8px 16px',margin:'20px 0'});
 await Promise.all([...doc.querySelectorAll('img')].map(async img=>{const ref=img.getAttribute('src');if(/^images\/[a-f0-9]{32}\.png$/.test(ref||''))img.src=imageMap[ref]||(await api('/api/image/preview',{ref})).preview;Object.assign(img.style,{maxWidth:'100%',height:'auto',display:'block',margin:'10px auto'})}));
 let references=false;for(const el of doc.body.children){if(/^参考(资料|文献|链接)$/.test(el.textContent.trim()))references=true;else if(references){el.dataset.reference='true';el.style.marginTop='0';el.style.fontSize=`${t.reference_size||13}px`;el.style.lineHeight='1.6';el.style.marginBottom=`${t.reference_gap||8}px`;for(const child of el.querySelectorAll('p,li'))child.style.fontSize='inherit'}}
 for(const a of doc.querySelectorAll('a')){a.style.color=accent;a.style.overflowWrap='anywhere'}
 return DOMPurify.sanitize(doc.body.innerHTML);
}
