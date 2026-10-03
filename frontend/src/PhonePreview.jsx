import React,{useLayoutEffect,useRef,useState} from 'react';
import {ChevronLeft,Search,MoreHorizontal,ThumbsUp,Forward,Heart,MessageSquare,BookOpen} from 'lucide-react';
import {MagicIphone} from './vendor/MagicIphone';
import './PhonePreview.css';

// Magic UI provides a generic iPhone frame, not model-specific hardware assets.
export const PHONE_MODELS=[
 {value:'iphone',label:'iPhone · 标准屏',width:390,height:844},
 {value:'iphone-large',label:'iPhone · 大屏',width:430,height:932},
];
export function StatusBar({android}){
 return <div className={'wechat-status '+(android?'status-android':'status-ios')} aria-label="模拟状态栏：9:41，电量 100%">
  <span className="status-time">9:41</span><div className="status-connectivity">
   <svg className="status-signal" viewBox="0 0 20 16" aria-hidden="true">{[6,9,12,15].map((h,i)=><rect key={h} x={i*5} y={16-h} width="3.5" height={h} rx="1" fill="currentColor"/>)}</svg>
   <span className="status-network">5G</span>
   {android?<><span className="status-percent">100%</span><svg className="status-battery-android" viewBox="0 0 12 20" aria-hidden="true"><path d="M4 0h4v2h3v18H1V2h3Z" fill="currentColor"/></svg></>:<svg className="status-battery" viewBox="0 0 30 16" aria-hidden="true"><rect x="0" y="1" width="26" height="14" rx="4" fill="currentColor"/><path d="M28 5v6q2-1 2-3t-2-3" fill="currentColor" opacity=".4"/><text x="13" y="11.5" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" stroke="none">100</text></svg>}
  </div>
 </div>
}
export default function PhonePreview({model=PHONE_MODELS[0],html,previewKey}) {
 const {width,height}=model;
 // Only our scroll indicator runs; article HTML is sanitized before reaching this
 // isolated iframe, which has no same-origin, navigation, or form permissions.
 const scrollingHtml=html+`<style>#preview-scroll-indicator{position:fixed;right:3px;top:0;width:3px;border-radius:3px;background:rgba(0,0,0,.32);opacity:0;pointer-events:none;z-index:2147483647;transition:opacity .22s ease}</style><div id="preview-scroll-indicator" aria-hidden="true"></div><script>(function(){
 const bar=document.getElementById('preview-scroll-indicator');let timer;
 function update(show){const doc=document.scrollingElement;const view=window.innerHeight;const total=doc.scrollHeight;const range=total-view;if(range<=1){bar.style.opacity='0';return}const size=Math.max(28,view*view/total);const top=3+(view-size-6)*doc.scrollTop/range;bar.style.height=size+'px';bar.style.transform='translateY('+top+'px)';if(show){bar.style.opacity='1';clearTimeout(timer);timer=setTimeout(()=>bar.style.opacity='0',750)}}
 addEventListener('scroll',()=>update(true),{passive:true});addEventListener('resize',()=>update(false));update(false);
 })();<\/script>`;
 const stage=useRef(null),[scale,setScale]=useState(1);
 useLayoutEffect(()=>{const el=stage.current;const fit=()=>{const frame=el.querySelector('.magic-phone');if(frame)setScale(Math.min(1,(el.clientWidth-16)/frame.offsetWidth,(el.clientHeight-8)/frame.offsetHeight))};const observer=new ResizeObserver(fit);observer.observe(el);fit();return()=>observer.disconnect()},[width,height]);
 return <div ref={stage} className="wechat-device-stage"><div className="wechat-device" style={{'--screen-width':`${width}px`,'--screen-height':`${height}px`,transform:`translateX(-50%) scale(${scale})`}}>
  <MagicIphone key={model.value} width={width} height={height}><div className="wechat-screen">
   <StatusBar android={false}/>
   <div className="wechat-navigation" aria-label="微信导航外观预览"><ChevronLeft/><div><Search/><MoreHorizontal/></div></div>
   <iframe key={previewKey} title="模板排版预览" className="wechat-article-frame" sandbox="allow-scripts" srcDoc={scrollingHtml}/>
   <div className="wechat-reading-footer" aria-label="微信互动栏外观预览"><span className="wechat-account-avatar"><BookOpen/></span><strong>公众号</strong><div className="wechat-reading-actions">{[[ThumbsUp,'赞'],[Forward,'分享'],[Heart,'喜欢'],[MessageSquare,'留言']].map(([Icon,label])=><span key={label}><Icon/><small>{label}</small></span>)}</div></div>
   <div className="wechat-home-indicator" aria-hidden="true"><span/></div>
  </div></MagicIphone>
 </div></div>
}
