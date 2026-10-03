"""Local workbench operations. No publication or deletion endpoints."""
import base64,csv,hashlib,io,json,re,threading,uuid,fcntl
from datetime import datetime,timezone
from datetime import date
from pathlib import Path
from urllib.parse import urlparse,unquote,parse_qs
from bs4 import BeautifulSoup
import markdown
from wechat import prepare,build_article,image_bytes,save_json,analyze_rows,ALIASES,date_windows

class Workspace:
 def __init__(self,root,client_factory,account_identity=lambda: "default"):
  self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
  (self.root/'images').mkdir(exist_ok=True,mode=0o700)
  (self.root/'pending').mkdir(exist_ok=True,mode=0o700)
  self.client_factory=client_factory;self.account_identity=account_identity;self.lock=threading.Lock()
 def pending_path(self,identifier):
  if not re.fullmatch(r'[a-f0-9]{32}',str(identifier)):raise ValueError('待同步文章编号无效')
  return self.root/'pending'/(identifier+'.json')
 def sync_path(self,identifier):
  self.pending_path(identifier)
  account=hashlib.sha256(self.account_identity().encode()).hexdigest()[:16]
  return self.root/'pending'/(identifier+'-'+account+'.sync')
 def sync_state(self,editor):
  if not editor.get('id'):return None
  p=self.sync_path(editor['id'])
  if not p.exists():return None
  state=json.loads(p.read_text())
  return state
 def editor_links_path(self):
  account=hashlib.sha256(self.account_identity().encode()).hexdigest()[:16]
  return self.root/('editor-links-'+account+'.json')
 def editor_links(self):
  path=self.editor_links_path()
  return json.loads(path.read_text()) if path.exists() else {}
 def article_analysis_path(self,identifier):
  self.pending_path(identifier)
  account=hashlib.sha256(self.account_identity().encode()).hexdigest()[:16]
  return self.root/('analysis-'+identifier+'-'+account+'.json')
 def save_analysis(self,report):
  report.update(report_id=uuid.uuid4().hex,account=self.account_identity())
  save_json(self.root/'analysis.json',report)
  report['analysis_file']=str(self.root/'analysis.json')
  return report
 @staticmethod
 def remote_hash(article):
  keys=('title','author','digest','content','thumb_media_id')
  return hashlib.sha256(json.dumps({k:article.get(k,'') for k in keys},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 def image_path(self,ref):
  if not isinstance(ref,str) or not re.fullmatch(r'images/[a-f0-9]{32}\.png',ref):raise ValueError('请使用本页上传的图片')
  path=self.root/ref
  if not path.is_file():raise ValueError('图片不存在，请重新上传')
  return path
 def upload(self,data):
  try:raw=base64.b64decode(data.get('data',''),validate=True)
  except Exception:raise ValueError('图片编码无效') from None
  if not raw or len(raw)>8*1024*1024:raise ValueError('请上传不超过 8 MB 的图片')
  ref='images/'+uuid.uuid4().hex+'.png';path=self.root/ref
  path.write_bytes(raw)
  try:compressed,mime,name=image_bytes(path)
  except Exception:
   path.unlink(missing_ok=True);raise ValueError('无法读取图片，请使用静态 JPG、PNG 或 WebP') from None
  return {'ref':ref,'name':str(data.get('name','图片'))[:150],'preview':'data:'+mime+';base64,'+base64.b64encode(compressed).decode()}
 def audit(self,data):
  body=data.get('body','');title=data.get('title','')
  if not isinstance(body,str) or not isinstance(title,str) or not body.strip():raise ValueError('请先填写正文和标题')
  if len(body)>100000:raise ValueError('正文过长，请控制在 10 万字符以内')
  html=markdown.markdown(body,extensions=['tables','fenced_code'])
  soup=BeautifulSoup(html,'html.parser')
  for img in soup.find_all('img'):self.image_path(unquote(img.get('src','')))
  source=self.root/'article.md';source.write_text(body,encoding='utf-8')
  report=prepare(source,title)
  rendered=BeautifulSoup(report['html'],'html.parser')
  for img,record in zip(rendered.find_all('img'),report['images']):
   binary,mime,_=image_bytes(record['path']);img['src']='data:'+mime+';base64,'+base64.b64encode(binary).decode()
   record['preview']=img['src']
  report['preview_html']=str(rendered)
  plain=soup.get_text(' ',strip=True)
  checks=[]
  def add(level,text):checks.append({'level':level,'text':text})
  if not soup.find(['h2','h3']) and len(plain)>800:add('suggestion','正文较长但没有小标题，建议按问题或观点分节。')
  if len(title)>30:add('suggestion','标题超过 30 字，建议检查手机列表中的截断效果。')
  if not report['images']:add('suggestion','正文没有配图；可按需要补充示例、图表或截图。')
  if soup.find('code'):add('suggestion','含代码内容，请检查手机上长行的阅读体验。')
  if len(plain)<100:add('suggestion','正文不足 100 字，请确认是否为完整文章。')
  report['checks']=checks
  report['paragraphs']=len(soup.find_all('p'));report['headings']=len(soup.find_all(['h1','h2','h3']))
  report['review_file']=str(self.root/'review.json')
  save_json(report['review_file'],{k:v for k,v in report.items() if k!='preview_html'})
  return report
 def dispatch(self,route,data):
  # Serialize local article snapshots and remote saves to prevent races.
  with self.lock:
   with (self.root/'.workspace.lock').open('a') as lockfile:
    fcntl.flock(lockfile,fcntl.LOCK_EX)
    try:return self._dispatch(route,data)
    finally:fcntl.flock(lockfile,fcntl.LOCK_UN)
 def _dispatch(self,route,data):
  if route.startswith('/api/channels/'):
   from channels import dispatch
   return dispatch(self,route,data)
  if route=='/api/app/snapshot':
   editor=self._dispatch('/api/editor/load',{})
   rendered=BeautifulSoup(markdown.markdown(editor.get('body',''),extensions=['tables','fenced_code']),'html.parser')
   for img in rendered.find_all('img'):
    binary,mime,_=image_bytes(self.image_path(unquote(img.get('src',''))))
    img['src']='data:'+mime+';base64,'+base64.b64encode(binary).decode()
   return {'article':{k:v for k,v in editor.items() if k not in ('body','assets')},
           'items':self._dispatch('/api/pending/list',{})['items'],
           'comments':self._dispatch('/api/comments/list',{'id':editor['id']})['items'] if editor.get('id') else [],
           'review':self._dispatch('/api/review/latest',{}),
           'preview_html':str(rendered)}
  if route=='/api/pending/list':
   items=[]
   for p in (self.root/'pending').glob('*.json'):
    e=json.loads(p.read_text());sync=self.sync_state(e)
    from channels import load
    xhs=load(self,e,'xiaohongshu')
    items.append({k:e.get(k) for k in ('id','title','revision','updated_at','digest')}|{'sync':sync,'xiaohongshu':{'revision':xhs['revision'],'publication':xhs.get('publication'),'delivery':xhs.get('delivery')}})
   query=str(data.get('q','')).casefold().strip();stage=data.get('stage','all')
   if stage not in ('all','pending','draft','published'):raise ValueError('未知内容状态')
   def matches(e):
    actual='published' if (e.get('sync') or {}).get('publication') else 'draft' if e.get('sync') else 'pending'
    return (stage=='all' or stage==actual) and (not query or query in ((e.get('title') or '')+' '+(e.get('digest') or '')).casefold())
   return {'items':sorted(filter(matches,items),key=lambda e:e.get('updated_at',''),reverse=True)}
  if route=='/api/pending/new':
   old=self._dispatch('/api/editor/load',{})
   if 'expected_revision' in data and data['expected_revision']!=old.get('revision'):raise ValueError('工作区已变化，请先载入最新版本')
   blank={'id':uuid.uuid4().hex,'title':'','body':'','author':'','digest':'','cover':'','assets':[],'revision':uuid.uuid4().hex,'updated_at':datetime.now(timezone.utc).isoformat()}
   save_json(self.pending_path(blank['id']),blank);save_json(self.root/'editor.json',blank)
   return blank
  if route=='/api/pending/open':
   old=self._dispatch('/api/editor/load',{})
   if data.get('expected_revision')!=old.get('revision'):raise ValueError('工作区已变化，请先载入最新版本')
   path=self.pending_path(data.get('id'))
   if not path.exists():raise ValueError('文章不存在')
   e=json.loads(path.read_text());save_json(self.root/'editor.json',e)
   return self._dispatch('/api/editor/load',{})
  if route=='/api/comments/list':
   path=self.pending_path(data.get('id')).with_suffix('.comments')
   return {'items':json.loads(path.read_text()) if path.exists() else []}
  if route=='/api/comments/add':
   e=self._dispatch('/api/editor/load',{})
   if data.get('id')!=e.get('id') or data.get('revision')!=e.get('revision'):raise ValueError('文章已变化，请重新选择批注位置')
   text=str(data.get('text','')).strip()
   if not text or len(text)>3000:raise ValueError('批注需要 1 至 3000 字')
   path=self.pending_path(e['id']).with_suffix('.comments');items=self._dispatch('/api/comments/list',data)['items']
   item={'id':uuid.uuid4().hex,'revision':e['revision'],'quote':str(data.get('quote',''))[:2000],'text':text,'resolved':False,'at':datetime.now(timezone.utc).isoformat()}
   items.append(item);save_json(path,items);return item
  if route=='/api/comments/resolve':
   items=self._dispatch('/api/comments/list',data)['items']
   target=next((x for x in items if x['id']==data.get('comment_id')),None)
   if not target:raise ValueError('批注不存在')
   target['resolved']=bool(data.get('resolved',True));save_json(self.pending_path(data['id']).with_suffix('.comments'),items);return target
  if route=='/api/pending/import':
   old=self._dispatch('/api/editor/load',{})
   if data.get('expected_revision')!=old.get('revision'):raise ValueError('工作区已变化，请先保存并载入最新版本')
   media_id=str(data.get('media_id',''));index=int(data.get('index',0))
   for item in self._dispatch('/api/pending/list',{})['items']:
    if item.get('sync') and item['sync']['media_id']==media_id and item['sync'].get('index',0)==index:
     return self._dispatch('/api/pending/open',{'id':item['id'],'expected_revision':old.get('revision')})
   remote=self.client_factory().call('cgi-bin/draft/get',{'media_id':media_id});items=remote.get('news_item',[])
   if not 0<=index<len(items):raise ValueError('草稿文章不存在')
   article=items[index];soup=BeautifulSoup(article.get('content',''),'html.parser');assets=[];mapped={}
   def fetch_image(url):
    if url in mapped:return mapped[url]
    parsed=urlparse(url)
    if parsed.scheme not in ('http','https') or parsed.hostname not in ('mmbiz.qpic.cn','mmbiz.qlogo.cn'):raise ValueError('草稿含非微信图片，请手动导入')
    import requests
    try:
     with requests.get(url.replace('http:','https:',1),timeout=30,stream=True,allow_redirects=False) as response:
      if response.status_code!=200:raise ValueError('读取微信配图失败，请稍后重试')
      raw=bytearray()
      for chunk in response.iter_content(65536):
       raw.extend(chunk)
       if len(raw)>8*1024*1024:raise ValueError('微信配图超过 8 MB，请手动导入')
    except requests.RequestException:raise ValueError('读取微信配图失败，请稍后重试') from None
    image=self.upload({'name':'配图 '+str(len(assets)+1),'data':base64.b64encode(raw).decode()});assets.append({'ref':image['ref'],'name':image['name']});mapped[url]=image['ref'];return image['ref']
   for img in soup.find_all('img'):
    src=img.get('src') or img.get('data-src','');img['src']=fetch_image(src);img.attrs.pop('data-src',None)
   cover=fetch_image(article['thumb_url']) if article.get('thumb_url') else ''
   blank=self._dispatch('/api/pending/new',{'expected_revision':old.get('revision')})
   e=self._dispatch('/api/editor/save',{'expected_revision':blank['revision'],'title':article.get('title',''),'body':str(soup),'author':article.get('author',''),'digest':article.get('digest',''),'cover':cover,'assets':assets})
   state={'media_id':media_id,'index':index,'revision':e['revision'],'remote_hash':self.remote_hash(article),'verified':True,'message':'已从微信导入并关联草稿'}
   save_json(self.sync_path(e['id']),state);return {**e,'sync':state}
  if route=='/api/pending/unlink':
   e=json.loads(self.pending_path(data.get('id')).read_text())
   if data.get('expected_revision')!=e.get('revision'):raise ValueError('文章已变化，请重新载入后解绑')
   state=self.sync_state(e)
   if not state:raise ValueError('文章已没有微信关联')
   if data.get('expected_sync')!=state:raise ValueError('微信关联已变化，请重新载入后解绑')
   # Archive locally; never delete or modify anything on WeChat.
   archive=self.root/'unlinked'/uuid.uuid4().hex;archive.mkdir(parents=True,mode=0o700)
   save_json(archive/'association.json',{'id':e['id'],'account':self.account_identity(),'sync':state,'unlinked_at':datetime.now(timezone.utc).isoformat()})
   report=self.article_analysis_path(e['id'])
   if report.exists():report.replace(archive/'analytics.json')
   operation='pending-'+hashlib.sha256((e['id']+self.account_identity()).encode()).hexdigest()
   receipt=self.root/('receipt-'+operation+'.json')
   if receipt.exists():receipt.replace(archive/'creation-receipt.json')
   self.sync_path(e['id']).replace(archive/'association.sync')
   return {'id':e['id'],'sync':None,'message':'已解除关联，微信内容和本机文章均已保留'}
  if route=='/api/pending/link':
   e=self._dispatch('/api/editor/load',{})
   if data.get('id')!=e.get('id') or data.get('expected_revision')!=e.get('revision'):raise ValueError('文章已变化，请载入最新版本')
   if self.sync_state(e):raise ValueError('文章已有微信关联，不能直接替换关联')
   index=int(data.get('index',0));media_id=str(data.get('media_id',''))
   for other in self._dispatch('/api/pending/list',{})['items']:
    linked=other.get('sync') or {}
    if linked.get('media_id')==media_id and linked.get('index',0)==index:
     raise ValueError('该微信草稿已关联内容「'+(other.get('title') or '未命名文章')+'」，请直接打开关联内容')
   remote=self.client_factory().call('cgi-bin/draft/get',{'media_id':media_id})
   if not 0<=index<len(remote.get('news_item',[])):raise ValueError('草稿文章不存在')
   state={'media_id':media_id,'index':index,'remote_hash':self.remote_hash(remote['news_item'][index]),'verified':True,'revision':None,'message':'已关联微信草稿；本机内容尚未同步'}
   save_json(self.sync_path(e['id']),state);return state
  if route=='/api/publications/list':
   offset=int(data.get('offset',0))
   if offset<0:raise ValueError('分页位置无效')
   return self.client_factory().call('cgi-bin/freepublish/batchget',{'offset':offset,'count':20,'no_content':0})
  if route=='/api/publication/link':
   path=self.pending_path(data.get('id'))
   if not path.exists():raise ValueError('文章不存在')
   e=json.loads(path.read_text());state=self.sync_state(e)
   if not state:raise ValueError('请先关联微信草稿')
   article_id=str(data.get('article_id',''));index=int(data.get('index',0))
   remote=self.client_factory().call('cgi-bin/freepublish/getarticle',{'article_id':article_id})
   items=remote.get('news_item',[])
   if not 0<=index<len(items):raise ValueError('已发布文章不存在')
   item=items[index];url=item.get('url','')
   if url and (urlparse(url).scheme not in ('http','https') or urlparse(url).hostname!='mp.weixin.qq.com'):raise ValueError('文章链接异常')
   state['publication']={'article_id':article_id,'index':index,'title':item.get('title',''),'url':url,'linked_at':datetime.now(timezone.utc).isoformat()}
   save_json(self.sync_path(e['id']),state);return state
  if route=='/api/publication/manual':
   path=self.pending_path(data.get('id'));e=json.loads(path.read_text());state=self.sync_state(e)
   if not state:raise ValueError('请先关联微信草稿')
   url=str(data.get('url','')).strip();parsed=urlparse(url)
   if parsed.scheme!='https' or parsed.netloc!='mp.weixin.qq.com':raise ValueError('请输入微信正式文章或后台数据链接')
   if data.get('confirmed') is not True:raise ValueError('请确认这是该内容的已发布文章')
   publication={'title':e['title'],'source':'user_confirmed','linked_at':datetime.now(timezone.utc).isoformat()}
   if parsed.path=='/misc/appmsganalysis':
    query=parse_qs(parsed.query);msgid=query.get('msgid',[''])[0];published=query.get('publish_date',[''])[0]
    if query.get('action')!=['detailpage'] or not re.fullmatch(r'[0-9]+_[0-9]+',msgid):raise ValueError('数据详情链接缺少有效的数据编号')
    try:date.fromisoformat(published)
    except ValueError:raise ValueError('数据链接缺少有效的发表日期') from None
    publication.update(analytics_url=url,msgid=msgid,publish_date=published)
   elif parsed.path=='/s' or parsed.path.startswith('/s/'):
    if 'tempkey' in parse_qs(parsed.query):raise ValueError('临时草稿预览不是正式发表链接')
    publication['url']=url
   else:raise ValueError('请输入正式文章链接或后台数据详情链接')
   state['publication']=publication
   save_json(self.sync_path(e['id']),state);return state
  if route=='/api/publication/analytics-link':
   path=self.pending_path(data.get('id'));e=json.loads(path.read_text());state=self.sync_state(e)
   if not state or not state.get('publication'):raise ValueError('请先关联已发布文章')
   url=str(data.get('url','')).strip();parsed=urlparse(url);query=parse_qs(parsed.query)
   msgid=query.get('msgid',[''])[0];published=query.get('publish_date',[''])[0]
   if parsed.scheme!='https' or parsed.netloc!='mp.weixin.qq.com' or parsed.path!='/misc/appmsganalysis' or query.get('action')!=['detailpage'] or not re.fullmatch(r'[0-9]+_[0-9]+',msgid):raise ValueError('请输入这篇文章的微信后台数据详情链接')
   try:date.fromisoformat(published)
   except ValueError:raise ValueError('数据链接缺少有效的发表日期') from None
   current=state['publication'].get('msgid')
   if current and current!=msgid:raise ValueError('链接的数据编号与已关联文章不一致，请核对文章')
   state['publication'].update(analytics_url=url,msgid=msgid,publish_date=published)
   save_json(self.sync_path(e['id']),state);self.sync_path(e['id']).chmod(0o600);return state
  if route=='/api/publication/metric':
   path=self.pending_path(data.get('id'));e=json.loads(path.read_text());state=self.sync_state(e)
   if not state or not state.get('publication'):raise ValueError('请先关联已发布文章')
   msgid=str(data.get('msgid',''))
   if not re.fullmatch(r'[0-9]+_[0-9]+',msgid):raise ValueError('请选择接口或 CSV 中的图文数据编号')
   state['publication']['msgid']=msgid;save_json(self.sync_path(e['id']),state);return state
  if route=='/api/pending/sync':
   e=self._dispatch('/api/editor/load',{})
   if data.get('id')!=e.get('id') or data.get('expected_revision')!=e.get('revision'):raise ValueError('文章已变化，请保存后重新同步')
   from channels import load
   edition=load(self,e,'wechat');channel_revision=edition.get('revision')
   if channel_revision:
    from templates import render
    e={**e,'title':edition['title'],'body':render(edition['body'],edition['template'])}
   sync=self.sync_state(e);state_path=self.sync_path(e['id'])
   if data.get('intent')=='create' and sync:raise ValueError('已有微信关联，请刷新后更新草稿，或先解除关联')
   if data.get('intent')=='update' and not sync:raise ValueError('微信关联已解除，请重新选择关联或创建草稿')
   if sync and sync.get('publication'):raise ValueError('文章已关联发布记录；请新建待同步文章用于下一次发布')
   if sync and sync.get('revision')==e['revision'] and sync.get('channel_revision')==channel_revision and sync.get('verified'):return sync
   if sync and not sync.get('verified'):raise ValueError('上次同步结果待核对，请先到微信草稿箱确认，避免重复写入')
   if sync:
    client=self.client_factory();remote=client.call('cgi-bin/draft/get',{'media_id':sync['media_id']})
    articles=remote.get('news_item',[])
    if len(articles)<=sync.get('index',0) or self.remote_hash(articles[sync.get('index',0)])!=sync['remote_hash']:raise ValueError('微信端草稿已修改，请先核对并合并，当前内容未覆盖微信草稿')
    report=self.audit(e)
    if report['errors']:raise ValueError('请先修复审核错误：'+'；'.join(report['errors']))
    if len(e['author'])>8 or len(e['digest'])>120:raise ValueError('作者或摘要过长')
    article={k:v for k,v in articles[sync.get('index',0)].items() if k in ('content_source_url','need_open_comment','only_fans_can_comment','show_cover_pic')}
    article.update(build_article(report,self.image_path(e['cover']),client.upload,e['author'],e['digest']))
    save_json(self.root/('backup-pending-'+e['id']+'-'+e['revision']+'.json'),remote)
    sync={**sync,'verified':False,'message':'同步结果待核对'};save_json(state_path,sync)
    client.call('cgi-bin/draft/update',{'media_id':sync['media_id'],'index':sync.get('index',0),'articles':article})
   else:
    payload={k:e.get(k,'') for k in ('title','body','author','digest','cover')}
    payload['operation_id']='pending-'+hashlib.sha256((e['id']+self.account_identity()).encode()).hexdigest()
    result=self._dispatch('/api/draft/save',payload)
    sync={'media_id':result['media_id'],'verified':False};save_json(state_path,sync)
    client=self.client_factory()
   try:
    remote=client.call('cgi-bin/draft/get',{'media_id':sync['media_id']})
    if not remote.get('news_item'):raise ValueError('回读没有文章')
    sync.update(revision=e['revision'],channel_revision=channel_revision,remote_hash=self.remote_hash(remote['news_item'][sync.get('index',0)]),verified=True,synced_at=datetime.now(timezone.utc).isoformat(),message='已同步到微信草稿并回读确认')
   except ValueError:sync.update(message='已写入微信，回读失败，请到微信草稿箱核对')
   save_json(state_path,sync);return sync
  if route=='/api/editor/load':
   p=self.root/'editor.json'
   e=json.loads(p.read_text()) if p.exists() else {'title':'','body':'','author':'','digest':'','cover':'','assets':[],'revision':None}
   return {**e,'sync':self.sync_state(e)}
  if route.startswith('/api/templates/'):
   from templates import list_templates,save_template,render,SAMPLE
   if route=='/api/templates/list':return {'items':list_templates(self.root)}
   if route=='/api/templates/save':return save_template(self.root,data.get('template',{}))
   if route=='/api/templates/delete':
    identifier=str(data.get('id',''))
    if not re.fullmatch(r'[a-f0-9]{32}',identifier):raise ValueError('内置模板不可删除')
    path=self.root/'templates'/(identifier+'.json')
    if not path.exists():raise ValueError('模板不存在')
    path.replace(path.with_suffix('.archived'));return {'removed':True}
   e=self._dispatch('/api/editor/load',{})
   body=e.get('body','') if data.get('current') else SAMPLE
   if not body.strip():raise ValueError('当前文章还没有正文，请先使用示例预览')
   html=render(body,data.get('template',{}))
   if route=='/api/templates/apply':
    if data.get('expected_revision')!=e.get('revision') or data.get('id')!=e.get('id'):raise ValueError('文章版本已变化，请重新预览后应用')
    if not data.get('current'):raise ValueError('请先预览当前文章')
    from channels import load
    edition=load(self,e,'wechat')
    self._dispatch('/api/channels/save',{**edition,'id':e['id'],'channel':'wechat','source_revision':e['revision'],'expected_revision':edition['revision'],'template':data.get('template',{})})
    return e
   if route=='/api/templates/preview':
    soup=BeautifulSoup(html,'html.parser')
    for img in soup.find_all('img'):
     if not data.get('current'):continue  # Bundled sample images are already embedded.
     binary,mime,_=image_bytes(self.image_path(unquote(img.get('src',''))));img['src']='data:'+mime+';base64,'+base64.b64encode(binary).decode()
    ref_heading=next((h for h in soup.find_all(['h1','h2','h3','h4','p']) if re.fullmatch(r'(参考资料|参考文献|参考链接|引用来源|References|Sources)[:：]?',h.get_text(strip=True),re.I)),None)
    reference_html=''
    if ref_heading:
     reference_html=str(ref_heading)
     for node in ref_heading.next_siblings:
      if getattr(node,'name',None) in ('h1','h2','h3','h4'):break
      reference_html+=str(node)
    return {'html':str(soup),'reference_html':reference_html,'id':e.get('id'),'revision':e.get('revision'),'title':e.get('title'),'references':len(soup.find_all(string=re.compile('参考资料|参考文献')))}
   raise ValueError('未知模板操作')
  if route=='/api/editor/markdown':
   from markdownify import markdownify
   e=self._dispatch('/api/editor/load',{})
   if data.get('expected_revision')!=e.get('revision'):raise ValueError('源内容已变化，请重新载入')
   return {'body':markdownify(e['body'],heading_style='ATX',bullets='-'),'revision':e['revision']}
  if route=='/api/editor/save':
   old=self._dispatch('/api/editor/load',{})
   if 'expected_revision' in data and data['expected_revision']!=old.get('revision'):raise ValueError('文章已被另一个页面或 MCP 更新，请先载入最新版本再修改')
   if len(str(data.get('body','')))>100000:raise ValueError('正文不能超过 10 万字符')
   clean={k:str(data.get(k,'')) for k in ('title','body','author','digest','cover','agent_context')}
   if 'agent_context' not in data:clean['agent_context']=old.get('agent_context','')
   if len(clean['agent_context'])>30000:raise ValueError('Agent 上下文不能超过 3 万字符')
   assets=[]
   for item in data.get('assets',[]):
    self.image_path(item['ref']);assets.append({'ref':item['ref'],'name':str(item.get('name','图片'))[:150]})
   if clean['cover']:self.image_path(clean['cover'])
   clean.update(id=old.get('id') or uuid.uuid4().hex,assets=assets,revision=uuid.uuid4().hex,updated_at=datetime.now(timezone.utc).isoformat())
   save_json(self.pending_path(clean['id']),clean)
   save_json(self.root/'editor.json',clean)
   return {**clean,'sync':self.sync_state(clean)}
  if route=='/api/review/publish':
   editor=self._dispatch('/api/editor/load',{})
   if not editor.get('revision') or data.get('revision')!=editor['revision']:raise ValueError('审核对应的文章版本已变化，请重新读取再审核')
   findings=data.get('findings',[])
   if not isinstance(findings,list) or len(findings)>100:raise ValueError('审核条目无效')
   clean={'article_id':editor['id'],'revision':editor['revision'],'summary':str(data.get('summary',''))[:5000],'findings':[],'updated_at':datetime.now(timezone.utc).isoformat()}
   for item in findings:
    if not isinstance(item,dict):raise ValueError('审核条目应为对象')
    clean['findings'].append({k:str(item.get(k,''))[:3000] for k in ('severity','location','message','quote')})
   save_json(self.pending_path(editor['id']).with_suffix('.review'),clean);return clean
  if route=='/api/review/latest':
   editor=self._dispatch('/api/editor/load',{})
   p=self.pending_path(editor['id']).with_suffix('.review') if editor.get('id') else self.root/'ai-review.json'
   if not p.exists():return {'available':False}
   report=json.loads(p.read_text());report['available']=True;report['stale']=report['revision']!=self._dispatch('/api/editor/load',{}).get('revision');return report
  if route=='/api/image/preview':
   binary,mime,_=image_bytes(self.image_path(data.get('ref','')))
   return {'preview':'data:'+mime+';base64,'+base64.b64encode(binary).decode()}
  if route=='/api/bridge/status':
   p=self.root/'mcp-status.json'
   return {'transport':'stdio','tools':20,'last_call':json.loads(p.read_text()) if p.exists() else None}
  if route=='/api/upload':return self.upload(data)
  if route=='/api/audit':return self.audit(data)
  if route=='/api/drafts/editor-link':
   url=str(data.get('url','')).strip();parsed=urlparse(url);query=parse_qs(parsed.query)
   if parsed.scheme!='https' or parsed.netloc!='mp.weixin.qq.com' or parsed.path!='/cgi-bin/appmsg' or query.get('action')!=['edit'] or query.get('t')!=['media/appmsg_edit'] or not re.fullmatch(r'[0-9]+',query.get('appmsgid',[''])[0]):
    raise ValueError('请粘贴微信后台这篇草稿的完整编辑链接（含 appmsgid）')
   media_id=str(data.get('media_id',''));index=int(data.get('index',0))
   remote=self.client_factory().call('cgi-bin/draft/get',{'media_id':media_id})
   if not 0<=index<len(remote.get('news_item',[])):raise ValueError('草稿文章不存在')
   links=self.editor_links();links[media_id+':'+str(index)]={'url':url,'title':remote['news_item'][index].get('title','')}
   save_json(self.editor_links_path(),links);self.editor_links_path().chmod(0o600)
   return {'saved':True}
  if route=='/api/drafts/list':
   offset=int(data.get('offset',0))
   if offset<0:raise ValueError('分页位置无效')
   media_id=str(data.get('media_id','')).strip()
   if media_id:
    remote=self.client_factory().call('cgi-bin/draft/get',{'media_id':media_id})
    result={'total_count':1,'item':[{'media_id':media_id,'content':remote}]}
   else:result=self.client_factory().call('cgi-bin/draft/batchget',{'offset':offset,'count':20,'no_content':0})
   editor_links=self.editor_links()
   links={(e['sync']['media_id'],e['sync'].get('index',0)):e for e in self._dispatch('/api/pending/list',{})['items'] if e.get('sync')}
   for group in result.get('item',[]):
    for index,article in enumerate(group.get('content',{}).get('news_item',[])):
     article['editor_url']=(editor_links.get(group.get('media_id','')+':'+str(index)) or {}).get('url')
     e=links.get((group.get('media_id'),index));article['workspace_link']=None
     if e:
      sync=e['sync'];local_changed=sync.get('revision')!=e.get('revision')
      remote_changed=bool(sync.get('remote_hash') and sync['remote_hash']!=self.remote_hash(article))
      state='unverified' if not sync.get('verified') else 'conflict' if local_changed and remote_changed else 'remote_changed' if remote_changed else 'local_changed' if local_changed else 'synced'
      article['workspace_link']={'id':e['id'],'title':e['title'],'revision':e['revision'],'state':state,'published':bool(sync.get('publication'))}
   return result
  if route=='/api/drafts/get':
   return self.client_factory().call('cgi-bin/draft/get',{'media_id':str(data.get('media_id',''))})
  if route=='/api/draft/save':
   operation=str(data.get('operation_id',''))
   if not re.fullmatch(r'[A-Za-z0-9-]{1,80}',operation):raise ValueError('操作标识无效，请刷新重试')
   receipt=self.root/('receipt-'+operation+'.json')
   account=self.account_identity()
   fingerprint=hashlib.sha256(json.dumps({k:v for k,v in data.items() if k!='operation_id'},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
   if receipt.exists():
    previous=json.loads(receipt.read_text())
    if previous.get('account')!=account:raise ValueError('账号已变化，请重新编辑后保存到当前账号')
    if previous.get('fingerprint')!=fingerprint:raise ValueError('内容已变化，请开始一次新的保存操作')
    if previous.get('media_id'):return previous
    raise ValueError('上次保存结果不确定，请先到草稿箱核对，避免重复新建')
   report=self.audit(data)
   if report['errors']:raise ValueError('请先修复审核中的错误：'+'；'.join(report['errors']))
   cover=self.image_path(data.get('cover',''));image_bytes(cover)
   author=str(data.get('author',''));digest=str(data.get('digest',''))
   if len(author)>8 or len(digest)>120:raise ValueError('作者最多 8 字，摘要最多 120 字')
   client=self.client_factory();article=build_article(report,cover,client.upload,author,digest)
   save_json(receipt,{'fingerprint':fingerprint,'account':account,'status':'pending'})
   response=client.call('cgi-bin/draft/add',{'articles':[article]})
   media_id=response.get('media_id')
   if not media_id:raise ValueError('微信未返回草稿编号，请到草稿箱核对')
   result={'fingerprint':fingerprint,'account':account,'media_id':media_id,'verified':False,'message':'草稿已保存'}
   save_json(receipt,result)
   try:
    draft=client.call('cgi-bin/draft/get',{'media_id':media_id})
    result['verified']=bool(draft.get('news_item'));result['message']='草稿已保存并回读确认' if result['verified'] else '草稿已保存，回读未返回文章'
   except ValueError:result['message']='草稿已保存；回读失败，可在草稿列表中确认'
   save_json(receipt,result);return result
  if route=='/api/analytics/articles':
   items=self._dispatch('/api/pending/list',{'stage':'published'})['items']
   for item in items:
    path=self.article_analysis_path(item['id']);report=json.loads(path.read_text()) if path.exists() else None
    if report and report.get('msgid')!=item['sync']['publication'].get('msgid'):report=None
    item['analytics_report']=report
   return {'items':items}
  if route=='/api/analytics/attach':
   path=self.pending_path(data.get('id'));e=json.loads(path.read_text());sync=self.sync_state(e)
   if not sync or not sync.get('publication'):raise ValueError('请先关联已发布文章')
   report_path=self.root/'analysis.json'
   if not report_path.exists():raise ValueError('请先查询或导入数据')
   report=json.loads(report_path.read_text())
   if report.get('account')!=self.account_identity() or report.get('report_id')!=data.get('report_id'):raise ValueError('分析数据已变化，请重新查询或导入')
   msgid=sync['publication'].get('msgid');rows=report.get('records',[])
   confirmed=data.get('confirmed') is True and report.get('source') in ('CSV','import')
   if confirmed:
    ids={str(r['msgid']) for r in rows if r.get('msgid')}
    if ids and (not msgid or ids!={str(msgid)}):raise ValueError('文件中的数据编号与本篇不一致，请先核对关联')
   else:rows=[r for r in rows if msgid and str(r.get('msgid'))==str(msgid)]
   if not rows:raise ValueError('尚未匹配本篇数据；无编号的单篇文件需要确认范围')
   totals=analyze_rows(rows)['totals'] if report.get('totals') else {}
   saved={**report,'records':rows,'totals':totals,'rows':len(rows),'msgid':msgid,'article_id':e['id'],'scoped':True,'saved_at':datetime.now(timezone.utc).isoformat()}
   save_json(self.article_analysis_path(e['id']),saved);return saved
  if route=='/api/analytics/import':
   from analytics_import import read_export,read_overview_export
   try:raw=base64.b64decode(data.get('data',''),validate=True)
   except (ValueError,TypeError):raise ValueError('文件编码无效') from None
   special=read_overview_export(raw,str(data.get('name','')))
   if special:return self.save_analysis(special)
   rows,sheet=read_export(raw,str(data.get('name','')))
   report=analyze_rows(rows) if data.get('mode')=='incremental' else {'rows':len(rows),'totals':{},'records':rows,'notes':['当前为累计快照或未确认口径，不计算跨行合计。']}
   report.update(complete=True,source='import',sheet=sheet)
   return self.save_analysis(report)
  if route=='/api/csv':
   text=data.get('text','').lstrip('\ufeff')
   if len(text)>4*1024*1024:raise ValueError('CSV 请控制在 4 MB 内')
   reader=csv.DictReader(io.StringIO(text));rows=[{ALIASES.get(k,k):v for k,v in row.items() if k is not None} for row in reader]
   if not rows:raise ValueError('CSV 没有可读取的数据行')
   if data.get('mode')=='incremental':report=analyze_rows(rows)
   else:report={'rows':len(rows),'totals':{},'records':rows,'notes':['当前为累计快照或未确认口径，不计算跨行合计。']}
   report['complete']=True;report['source']='CSV';return self.save_analysis(report)
  if route=='/api/analytics':
   begin,end=str(data.get('begin','')),str(data.get('end',''))
   windows=date_windows(begin,end,days=1)
   if date.fromisoformat(end)>=date.today():raise ValueError('结束日期请选择昨天或更早')
   if len(windows)>31:raise ValueError('单次查询最多 31 天')
   client=self.client_factory();rows=[];completed=[];failure=None
   for first,last in windows:
    try:
     response=client.call('datacube/getarticlesummary',{'begin_date':first,'end_date':last})
     if not isinstance(response.get('list'),list):raise ValueError('数据响应缺少明细')
     rows.extend(response['list']);completed.append(first)
    except ValueError as e:failure=str(e);break
   if failure and not completed:raise ValueError(failure)
   report=analyze_rows(rows);report.update(source='getarticlesummary',begin=begin,end=end,complete=failure is None,completed_dates=completed,error=failure)
   return self.save_analysis(report)
  raise ValueError('未知工作台操作')
