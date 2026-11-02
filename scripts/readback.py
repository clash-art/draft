"""Semantic checks after WeChat has accepted a draft (not a visual guarantee)."""
import re
from collections import Counter
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup

def _text(value):return re.sub(r'\s+', '', str(value or ''))
def _url(value):
 parts=urlsplit(str(value or ''))
 path=unquote(parts.path).rstrip('/')
 if parts.hostname and parts.hostname.endswith('qpic.cn'):path=re.sub(r'/(0|640|1080)$','',path)
 return (parts.hostname,path,parts.query if not (parts.hostname or '').endswith('qpic.cn') else '')

def compare_readback(expected, actual):
 before=BeautifulSoup(expected.get('content',''),'html.parser');after=BeautifulSoup(actual.get('content',''),'html.parser');issues=[]
 for soup in (before,after):
  for el in soup.select('script,style'):el.decompose()
 if _text(expected.get('title'))!=_text(actual.get('title')):issues.append('标题与提交内容不同。')
 if _text(before.get_text())!=_text(after.get_text()):issues.append('正文文字与提交内容不同，请核对是否缺失或被改写。')
 wanted=before.find_all('img');got=after.find_all('img')
 if len(wanted)!=len(got):issues.append(f'图片数量不同：提交 {len(wanted)} 张，回读 {len(got)} 张。')
 elif wanted and all(urlsplit(i.get('src','')).scheme in ('http','https') for i in wanted):
  if [_url(i.get('src')) for i in wanted]!=[_url(i.get('src')) for i in got]:issues.append('图片地址或顺序不同，请检查配图。')
 if len(before.find_all('li'))!=len(after.find_all('li')):issues.append('列表条目数量与提交内容不同。')
 if any(not li.get_text(strip=True) and not li.find(['img','table']) for li in after.find_all('li')):issues.append('回读中存在空列表条目。')
 actual_links=Counter((_text(a.get_text()),_url(a.get('href'))) for a in after.select('a[href]'))
 wx_links=Counter(_text(a.get_text()) for a in after.select('a[href]') if urlsplit(a.get('href','')).hostname=='mp.weixin.qq.com')
 for a in before.select('a[href]'):
  label=_text(a.get_text());target=a.get('href','');key=(label,_url(target))
  if urlsplit(target).hostname=='mp.weixin.qq.com' and wx_links[label]:wx_links[label]-=1;continue
  if actual_links[key]:actual_links[key]-=1;continue
  issues.append(f'超链接丢失或变化：{label or target}。')
 if 'content_source_url' in expected and _url(expected.get('content_source_url'))!=_url(actual.get('content_source_url')):issues.append('“阅读原文”链接与提交内容不同。')
 return {'content_matches':not issues,'issues':issues,'note':'回读检查文字、图片和链接等结构；最终排版仍需在微信编辑器预览。'}
