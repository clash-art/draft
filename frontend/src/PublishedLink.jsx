import React,{useState} from 'react';
import {ExternalLink} from 'lucide-react';
import {Button,Modal,Field} from './ui';
import {api} from './api';
export default function PublishedLink({article,run,busy,onSaved}){
 const[open,setOpen]=useState(false),[value,setValue]=useState('');const publication=article?.sync?.publication;
 if(!publication)return null;
 let url;try{const u=new URL(publication.analytics_url);if(u.origin==='https://mp.weixin.qq.com'&&!u.username&&!u.password&&u.pathname==='/misc/appmsganalysis'&&u.searchParams.get('action')==='detailpage')url=u.href}catch{}
 return <><div className="actions">{url&&<a className="ui-button" href={url} target="_blank" rel="noopener noreferrer">微信后台数据 <ExternalLink/></a>}<Button variant={url?'ghost':'default'} onClick={()=>{setValue(publication.analytics_url||'');setOpen(true)}}>{url?'更换链接':'关联微信数据页'}</Button></div><Modal open={open} onOpenChange={setOpen} title="关联微信后台数据" description={article.title}><p className="muted">在微信后台打开这篇已发表文章的数据详情，复制地址栏链接。请确认文章一致。</p><Field label="数据详情地址"><input value={value} onChange={e=>setValue(e.target.value)} placeholder="https://mp.weixin.qq.com/misc/appmsganalysis?…" autoComplete="off" spellCheck={false}/></Field><p className="muted">链接仅保存在本机。后台登录失效时，请重新复制链接。</p><div className="dialog-actions"><Button variant="primary" disabled={!!busy||!value} onClick={()=>run('关联后台数据',async()=>{const sync=await api('/api/publication/analytics-link',{id:article.id,url:value});onSaved(sync);setOpen(false)})}>保存关联</Button></div></Modal></>
}
