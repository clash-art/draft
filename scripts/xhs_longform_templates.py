"""Longform typography catalog, separate from legacy summary-card templates."""
import json,re,uuid
from pathlib import Path
from templates import validate,LONGFORM_FONT_MIN
from wechat import save_json

def catalog(root):
 folder=root/'xhs-longform-templates'
 builtins=json.loads((Path(__file__).resolve().parent.parent/'assets/xhs-longform-presets.json').read_text())
 return builtins+[validate(json.loads(p.read_text()),LONGFORM_FONT_MIN) for p in sorted(folder.glob('*.json'))]

def dispatch(root,route,data):
 folder=root/'xhs-longform-templates'
 if route.endswith('/list'):return {'items':catalog(root),'format':'longform'}
 if route.endswith('/save'):
  value=validate(data.get('template') or {},LONGFORM_FONT_MIN)
  if not re.fullmatch(r'[a-f0-9]{32}',value['id']):value['id']=uuid.uuid4().hex
  folder.mkdir(parents=True,exist_ok=True,mode=0o700)
  save_json(folder/(value['id']+'.json'),value)
  return value
 if route.endswith('/delete'):
  identifier=str(data.get('id',''))
  if not re.fullmatch(r'[a-f0-9]{32}',identifier):raise ValueError('内置模板不可删除')
  path=folder/(identifier+'.json')
  if not path.exists():raise ValueError('模板不存在')
  path.replace(path.with_suffix('.archived'))
  return {'removed':True}
 raise ValueError('未知长文模板操作')
