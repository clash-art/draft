// Same global CSS as the workbench, so measurement matches the in-app preview.
import '../src/linear.css';
import '../src/style.css';
import '../src/channels.css';
import {paginateArticle,layoutArticle,exportArticlePages} from '../src/paged-article';
async function api(path,data){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const value=await response.json();if(!response.ok)throw Error(value.error||response.statusText);return value;
}
async function edition(){const source=await api('/api/editor/load',{});return {source,edition:await api('/api/channels/get',{id:source.id,channel:'xiaohongshu'})}}
async function templates(){return (await api('/api/channels/templates/list',{format:'longform'})).items}
// Paginates with the requested template and returns PNG data through the real export code path.
async function render(templateId,{png=true}={}){
 const {edition:e}=await edition();
 const template=templateId?(await templates()).find(t=>t.id===templateId):e.template;
 if(!template)throw Error('unknown template '+templateId);
 const {pages,meta}=await layoutArticle({...e,template},api);
 const grid=document.getElementById('pages');grid.innerHTML=pages.map(html=>`<div class="paged-article-page">${html}</div>`).join('');
 if(!png)return {template,count:pages.length,meta};
 const captured=[];
 await exportArticlePages(pages,async(path,data)=>{if(path!=='/api/upload')return api(path,data);captured.push(data.data);return {ref:'captured'}});
 return {template,count:pages.length,meta,pngs:captured};
}
// Full export: upload page PNGs and save them onto the channel edition, exactly as the workbench does.
async function exportAndSave(templateId){
 const {source,edition:loaded}=await edition();let e=loaded;
 if(templateId&&e.template?.id!==templateId){
  const template=(await templates()).find(t=>t.id===templateId);
  e=await api('/api/channels/save',{...e,id:source.id,channel:'xiaohongshu',format:'longform',template,source_revision:source.revision,expected_revision:e.revision});
 }
 const pages=await paginateArticle(e,api);
 const refs=await exportArticlePages(pages,api);
 return api('/api/channels/save',{...e,id:source.id,channel:'xiaohongshu',format:'longform',page_images:refs,page_count:pages.length,rendered_for_revision:e.revision,source_revision:source.revision,expected_revision:e.revision});
}
window.__xhs={api,edition,templates,render,exportAndSave,ready:true};
