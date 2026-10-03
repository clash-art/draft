import React,{useEffect,useState,useRef} from 'react';
import {cardNode,cardImages} from './xhs-render';
function Card({edition,index,images}){
 const ref=useRef();
 useEffect(()=>{const host=ref.current,card=edition.cards[index];if(!card)return;const node=cardNode(edition.template,card,index,edition.cards.length,images[card.image_ref]);host.replaceChildren(node);const resize=()=>{node.style.transform=`scale(${host.clientWidth/1080})`;node.style.transformOrigin='top left'};const observer=new ResizeObserver(resize);observer.observe(host);resize();return()=>observer.disconnect()},[edition,index,images]);
 return <div ref={ref} style={{width:'100%',aspectRatio:'3/4',overflow:'hidden'}}/>;
}
export default function XhsPreview({edition,imageMap,api}){
 const[index,setIndex]=useState(0),[loaded,setLoaded]=useState({});
 useEffect(()=>{let active=true;setIndex(0);Promise.all(edition.images.map(async ref=>{if(imageMap[ref])return [ref,imageMap[ref]];try{return [ref,(await api('/api/image/preview',{ref})).preview]}catch{return [ref,null]}})).then(a=>{if(active)setLoaded(Object.fromEntries(a))});return()=>{active=false}},[edition.images.join('|'),imageMap]);
 const [sources,setSources]=useState({});
 useEffect(()=>{let active=true;cardImages(edition,api).then(v=>{if(active)setSources(v)}).catch(()=>{});return()=>{active=false}},[edition.cards,api]);
 const pages=edition.cards?.length?edition.cards:edition.images;
 const current=edition.images[index];
 return <div className="xhs-note-preview"><div><div className="xhs-image-stage">{edition.cards?.length?<Card edition={edition} index={Math.min(index,pages.length-1)} images={sources}/>:current&&loaded[current]?<img src={loaded[current]} alt={`笔记第 ${index+1} 页`}/>:<div className="xhs-image-empty"><strong>{current?'图片未能读取':'等待生成图文卡片'}</strong><p>选择图片模板，让 Agent 编排封面、内容页与结尾页。</p></div>}</div><div className="xhs-page-strip">{pages.map((ref,i)=><button key={i} aria-label={`查看第 ${i+1} 页`} aria-pressed={i===index} onClick={()=>setIndex(i)}>{loaded[ref]?<img src={loaded[ref]} alt=""/>:<span>{i+1}</span>}</button>)}</div><p className="muted">{pages.length?`${index+1} / ${pages.length} · 首张为封面`:'3:4 图片 · 按顺序阅读'}</p></div><div className="xhs-caption"><small className="muted">笔记标题与配文</small>{edition.revision?<><h2>{edition.title}</h2><p>{edition.body}</p></>:<p className="muted">尚未生成小红书版本。原稿不会作为长文预览直接套用到笔记。</p>}</div></div>
}
