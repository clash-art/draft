"""Load a bundled example article and its channel editions into a local workspace.

Copies editor.json, channels/*.json and images/ only. Never reads or writes credentials.
"""
import argparse,json,shutil,sys
from pathlib import Path
from config_ui import config_path
from wechat import save_json
from workspace import Workspace

def load(example,root,force=False,open_editor=True):
 example,root=Path(example),Path(root)
 editor=json.loads((example/'editor.json').read_text(encoding='utf-8'))
 ws=Workspace(root,lambda:None)
 pending=ws.pending_path(editor['id'])
 if pending.exists() and not force:raise ValueError(f'工作区已有这篇文章：{pending}；确认覆盖请加 --force')
 for image in sorted((example/'images').glob('*.png')):
  target=root/'images'/image.name
  if not target.exists():shutil.copyfile(image,target)
 for ref in [a['ref'] for a in editor.get('assets',[])]+([editor['cover']] if editor.get('cover') else []):ws.image_path(ref)
 save_json(pending,editor)
 if open_editor:save_json(root/'editor.json',editor)
 channels=[]
 for edition in sorted((example/'channels').glob('*.json')):
  value=json.loads(edition.read_text(encoding='utf-8'))
  for ref in value.get('images',[])+value.get('page_images',[]):ws.image_path(ref)
  save_json(root/'channels'/editor['id']/edition.name,value);channels.append(edition.stem)
 return {'id':editor['id'],'workspace':str(root),'channels':channels,'opened':open_editor}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('example',help='例如 examples/xhs-longform-agent-self-evolution')
 parser.add_argument('--workspace',help='默认 ~/.config/wechat-drafts/workspace（或 WECHAT_CONFIG_PATH 同级的 workspace）')
 parser.add_argument('--force',action='store_true',help='覆盖工作区中同一编号的文章与渠道版本')
 parser.add_argument('--no-open',action='store_true',help='只加入内容列表，不切换当前编辑的文章')
 args=parser.parse_args()
 try:print(json.dumps(load(args.example,args.workspace or config_path().parent/'workspace',args.force,not args.no_open),ensure_ascii=False))
 except ValueError as e:sys.exit(str(e))

if __name__=='__main__':main()
