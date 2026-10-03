"""Local image-card templates. No publishing or remote resources."""
import re,json,uuid,base64,html
from wechat import save_json
BUILTINS=[
 {'id':'xhs-guide','name':'步骤图解','accent':'#176747','background':'#f2f5ef','instructions':'封面提出具体问题；每页讲一个步骤，搭配示例图；末页给行动建议。'},
 {'id':'xhs-insight','name':'观点画报','accent':'#ad442d','background':'#fcf4ec','instructions':'封面给出核心观点；中间逐页展示论据与原始配图；末页保留来源与结论。'},
 {'id':'xhs-checklist','name':'收藏清单','accent':'#31577b','background':'#f0f4f8','instructions':'封面明确适用场景；每页一个清单主题；末页汇总可执行检查项。'}]
def catalog(root):
 folder=root/'xhs-templates';folder.mkdir(exist_ok=True)
 return BUILTINS+[json.loads(p.read_text()) for p in sorted(folder.glob('*.json'))]
def validate(value):
 if not isinstance(value,dict):raise ValueError('模板格式无效')
 out={k:str(value.get(k,'')) for k in ('id','name','accent','background','instructions')}
 if not out['name'].strip() or len(out['name'])>40 or len(out['instructions'])>3000:raise ValueError('请填写模板名称，说明不超过 3000 字')
 for key in ('accent','background'):
  if not re.fullmatch(r'#[0-9a-fA-F]{6}',out[key]):raise ValueError('请选择有效颜色')
 return out
def save(root,value):
 t=validate(value)
 if not re.fullmatch(r'[a-f0-9]{32}',t['id']):t['id']=uuid.uuid4().hex
 folder=root/'xhs-templates';folder.mkdir(exist_ok=True)
 save_json(folder/(t['id']+'.json'),t);return t
def cards(value,ws):
 if not isinstance(value,list) or len(value)>18:raise ValueError('图文卡片最多 18 页')
 out=[]
 for c in value:
  if not isinstance(c,dict):raise ValueError('卡片格式无效')
  title=str(c.get('title',''));text=str(c.get('text',''));ref=str(c.get('image_ref',''))
  if not title.strip() or len(title)>50 or len(text)>240:raise ValueError('每页需有标题（最多50字），内容最多240字')
  if ref:ws.image_path(ref)
  out.append({'title':title,'text':text,'image_ref':ref})
 return out
def document(t,c,index,total,image=''):
 t=validate(t);esc=html.escape
 return f'''<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;width:1080px;height:1440px;background:{t['background']};color:#202723;font-family:"PingFang SC","Noto Sans CJK SC",sans-serif}}article{{height:100%;padding:88px;display:flex;flex-direction:column;gap:40px}}h1{{font-size:{78 if index==0 else 60}px;line-height:1.3;margin:0;color:{t['accent']};overflow-wrap:anywhere}}p{{font-size:34px;line-height:1.65;white-space:pre-wrap;margin:0;overflow-wrap:anywhere}}img{{width:100%;min-height:0;flex:1;object-fit:contain}}footer{{margin-top:auto;padding-top:24px;border-top:2px solid {t['accent']};font-size:25px;color:{t['accent']};display:flex;justify-content:space-between}}</style><article><h1>{esc(c['title'])}</h1>{'<img src="'+image+'">' if image else ''}<p>{esc(c['text'])}</p><footer><span>{esc(t['name'])}</span><span>{index+1} / {total}</span></footer></article>'''
