"""Developer visual check: render Xiaohongshu longform pages to PNG in headless Chrome.

Starts a local workbench backend on a throwaway copy of an example, serves
frontend/harness/xhs-pages.html with Vite, and runs the same pagination and
html-to-image export code as the app. Requires `npm ci` in frontend/ and
Playwright with a local Chrome (or --chrome PATH).
"""
import argparse,base64,io,json,os,shutil,subprocess,sys,tempfile,threading,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))

def contact_sheet(files,out,columns=6,width=270):
 from PIL import Image,ImageDraw
 images=[Image.open(f).convert('RGB') for f in files]
 height=round(width*images[0].height/images[0].width);gap=18;label=22
 rows=(len(images)+columns-1)//columns
 sheet=Image.new('RGB',(columns*width+(columns+1)*gap,rows*(height+label+gap)+gap),'#e7e5e0');draw=ImageDraw.Draw(sheet)
 for i,image in enumerate(images):
  x=gap+(i%columns)*(width+gap);y=gap+(i//columns)*(height+label+gap)
  sheet.paste(image.resize((width,height),Image.LANCZOS),(x,y));draw.text((x,y+height+5),f'{i+1}',fill='#555')
 sheet.save(out,optimize=True)

def wait_http(url,timeout=60):
 end=time.time()+timeout
 while time.time()<end:
  try:urllib.request.urlopen(url,timeout=2);return
  except Exception:time.sleep(.3)
 raise TimeoutError(url)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--example',default=str(ROOT/'examples/xhs-longform-agent-self-evolution'))
 parser.add_argument('--templates',default='all',help='逗号分隔的模板 id，默认全部内置长文模板')
 parser.add_argument('--out',default=str(ROOT/'work/xhs-pages'))
 parser.add_argument('--chrome',default=shutil.which('google-chrome') or shutil.which('chromium'))
 parser.add_argument('--port',type=int,default=5199)
 parser.add_argument('--full',action='store_true',help='渲染完整源稿（不使用渠道版本的精简正文与封面内容）')
 parser.add_argument('--no-palette',action='store_true',help='忽略渠道版本的项目配色，使用模板默认配色')
 parser.add_argument('--save',action='store_true',help='同时走完整导出：上传分页 PNG 并保存到渠道版本（只写临时工作区）')
 args=parser.parse_args()
 from config_ui import make_server
 from load_example import load
 from playwright.sync_api import sync_playwright
 tmp=Path(tempfile.mkdtemp(prefix='xhs-render-'))
 load(args.example,tmp/'workspace')
 server=make_server(tmp/'credentials.json');threading.Thread(target=server.serve_forever,daemon=True).start()
 env={**os.environ,'XHS_BACKEND':f'http://127.0.0.1:{server.server_port}','XHS_TOKEN':server.token}
 vite=subprocess.Popen(['npx','vite','--config','vite.harness.config.js','--port',str(args.port),'--host','127.0.0.1'],cwd=ROOT/'frontend',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True);summary={}
 try:
  url=f'http://127.0.0.1:{args.port}/harness/xhs-pages.html';wait_http(url)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=args.chrome) if args.chrome else p.chromium.launch()
   page=browser.new_page(viewport={'width':1600,'height':1000})
   page.on('console',lambda m:m.type=='error' and print('console:',m.text,file=sys.stderr))
   page.on('pageerror',lambda e:print('pageerror:',e,file=sys.stderr))
   page.goto(url);page.wait_for_function('window.__xhs&&window.__xhs.ready',timeout=60000)
   ids=[t['id'] for t in page.evaluate('__xhs.templates()') if not __import__('re').fullmatch(r'[a-f0-9]{32}',t['id'])] if args.templates=='all' else args.templates.split(',')
   for identifier in ids:
    result=page.evaluate('([id,full,noPalette])=>__xhs.render(id,{full,noPalette})',[identifier,args.full,args.no_palette])
    folder=out/identifier
    if folder.exists():shutil.rmtree(folder)
    folder.mkdir(parents=True);files=[]
    for i,data in enumerate(result['pngs']):
     f=folder/f'page-{i+1:02d}.png';f.write_bytes(base64.b64decode(data));files.append(f)
    contact_sheet(files,out/f'{identifier}-contact-sheet.png')
    (folder/'layout.json').write_text(json.dumps(result['meta'],ensure_ascii=False,indent=1))
    fills=[p.get('fill',1) for p in result['meta']['pages'][1:-1]]
    summary[identifier]={'name':result['template']['name'],'pages':result['count'],'min_fill':min(fills),'avg_fill':round(sum(fills)/len(fills),2),'sparse_pages':[i+2 for i,f in enumerate(fills) if f<0.75],'over_limit':result['meta'].get('over_limit',False)}
    print(identifier,json.dumps(summary[identifier],ensure_ascii=False),flush=True)
   if args.save:
    saved=page.evaluate('id=>__xhs.exportAndSave(id)',ids[0])
    summary['saved']={'template':saved['template']['id'],'page_images':len(saved['page_images']),'render_pending':saved['render_pending'],'body_equals_source':saved['body']==json.loads((Path(args.example)/'editor.json').read_text())['body'],'condensed':saved.get('condensed',False),'page_count':len(saved['page_images'])}
    print('saved',json.dumps(summary['saved'],ensure_ascii=False))
   browser.close()
  (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 finally:
  os.killpg(vite.pid,15);server.shutdown();shutil.rmtree(tmp,ignore_errors=True)

if __name__=='__main__':main()
