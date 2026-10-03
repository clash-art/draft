import React,{useMemo,useState} from 'react';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {Button,Segments} from './ui';
import {api} from './api';
export default function SourceDocument({editor,change,imageMap,textRef,saveLocal,run,busy}){
 const [view,setView]=useState('read');
 const html=useMemo(()=>{const doc=new DOMParser().parseFromString(DOMPurify.sanitize(marked.parse(editor.body||'')),'text/html');doc.querySelectorAll('img').forEach(img=>{const ref=img.getAttribute('src');if(imageMap[ref])img.src=imageMap[ref];else img.remove()});return doc.body.innerHTML},[editor.body,imageMap]);
 async function edit(){if(/^\s*</.test(editor.body)){const saved=await saveLocal();const r=await api('/api/editor/markdown',{expected_revision:saved.revision});change({body:r.body})}setView('markdown')}
 return <><div className="document-controls"><Segments value={view} onChange={v=>v==='markdown'?run('编辑原稿',edit):setView(v)} options={[{value:'read',label:'阅读'},{value:'markdown',label:'编辑 Markdown'}]}/><span className="muted">原稿 · 各渠道共用</span></div>{view==='read'?editor.body.trim()?<div className="source-reading" dangerouslySetInnerHTML={{__html:html}}/>:<div className="source-blank"><p>从一份原稿开始</p><Button disabled={busy} onClick={()=>setView('markdown')}>撰写 Markdown</Button></div>:<textarea ref={textRef} className="source-markdown" aria-label="Markdown 原稿" spellCheck={false} value={editor.body} onChange={e=>change({body:e.target.value})} placeholder="在这里组织正文、图片引用和参考资料…"/>}</>
}
