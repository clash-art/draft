export function layoutWarnings(meta){return (meta?.pages||[]).filter(p=>!p.roles?.includes('cover')&&Number.isFinite(p.fill)&&p.fill<.75).map(p=>`第 ${p.page} 页内容占 ${Math.round(p.fill*100)}%，请检查是否需要调整换页或配图。`)}
export function assertPageBounds(page,label='内容'){
 const boxes=[page,...page.querySelectorAll('[data-content],h1,h2,h3,[data-cover-title]')];
 if(boxes.some(el=>el.clientWidth>0&&el.scrollWidth>el.clientWidth+2)||page.scrollHeight>page.clientHeight+2)throw Error(`${label}超出页面，请调整标题、字号或素材尺寸后再生成图片`);
 if([...page.querySelectorAll('li')].some(li=>!li.textContent.trim()&&!li.querySelector('img,svg,table')))throw Error('存在空列表条目，请修复后再生成图片');
 return true;
}
