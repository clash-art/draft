"""Independent channel editions and native Xiaohongshu browser connector."""
import json,uuid,re
from datetime import datetime,timezone
from urllib.parse import urlsplit
import requests,markdown
from bs4 import BeautifulSoup
from wechat import save_json
from templates import render,BUILTINS,validate
from palette import validate_palette
from xhs_longform_templates import catalog as longform_catalog

from xhs_cards import BUILTINS as XHS_TEMPLATES
from xhs_cards import catalog as xhs_catalog,validate as validate_xhs

def xhs_template(value,root=None):
 identifier=(value or {}).get('id','xhs-guide')
 for template in (xhs_catalog(root) if root else XHS_TEMPLATES):
  if template['id']==identifier:return template
 # Preserve a saved template snapshot after its catalog entry is deleted.
 if value and all(k in value for k in ('name','accent','background','instructions')):return validate_xhs(value)
 raise ValueError('未知小红书模板')

def path(ws,identifier,channel):
 ws.pending_path(identifier)
 if channel not in ('wechat','xiaohongshu'):raise ValueError('未知发布渠道')
 folder=ws.root/'channels'/identifier;folder.mkdir(parents=True,exist_ok=True,mode=0o700)
 return folder/(channel+'.json')
def load(ws,e,channel):
 p=path(ws,e['id'],channel)
 if p.exists():
  result=json.loads(p.read_text())
  if channel=='xiaohongshu' and result.get('format')!='longform':
   selected=(result.get('template') or {}).get('id','xhs-guide')
   for builtin in XHS_TEMPLATES:
    if builtin['id']==selected:result['template']=builtin
  return result
 return {'channel':channel,'format':'longform','title':e.get('title',''),'body':e.get('body',''),'images':[a['ref'] for a in e.get('assets',[])],'template':longform_catalog(ws.root)[0] if channel=='xiaohongshu' else BUILTINS[0],'revision':None,'source_revision':e.get('revision'),'publication':None}
PALETTE_HINT=('配色跟随文章所讲的项目：从项目 logo、官网 CSS、README 或文档中取品牌色，写入 palette（paper 纸面、surface 浅底块、ink 标题、text 正文、muted 注释、primary 主色块、on_primary 主色上的文字、accent 次强调、rule 分隔线；六位十六进制），'
 'name 写配色名称，source 写取色来源。正文与纸面对比度需 ≥ 4.5。没有明确项目时不传，使用模板默认配色。')
BRIEF_INSTRUCTIONS=('默认完整长文：保留原稿标题、完整正文、段落顺序、图片和全部参考资料，body 与源稿一致，images 包含全部素材，不总结、不删减、不改写事实，不生成摘要卡片。'
 '只有用户明确要求精简（例如控制在 10 页以内）时才改写：由你决定内容——按插图顺序压缩正文、挑选关键插图、用单独一行的 <!-- page --> 指定分页、用 cover_page 写封面标题/副标题/最多 5 条要点，保留核心论点和引用编号，参考资料可写成短格式；保存时传 condensed=true。'
 '模板只决定字号、行距、颜色和装饰，不决定内容；从 templates 中选一项传给 save_channel_edition（format=longform）。不修改源稿，不同步或发布。分页图片由工作台或 MCP App 按模板生成，长文不按卡片截断。'+PALETTE_HINT)
IMAGE_REF=re.compile(r'!\[[^\]]*\]\(\s*<?([^)\s>]+)')
def completeness(e,edition):
 """How the edition compares with the full source; longform must not drop text or images."""
 images=edition.get('images',[])
 condensed=bool(edition.get('condensed'))
 return {'condensed':condensed,'title_matches_source':edition.get('title')==e.get('title'),'body_matches_source':edition.get('body')==e.get('body'),
         'source_chars':len(e.get('body','')),'edition_chars':len(edition.get('body','')),
         'missing_images':[a['ref'] for a in e.get('assets',[]) if a.get('ref') not in images],
         'body_images_not_listed':[ref for ref in IMAGE_REF.findall(edition.get('body','')) if ref not in images]}
def cover_page(value):
 """Agent-chosen cover text for the longform page set; templates only style it."""
 if not value:return None
 if not isinstance(value,dict):raise ValueError('封面内容无效')
 points=value.get('points') or []
 if not isinstance(points,list) or len(points)>5 or any(not isinstance(p,str) or not p.strip() or len(p)>30 for p in points):raise ValueError('封面要点最多 5 条，每条不超过 30 字')
 title,subtitle=str(value.get('title','')).strip(),str(value.get('subtitle','')).strip()
 if len(title)>40 or len(subtitle)>60:raise ValueError('封面标题或副标题过长')
 return {'title':title,'subtitle':subtitle,'points':[p.strip() for p in points]}
def longform_template(ws,value,edition):
 if value:return validate(value)
 current=edition.get('template') if edition.get('format')=='longform' else None
 return validate(current or longform_catalog(ws.root)[0])
def dispatch(ws,route,data):
 if route.startswith('/api/channels/templates/') and data.get('format')=='longform':
  from xhs_longform_templates import dispatch as templates_dispatch
  return templates_dispatch(ws.root,route,data)
 if route.startswith('/api/channels/templates/'):
  from xhs_cards import save,catalog
  if route.endswith('/list'):return {'items':catalog(ws.root)}
  if route.endswith('/save'):return save(ws.root,data.get('template'))
  if route.endswith('/delete'):
   identifier=str(data.get('id',''))
   if not re.fullmatch(r'[a-f0-9]{32}',identifier):raise ValueError('内置模板不可删除')
   p=ws.root/'xhs-templates'/(identifier+'.json')
   if not p.exists():raise ValueError('模板不存在')
   p.replace(p.with_suffix('.archived'));return {'removed':True}
  raise ValueError('未知模板操作')
 if route in ('/api/channels/status','/api/channels/login'):
  from xiaohongshu import connect
  return connect(ws.root).call('login' if route.endswith('/login') else 'status')
 e=json.loads(ws.pending_path(data.get('id')).read_text())
 channel=data.get('channel','xiaohongshu');edition=load(ws,e,channel)
 if route=='/api/channels/get':return {**edition,'layout_protocol':'longform-v1','source_changed':edition['source_revision']!=e['revision'],'completeness':completeness(e,edition),'templates':(longform_catalog(ws.root) if edition.get('format')=='longform' else xhs_catalog(ws.root)) if channel=='xiaohongshu' else []}
 if route=='/api/channels/brief':
  xhs=channel=='xiaohongshu'
  return {'layout_protocol':'longform-v1','format':'longform','content_id':e['id'],'channel':channel,'source_revision':e['revision'],'expected_revision':edition['revision'],
          'source':{'title':e['title'],'markdown':e['body'],'agent_context':e.get('agent_context',''),'assets':e.get('assets',[]),'cover':e.get('cover','')},
          'template':longform_template(ws,None,edition) if xhs else edition['template'],'templates':longform_catalog(ws.root) if xhs else [],
          'current_edition':edition,'completeness':completeness(e,edition),
          'instructions':BRIEF_INSTRUCTIONS if xhs else PALETTE_HINT,'palette':edition.get('palette')}
 if route=='/api/channels/save':
  if data.get('expected_revision')!=edition['revision']:raise ValueError('渠道版本已变化，请重新载入')
  if data.get('source_revision')!=e['revision']:raise ValueError('源内容已变化，请重新载入渠道版本')
  title=str(data.get('title',''));body=str(data.get('body',''))
  if len(title)>64 or len(body)>100000:raise ValueError('标题或正文过长')
  images=data.get('images',[])
  if not isinstance(images,list) or len(images)>50 or any(not isinstance(ref,str) for ref in images) or len(set(images))!=len(images):raise ValueError('图片列表无效')
  for ref in images:ws.image_path(ref)
  format=data.get('format',edition.get('format','cards'))
  if data.get('cards'):format='cards'
  if channel=='wechat':format='longform'
  if format=='longform':template=longform_template(ws,data.get('template'),edition) if channel=='xiaohongshu' else validate(data.get('template') or BUILTINS[0])
  else:template=xhs_template(data.get('template'),ws.root)
  edition['format']=format
  if channel=='xiaohongshu' and format=='cards':
   from xhs_cards import cards
   pages=cards(data.get('cards',edition.get('cards',[])),ws)
   changed=pages!=edition.get('cards',[]) or template!=edition.get('template')
   exported=data.get('rendered_for_revision')
   if exported:
    if exported!=edition['revision'] or changed or not pages:raise ValueError('卡片版本已变化，请重新生成图片')
    if len(images)!=len(pages):raise ValueError('导出图片数量与卡片不一致')
    from PIL import Image
    for ref in images:
     with Image.open(ws.image_path(ref)) as image:
      if image.format!='PNG' or image.size!=(1080,1440):raise ValueError('卡片图片必须为 1080×1440 PNG')
    edition['render_pending']=False
   elif pages and (changed or edition.get('render_pending') or len(images)!=len(pages)):
    images=[];edition['render_pending']=True
   elif not pages:edition['render_pending']=False
   edition['cards']=pages
  palette=validate_palette(data['palette']) if 'palette' in data else edition.get('palette')
  if format=='longform':
   cover=cover_page(data['cover_page']) if 'cover_page' in data else edition.get('cover_page')
   condensed=bool(data.get('condensed',edition.get('condensed',False)))
   changed=title!=edition.get('title') or body!=edition.get('body') or template!=edition.get('template') or cover!=edition.get('cover_page') or palette!=edition.get('palette')
   if data.get('rendered_for_revision'):
    if data['rendered_for_revision']!=edition['revision'] or changed:raise ValueError('文章版本已变化，请重新导出')
    refs=data.get('page_images',[])
    if not isinstance(refs,list) or not refs or len(refs)!=data.get('page_count') or len(refs)>200:raise ValueError('分页图片数量无效')
    from PIL import Image
    for ref in refs:
     with Image.open(ws.image_path(ref)) as img:
      expected_size={'3:4':(1080,1440),'3:5':(1080,1800),'1:1':(1080,1080),'9:16':(1080,1920)}.get(template.get('page_ratio','3:4'))
      if img.format!='PNG' or img.size!=expected_size:raise ValueError('分页图片尺寸与所选比例不一致')
    edition['page_images']=refs
   elif changed:edition['page_images']=[]
   edition.update(cards=[],cover_page=cover,condensed=condensed,render_pending=not bool(edition.get('page_images')))

  edition.update(title=title,body=body,images=images,template=template,palette=palette,revision=uuid.uuid4().hex,source_revision=e['revision'])
  save_json(path(ws,e['id'],channel),edition);return {**edition,'completeness':completeness(e,edition)}
 if route=='/api/channels/preview':
  html=render(edition['body'],edition['template'],edition.get('palette')) if channel=='wechat' or edition.get('format')=='longform' else '<p>'+__import__('html').escape(edition['body']).replace('\n','<br/>')+'</p>'
  from wechat import image_bytes
  import base64
  soup=BeautifulSoup(html,'html.parser')
  for image in soup.find_all('img'):
   raw,mime,_=image_bytes(ws.image_path(image.get('src','')));image['src']='data:'+mime+';base64,'+base64.b64encode(raw).decode()
  return {'html':str(soup)}
 if channel!='xiaohongshu':raise ValueError('该操作仅适用于小红书渠道')
 if route=='/api/channels/prepare':
  if edition.get('format')=='longform':raise ValueError('这是完整长文，请使用小红书创作中心的长文入口；不会转为短图文提交')
  if edition.get('render_pending'):raise ValueError('请先在 App 中生成最新卡片图片')
  if edition.get('publication'):raise ValueError('该渠道已关联发布记录，请先创建新内容，避免重复发布')
  if not edition['revision'] or data.get('expected_revision')!=edition['revision']:raise ValueError('请先保存当前渠道版本')
  if not edition['title'].strip() or len(edition['title'])>20:raise ValueError('小红书标题请控制在 1–20 字')
  if not edition['body'].strip() or len(edition['body'])>1000:raise ValueError('小红书正文请控制在 1–1000 字；长文请改编后发布')
  if not 1<=len(edition['images'])<=18:raise ValueError('请选择 1–18 张笔记图片')
  receipt=edition.get('delivery') or {}
  if receipt.get('status') in ('submitting','filled','needs_check'):
   raise ValueError('已有待确认的发布任务，请先在浏览器核对，再清除任务状态')
  from xiaohongshu import connect
  edition['delivery']={'status':'submitting','revision':edition['revision']}
  save_json(path(ws,e['id'],channel),edition)
  try:
   result=connect(ws.root).call('prepare',title=edition['title'],body=edition['body'],images=[str(ws.image_path(ref)) for ref in edition['images']])
  except ValueError:
   edition['delivery']['status']='needs_check';save_json(path(ws,e['id'],channel),edition);raise
  edition['delivery'].update(result);save_json(path(ws,e['id'],channel),edition)
  return edition
 if route=='/api/channels/reset-delivery':
  if data.get('expected_revision')!=edition['revision']:raise ValueError('渠道版本已变化，请重新载入')
  edition['delivery']=None;save_json(path(ws,e['id'],channel),edition);return edition
 if route=='/api/channels/published':
  if not edition.get('revision'):raise ValueError('请先保存渠道版本')
  u=urlsplit(str(data.get('url','')))
  if u.scheme!='https' or u.hostname not in ('www.xiaohongshu.com','xiaohongshu.com','xhslink.com') or u.username or u.password or u.path in ('','/'):raise ValueError('请输入小红书正式笔记链接')
  if data.get('expected_revision')!=edition['revision']:raise ValueError('渠道版本已变化，请重新载入')
  edition['publication']={'url':u.geturl(),'confirmed_at':datetime.now(timezone.utc).isoformat(),'revision':edition['revision']}
  save_json(path(ws,e['id'],channel),edition);return edition
 raise ValueError('未知渠道操作')
