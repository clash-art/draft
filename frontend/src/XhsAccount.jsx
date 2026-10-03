import React,{useEffect,useState} from 'react';
import {api} from './api';
import {Button,Notice} from './ui';
export default function XhsAccount(){
 const[state,setState]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function call(action){setBusy(true);setError('');try{const r=await api('/api/channels/'+action,{});setState(r.message||({connected:'已连接',disconnected:'尚未连接',check_browser:'请在打开的 Chrome 中完成登录，然后检查连接'}[r.status])||'请检查登录窗口')}catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{call('status')},[]);
 return <section className="network-settings"><div className="section-heading"><div><h3>小红书账号</h3><p className="muted">登录一次，所有内容共用。登录会话保存在本机。</p></div><span>{state}</span></div>{error&&<Notice>{error}</Notice>}<div className="actions"><Button disabled={busy} onClick={()=>call('login')}>连接小红书</Button><Button disabled={busy} onClick={()=>call('status')}>检查连接</Button></div><p className="muted">在专用 Chrome 窗口登录创作中心。内容页面负责填写图文，正式发布由你在小红书确认。</p></section>
}
