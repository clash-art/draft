"""Developer visual check: screenshot a WeChat article at phone width for each layout.

Renders the example's WeChat edition (body + palette) with every built-in article layout,
wraps it in a WeChat-like article page (375px, 2x) and saves full-length PNGs, first-screen
crops and a contact sheet. Uses a throwaway workspace; requires Playwright with Chrome.
"""
import argparse,base64,json,shutil,sys,tempfile
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))

PAGE='''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width={width}">
<style>{faces}html,body{{margin:0;background:#ffffff}}.wrap{{padding:20px 16px 40px}}h1.t{{margin:0 0 12px;font:700 22px/1.4 -apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif;color:#1a1a1a;letter-spacing:.5px}}
.meta{{margin:0 0 22px;font:15px/1.5 -apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif;color:#8c8c8c}}.meta b{{color:#576b95;font-weight:400}}</style></head>
<body><div class="wrap"><h1 class="t">{title}</h1><div class="meta">{author}　<b>{account}</b></div><div id="js_content">{body}</div></div></body></html>'''

def reader_faces():
 """The bundled Noto Serif SC slices under their own family name, standing in for the Song face a
 phone already has (Songti SC on iOS); the pasted article only names fonts, never embeds them."""
 manifest=json.loads((ROOT/'assets/fonts/manifest.json').read_text())
 face=next(f for f in manifest['faces'] if f['family']=='Draft Serif SC' and f['weight']==400)
 return ''.join(f"@font-face{{font-family:'Noto Serif SC';font-weight:400;src:url({(ROOT/'assets/fonts'/file).as_uri()}) format('woff2');unicode-range:{manifest['ranges'][key]}}}" for file,key in face['files'])

def inline_images(html,ws):
 from bs4 import BeautifulSoup
 from wechat import image_bytes
 soup=BeautifulSoup(html,'html.parser')
 for img in soup.find_all('img'):
  raw,mime,_=image_bytes(ws.image_path(unquote(img.get('src',''))));img['src']='data:'+mime+';base64,'+base64.b64encode(raw).decode()
 return str(soup)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--example',default=str(ROOT/'examples/xhs-longform-agent-self-evolution'))
 parser.add_argument('--templates',default='all')
 parser.add_argument('--out',default=str(ROOT/'work/wechat-article'))
 parser.add_argument('--width',type=int,default=375,help='手机视口宽度（CSS 像素）')
 parser.add_argument('--no-palette',action='store_true',help='忽略渠道版本的项目配色，使用模板默认配色')
 parser.add_argument('--chrome',default=shutil.which('google-chrome') or shutil.which('chromium'))
 args=parser.parse_args()
 from load_example import load
 from workspace import Workspace
 from channels import load as load_edition
 from templates import BUILTINS,render
 from render_xhs_pages import contact_sheet
 from PIL import Image
 from playwright.sync_api import sync_playwright
 out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
 summary=[]
 with tempfile.TemporaryDirectory() as tmp:
  root=Path(tmp)/'workspace';loaded=load(args.example,root);ws=Workspace(root,lambda:None)
  e=json.loads(ws.pending_path(loaded['id']).read_text());edition=load_edition(ws,e,'wechat')
  palette=None if args.no_palette else edition.get('palette')
  chosen=[t for t in BUILTINS if args.templates=='all' or t['id'] in args.templates.split(',')]
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=args.chrome) if args.chrome else p.chromium.launch()
   page=browser.new_page(viewport={'width':args.width,'height':812},device_scale_factor=2)
   faces=reader_faces();html_file=out/'_page.html'
   for t in chosen:
    body=inline_images(render(edition['body'],t,palette,ws),ws)
    html_file.write_text(PAGE.format(width=args.width,faces=faces,title=edition['title'],author=e.get('author') or '作者',account='公众号名称',body=body),encoding='utf-8')
    page.goto(html_file.as_uri(),wait_until='load');page.evaluate('document.fonts.ready');page.wait_for_timeout(300)
    full=out/f"{t['id']}-full.png";page.screenshot(path=str(full),full_page=True)
    image=Image.open(full);screens=[]
    for i,top in enumerate(range(0,min(image.height,1624*4),1624)):
     crop=out/f"{t['id']}-screen-{i+1}.png";image.crop((0,top,image.width,min(top+1624,image.height))).save(crop,optimize=True);screens.append(crop)
    summary.append({'template':t['id'],'name':t['name'],'height_css':image.height//2,'screens':[s.name for s in screens]})
   browser.close();html_file.unlink(missing_ok=True)
  sheet=[]
  for t in chosen:sheet+=sorted(out.glob(f"{t['id']}-screen-*.png"),key=lambda f:int(f.stem.rsplit('-',1)[1]))
  contact_sheet(sheet,out/'contact-sheet.png',columns=4,width=300)
 (out/'summary.json').write_text(json.dumps({'palette':palette,'templates':summary},ensure_ascii=False,indent=1))
 print(json.dumps({'out':str(out),'templates':[s['template'] for s in summary]},ensure_ascii=False))

if __name__=='__main__':main()
