import React from 'react';
import {createRoot} from 'react-dom/client';
import {App,PostMessageTransport,applyHostStyleVariables} from '@modelcontextprotocol/ext-apps';
import Workbench from './Workbench';
import {setHostTransport} from './api';
import {mcpHost,callHostTool,requestWorkbenchDisplay} from './host-bridge';

const root=createRoot(document.getElementById('root'));
// Keep diagnostics outside React so a failed Workbench render cannot hide them.
const diagnostics=document.createElement('details');
diagnostics.setAttribute('aria-label','宿主连接诊断');
diagnostics.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2147483647;max-width:480px;max-height:40vh;overflow:auto;background:#fff;color:#292929;border:1px solid #ddd;border-radius:8px;padding:8px 12px;font:12px/1.6 system-ui;box-shadow:0 2px 12px #0001';
const diagnosticTitle=document.createElement('summary');diagnosticTitle.textContent='正在连接宿主';
const diagnosticBody=document.createElement('pre');diagnosticBody.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0';
diagnostics.append(diagnosticTitle,diagnosticBody);document.body.append(diagnostics);
const diagnosticEvents=[];
function diagnostic(stage,error){
 diagnosticEvents.push(`${new Date().toLocaleTimeString()} ${stage}${error?': '+String(error.message||error):''}`);
 diagnosticBody.textContent=diagnosticEvents.slice(-12).join('\n');
 diagnosticTitle.textContent=error?'宿主连接异常 · 展开详情':stage;
 if(error)diagnostics.open=true;
}
diagnostic('页面已启动');
window.addEventListener('error',event=>diagnostic('页面运行失败',event.message));
window.addEventListener('unhandledrejection',event=>diagnostic('未处理的请求失败',event.reason));
const app=window.parent!==window?new App({name:'微信内容工作台',version:'1.0.0'},{availableDisplayModes:['fullscreen','inline']},{autoResize:true}):null;
const externalWrites=new Set(['/api/pending/sync','/api/channels/login','/api/channels/prepare']);
let ready=false,mounted=false,displayBusy=false;
const fullscreenButton=document.createElement('button');
fullscreenButton.textContent='全屏打开';
fullscreenButton.style.cssText='margin:6px 0;padding:6px 14px;border:0;border-radius:6px;background:#07c160;color:white;cursor:pointer;font:inherit';
diagnostics.prepend(fullscreenButton);
async function enterFullscreen(){
 if(displayBusy)return;
 displayBusy=true;
 try{
  const display=await requestWorkbenchDisplay(ready?app:null,window);
  fullscreenButton.hidden=display.actualMode==='fullscreen';
  diagnostic(display.actualMode==='fullscreen'?'已进入全屏':'请求全屏 · '+display.actualMode,display.error);
  void report('connected',display);
 }finally{displayBusy=false}
}
fullscreenButton.addEventListener('click',enterFullscreen);
const call=(name,args)=>callHostTool(ready?app:null,window,name,args);
const report=async(event,display={})=>{try{await call('content_app_channel',{path:'/api/app/host-event',data:{event,message_supported:!!mcpHost(ready?app:null,window).sendToAgent,...display}});diagnostic(event==='message_accepted'?'宿主已接受消息':event==='message_failed'?'消息发送失败，回执已记录':'宿主工具已连通')}catch(error){diagnostic('宿主回执调用失败',error)}};
function mount(){
 if(!ready&&typeof window.openai?.callTool!=='function')return;
 mounted=true;
 setHostTransport((path,data)=>call(externalWrites.has(path)?'content_workbench_external':'content_workbench_local',{path,data:data??{}}));
 const host=mcpHost(ready?app:null,window);
 if(host.sendToAgent){const send=host.sendToAgent;host.sendToAgent=async text=>{try{await send(text);void report('message_accepted')}catch(error){void report('message_failed');throw error}}}
 root.render(<Workbench host={host}/>);
 diagnostic('工作台已挂载，正在验证宿主工具');
 void report('connected');
 void enterFullscreen();
}
root.render(<p role="status">正在连接工作台与当前会话…</p>);
window.addEventListener('openai:set_globals',mount);
mount();
const timer=setTimeout(()=>{if(!mounted){diagnostic('等待宿主超时',new Error('未收到 MCP 握手，且没有 window.openai.callTool'));root.render(<p role="alert">宿主尚未建立工作台连接，请查看右下角连接诊断。</p>)}},10000);
if(app){
 app.ontoolresult=()=>{};
 app.onhostcontextchanged=ctx=>{if(ctx.styles?.variables)applyHostStyleVariables(ctx.styles.variables);if(ctx.displayMode){fullscreenButton.hidden=ctx.displayMode==='fullscreen';diagnostic('显示模式：'+ctx.displayMode)}};
 app.connect(new PostMessageTransport(window.parent,window.parent)).then(async()=>{
  ready=true;diagnostic('MCP 握手成功');clearTimeout(timer);mount();
  const ctx=app.getHostContext();if(ctx?.styles?.variables)applyHostStyleVariables(ctx.styles.variables);
  setTimeout(()=>void enterFullscreen(),250);
 }).catch(error=>{diagnostic('MCP 握手失败',error);clearTimeout(timer);mount();if(!mounted)root.render(<p role="alert">无法连接宿主：{error.message}</p>)});
}
