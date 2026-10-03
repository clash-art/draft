import React,{useState,useEffect} from 'react';
import {Segments,Button} from './ui';
import {MagicIphone} from './vendor/MagicIphone';
import {StatusBar} from './PhonePreview';
import {ChevronLeft,MoreHorizontal} from 'lucide-react';
export default function PagedArticle({pages,busy}){
 const [mode,setMode]=useState('overview'),[index,setIndex]=useState(0);
 const height=Number(pages[index]?.match(/height:\s*(\d+)px/)?.[1]||480),scale=Math.min(1,480/height);
 useEffect(()=>setIndex(i=>Math.min(i,Math.max(0,pages.length-1))),[pages.length]);
 return <div className="paged-article"><div className="paged-controls"><p className="muted">{busy?'正在分页…':`${pages.length} 页 · HTML 预览`}</p><Segments value={mode} onChange={setMode} options={[{value:'overview',label:'分页总览'},{value:'phone',label:'手机预览'}]}/></div>{mode==='overview'?<div className="paged-article-grid">{pages.map((html,i)=><div key={i} className="paged-article-page" aria-label={`第 ${i+1} 页`} dangerouslySetInnerHTML={{__html:html}}/>)}</div>:<div className="xhs-phone-stage"><MagicIphone width={360} height={780}><div className="xhs-phone-screen"><StatusBar/><div className="xhs-phone-navigation"><ChevronLeft/><span>图文预览</span><MoreHorizontal/></div><div className="xhs-phone-page"><div style={{width:360,height,transform:`scale(${scale})`,transformOrigin:'top center',margin:'0 auto'}} aria-label={`手机预览第 ${index+1} 页`} dangerouslySetInnerHTML={{__html:pages[index]||''}}/></div><div className="xhs-phone-pagination"><Button disabled={!index||busy} onClick={()=>setIndex(index-1)}>上一页</Button><span>{pages.length?index+1:0} / {pages.length}</span><Button disabled={index>=pages.length-1||busy} onClick={()=>setIndex(index+1)}>下一页</Button></div><p className="xhs-phone-caption">HTML 预览 · 导出内容与此一致</p></div></MagicIphone></div>}</div>;
}
