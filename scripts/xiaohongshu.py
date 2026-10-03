"""Small, independently implemented creator-browser connector.

Reference workflow: BetaStreetOmnis/xhs_ai_publisher (Apache-2.0).
No upstream runtime, imported browser cookies, or private HTTP signing code.
"""
import queue,threading,concurrent.futures,os
from pathlib import Path

class Connector:
 def __init__(self,root):
  self.root=Path(root)/'xiaohongshu-profile'
  self.jobs=queue.Queue();self.context=None;self.page=None
  threading.Thread(target=self.worker,daemon=True).start()
 def worker(self):
  while True:
   action,data,future=self.jobs.get()
   try:future.set_result(self.perform(action,data))
   except Exception as exc:
    # Browser errors may contain page data; return a bounded, non-secret diagnostic.
    message=str(exc) if isinstance(exc,ValueError) else '小红书页面未完成操作。请检查登录、页面变化或图片上传，然后重试。'
    future.set_exception(ValueError(message))
 def call(self,action,**data):
  future=concurrent.futures.Future();self.jobs.put((action,data,future))
  try:return future.result(timeout=150)
  except concurrent.futures.TimeoutError:raise ValueError('小红书操作仍在执行，请先在浏览器核对，不要重复提交') from None
 def launch(self):
  if self.context:
   try:self.page.title();return
   except Exception:self.context=None
  try:
   from playwright.sync_api import sync_playwright
  except ImportError:raise ValueError('请安装插件的 Playwright 依赖后再连接小红书') from None
  self.root.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(self.root,0o700)
  self.driver=sync_playwright().start()
  try:self.context=self.driver.chromium.launch_persistent_context(str(self.root),channel='chrome',headless=False,viewport={'width':1280,'height':900})
  except Exception:
   self.driver.stop();raise ValueError('无法打开 Chrome，请安装 Chrome，并关闭占用小红书专用会话的窗口') from None
  self.page=self.context.pages[0] if self.context.pages else self.context.new_page()
  self.page.set_default_timeout(15000)
 def perform(self,action,data):
  if action=='status':
   if not self.page:return {'status':'disconnected'}
   try:
    if self.page.is_closed():return {'status':'disconnected'}
    url=self.page.url
    logged='creator.xiaohongshu.com' in url and '/login' not in url and self.page.get_by_text('发布笔记',exact=True).count()>0
    return {'status':'connected' if logged else 'check_browser'}
   except Exception:return {'status':'disconnected'}
  self.launch()
  if action=='login':
   self.page.goto('https://creator.xiaohongshu.com/',wait_until='domcontentloaded');self.page.bring_to_front()
   return {'status':'check_browser','message':'请在打开的 Chrome 中完成登录，登录态仅保存在本机专用会话。'}
  if action!='prepare':raise ValueError('未知小红书操作')
  self.page.goto('https://creator.xiaohongshu.com/publish/publish?source=official',wait_until='domcontentloaded')
  self.page.bring_to_front()
  if '/login' in self.page.url:raise ValueError('小红书会话已过期，请先登录')
  self.page.get_by_text('上传图文',exact=True).first.click()
  self.page.locator('input[type=file]').first.set_input_files(data['images'])
  title=self.page.locator('input[placeholder*="标题"]').first
  title.wait_for(state='visible',timeout=60000);title.fill(data['title'])
  body=self.page.locator('div.ProseMirror[contenteditable=true]').first
  body.fill(data['body'])
  if title.input_value()!=data['title'] or body.inner_text().strip()!=data['body'].strip():raise ValueError('标题或正文回读不一致，请在浏览器检查内容')
  return {'status':'filled','message':'图文已填入小红书页面。请核对图片上传和正文后，在小红书中发布。'}

_instances={};_lock=threading.Lock()
def connect(root):
 with _lock:
  key=str(Path(root).resolve())
  if key not in _instances:_instances[key]=Connector(root)
  return _instances[key]
