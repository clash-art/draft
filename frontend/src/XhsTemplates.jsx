import {PAGE_SIZE_OPTIONS} from './page-size';
import React,{useEffect,useState} from 'react';
import {api} from './api';
import {Button,Field,Notice,Segments,Picker} from './ui';
import PagedArticle from './PagedArticle';
import {paginateArticle} from './paged-article';
import {XHS_ARTICLE_TEMPLATES} from './xhs-article-templates';
import coverSvg from '../../assets/templates/reading-cover.svg?raw';
const cover='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(coverSvg)));
import './channels.css';
const sample={title:'把完整的论证，排成好读的长文',body:`一篇长文的价值，在于完整的论证。段落之间有前因后果，配图解释具体问题，参考资料让读者可以继续追溯。换一个发布渠道，不应让这些内容消失。

## 01 从阅读节奏开始

排版需要做的是让信息层次清楚：标题先说明问题，正文用稳定的字号与行距展开。短段落提供停顿，图片出现在解释它的文字附近，而不是被单独拼成一组摘要卡片。

![阅读结构示意](${cover})

同一份原稿，可以在公众号连续阅读，也可以在小红书按页阅读。分页改变的是容器，文字和图片的先后关系应保持一致。

## 02 让每一页承接上一页

页面放不下时，正文自然续到下一页。小标题应尽量跟随后面的段落，图片和说明也应一起出现。遇到特别长的内容，优先保证完整，而不是为了凑页数删掉一段。

> 好的模板提供秩序，让读者把注意力放回内容。

## 03 保留查证的入口

参考资料是文章的一部分。可以采用更紧凑的字号与条目间距，但不能省略标题、链接或编号。读者需要时，可以沿着资料重新找到论据。

## 参考资料

〔1〕MDN：CSS 排版基础 https://developer.mozilla.org/zh-CN/docs/Learn_web_development/Core/CSS_layout

〔2〕W3C：中文排版需求 https://www.w3.org/TR/clreq/

〔3〕CommonMark：Markdown 规范 https://spec.commonmark.org/
`};
export default function XhsTemplates(){
 const[items,setItems]=useState(XHS_ARTICLE_TEMPLATES),[t,setT]=useState(XHS_ARTICLE_TEMPLATES[0]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[pages,setPages]=useState([]),[paging,setPaging]=useState(false),[current,setCurrent]=useState(false);
 async function refresh(){const r=await api('/api/channels/templates/list',{format:'longform'});if(r.format!=='longform')throw Error('当前 MCP 服务仍是旧版模板接口；长文预览可用，保存需重新加载插件服务。');setItems(r.items);setReady(true);return r.items}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{let active=true;setPaging(true);const timer=setTimeout(async()=>{try{const source=current?await api('/api/editor/load',{}):sample;const result=await paginateArticle({...source,template:t},api);if(active)setPages(result)}catch(e){if(active){setPages([]);setError(e.message)}}finally{if(active)setPaging(false)}},200);return()=>{active=false;clearTimeout(timer)}},[t,current]);
 async function act(fn){setBusy(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const change=(k,v)=>setT({...t,[k]:v}),custom=/^[a-f0-9]{32}$/.test(t.id);
 return <div className="template-manager"><div className="template-header"><div><h1>小红书长文模板</h1><p className="muted">完整原稿，按阅读顺序分页 · HTML 预览与导出共用同一版式</p></div><div className="actions"><Button disabled={busy} onClick={()=>setT({...t,id:'',name:t.name+' · 副本'})}>复制模板</Button>{custom&&<Button disabled={busy||!ready} onClick={()=>act(async()=>{await api('/api/channels/templates/delete',{id:t.id,format:'longform'});setT((await refresh())[0])})}>删除模板</Button>}<Button disabled={busy||!ready} variant="primary" onClick={()=>act(async()=>{setT(await api('/api/channels/templates/save',{template:t,format:'longform'}));await refresh()})}>{custom?'保存模板':'另存为模板'}</Button></div></div>{error&&<Notice>{error}</Notice>}<div className="template-layout"><aside className="template-options"><div className="template-catalog">{items.map(item=><button key={item.id} className={'template-choice '+(t.id===item.id?'selected':'')} onClick={()=>setT(item)}><span className="template-swatch" style={{background:item.accent}}/><span><strong>{item.name}</strong><small>{item.description}</small></span></button>)}</div><Field label="图片尺寸"><Picker value={t.page_ratio||'3:4'} options={PAGE_SIZE_OPTIONS} onChange={value=>change('page_ratio',value)}/></Field><Field label="模板名称"><input value={t.name} maxLength={40} onChange={e=>change('name',e.target.value)}/></Field><Field label="强调色"><input type="color" value={t.accent} onChange={e=>change('accent',e.target.value)}/></Field><p className="muted">字体、间距和分页细节交给 Agent 微调。原稿内容保持完整。</p></aside><section className="template-preview-area"><Segments value={current?'current':'sample'} onChange={v=>setCurrent(v==='current')} options={[{value:'sample',label:'图文示例'},{value:'current',label:'当前文章'}]}/><PagedArticle pages={pages} busy={paging}/></section></div></div>
}
