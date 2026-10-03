import {toPng} from 'html-to-image';
const color=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
export function cardNode(template,card,index,total,image){
 const accent=color(template?.accent,'#176747');
 const node=document.createElement('article');
 Object.assign(node.style,{boxSizing:'border-box',width:'1080px',height:'1440px',padding:'88px',display:'flex',flexDirection:'column',gap:'40px',background:color(template?.background,'#f2f5ef'),color:'#202723',fontFamily:'"PingFang SC",sans-serif',textAlign:'left'});
 const add=(tag,text,style)=>{const el=document.createElement(tag);el.textContent=text;Object.assign(el.style,{boxSizing:'border-box',margin:'0',flexShrink:'0',...style});node.append(el);return el};
 add('h1',card.title,{fontSize:index===0?'78px':'60px',fontWeight:'700',lineHeight:'1.3',overflowWrap:'anywhere',color:accent});
 if(image){const img=add('img','',{width:'100%',minHeight:'0',flex:'1 1 0px',objectFit:'contain'});img.src=image;img.alt='';}
 add('p',card.text||'',{fontSize:'34px',fontWeight:'400',lineHeight:'1.65',whiteSpace:'pre-wrap',overflowWrap:'anywhere'});
 const footer=add('footer','',{marginTop:'auto',paddingTop:'24px',borderTop:`2px solid ${accent}`,fontSize:'25px',lineHeight:'1.4',color:accent,display:'flex',justifyContent:'space-between'});
 for(const text of [template?.name||'图文',`${index+1} / ${total}`]){const span=document.createElement('span');span.textContent=text;footer.append(span)}
 return node;
}
export async function cardImages(edition,api){
 const refs=[...new Set((edition.cards||[]).map(c=>c.image_ref).filter(Boolean))];
 return Object.fromEntries(await Promise.all(refs.map(async ref=>[ref,(await api('/api/image/preview',{ref})).preview])));
}
export async function exportCards(edition,api,onProgress=()=>{}){
 const images=await cardImages(edition,api),refs=[];
 await document.fonts.ready;
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-12000px',top:'0',pointerEvents:'none'});document.body.append(host);
 try{
  for(let i=0;i<edition.cards.length;i++){
   onProgress(`正在生成图片 ${i+1}/${edition.cards.length}`);
   const card=edition.cards[i],node=cardNode(edition.template,card,i,edition.cards.length,images[card.image_ref]);host.replaceChildren(node);
   await Promise.all([...node.querySelectorAll('img')].map(img=>img.decode()));
   if(node.scrollHeight>1440)throw Error(`第 ${i+1} 页内容溢出，请缩短文字或拆页`);
   const png=await toPng(node,{width:1080,height:1440,pixelRatio:1,skipFonts:true});
   refs.push((await api('/api/upload',{name:`图文卡片 ${i+1}.png`,data:png.split(',')[1]})).ref);
  }
  return refs;
 }finally{host.remove()}
}
