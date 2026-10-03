"""WeChat draft preparation, image upload and analytics. No publishing endpoints."""
import argparse
import csv
import io
import json
import os
import tempfile
from pathlib import Path
import sys
from datetime import date, timedelta
from urllib.parse import urlparse, unquote
import requests
import markdown
from bs4 import BeautifulSoup
from PIL import Image, ImageOps

API = 'https://api.weixin.qq.com/'
COUNT_FIELDS = ('int_page_read_count', 'ori_page_read_count', 'share_count', 'add_to_fav_count')
ALIASES = {'图文消息ID':'msgid','图文消息id':'msgid','消息ID':'msgid','日期':'ref_date','文章标题':'title','标题':'title','阅读次数':'int_page_read_count','阅读人数':'int_page_read_user','分享次数':'share_count','分享人数':'share_user','收藏次数':'add_to_fav_count','收藏人数':'add_to_fav_user'}

def image_bytes(path):
    with Image.open(path) as original:
        if getattr(original, 'is_animated', False):
            raise ValueError('动图需要单独处理，本插件不自动丢弃动画帧')
        im = ImageOps.exif_transpose(original)
        im.thumbnail((1920, 1920))
        out = io.BytesIO()
        im.save(out, format='PNG')
        if len(out.getvalue()) < 1000000:
            return out.getvalue(), 'image/png', 'image.png'
        background = Image.new('RGB', im.size, 'white')
        if 'A' in im.getbands(): background.paste(im, mask=im.getchannel('A'))
        else: background.paste(im.convert('RGB'))
        for quality in (90, 80, 65):
            out = io.BytesIO(); background.save(out, 'JPEG', quality=quality)
            if len(out.getvalue()) < 1000000:
                return out.getvalue(), 'image/jpeg', 'image.jpg'
        raise ValueError('图片压缩后仍超过 1 MB，请手动缩小图片')

def prepare(path, title):
    path = Path(path).resolve()
    text = path.read_text(encoding='utf-8')
    html = markdown.markdown(text, extensions=['tables', 'fenced_code']) if path.suffix.lower() in ('.md', '.markdown') else text
    soup = BeautifulSoup(html, 'html.parser')
    errors, warnings, images = [], [], []
    if not title.strip(): errors.append('标题不能为空')
    if len(title) > 64: errors.append('标题超过 64 字符')
    for node in soup.find_all(['script','iframe','object','embed','form','input','link','style','svg']):
        errors.append('不支持的 HTML 标签：' + node.name)
    for node in soup.find_all(True):
        if any(k.lower().startswith('on') for k in node.attrs): errors.append('不支持 HTML 事件属性')
        if 'url(' in str(node.get('style','')).lower(): errors.append('CSS 背景图片需改为正文 img 图片')
    for img in soup.find_all('img'):
        src = img.get('src', '')
        record = {'src':src, 'alt':img.get('alt','')}
        parsed = urlparse(src)
        if parsed.scheme or parsed.netloc or not src:
            errors.append('请先将图片保存为本地文件，再引用：' + src[:150])
        else:
            local = (path.parent / unquote(parsed.path)).resolve()
            record['path'] = str(local)
            try:
                data, mime, name = image_bytes(local)
                with Image.open(local) as im: record.update(width=im.width, height=im.height)
                record['upload_bytes'] = len(data)
                img['src'] = local.as_uri()
                if record['width'] < 600: warnings.append('低分辨率图片，请检查手机端文字清晰度：' + src)
            except (OSError, ValueError, Image.DecompressionBombError): errors.append('图片缺失、损坏、过大或格式不支持：' + src)
        if not record['alt']: warnings.append('图片缺少说明：' + src)
        images.append(record)
        img.attrs.pop('srcset', None)
        img['style'] = 'display:block;max-width:100%;height:auto;margin:20px auto;'
    for paragraph in soup.find_all('p'):
        if len(paragraph.get_text()) > 300: warnings.append('存在超过 300 字的长段落，建议拆分')
        if not paragraph.get('style'): paragraph['style'] = 'font-size:16px;line-height:1.8;margin:16px 0;'
    if soup.find('table'): warnings.append('包含表格，请检查手机窄屏是否溢出')
    for link in soup.find_all('a'):
        if urlparse(link.get('href','')).scheme.lower() in ('javascript','data'): errors.append('不支持的链接协议')
    plain = soup.get_text(' ', strip=True)
    return {'source':str(path),'title':title,'html':str(soup),'images':images,'errors':list(dict.fromkeys(errors)), 'warnings':list(dict.fromkeys(warnings)), 'text_characters':len(plain)}

def build_article(plan, cover, upload, author='', digest=''):
    if plan['errors']: raise ValueError('预检失败：' + '; '.join(plan['errors']))
    image_bytes(cover)  # Validate before any network mutation.
    soup = BeautifulSoup(plan['html'], 'html.parser')
    uploaded = {}
    for img, record in zip(soup.find_all('img'), plan['images']):
        path = record['path']
        if path not in uploaded: uploaded[path] = upload(Path(path))['url']
        img['src'] = uploaded[path]
    cover_result = upload(Path(cover), cover=True)
    return {'title':plan['title'],'author':author,'digest':digest,'content':str(soup),'thumb_media_id':cover_result['media_id']}

class Client:
    def __init__(self, token): self.token = token
    @staticmethod
    def decode(response):
        response.raise_for_status()
        response.encoding = "utf-8"
        data = response.json()
        if not isinstance(data, dict): raise ValueError('微信返回了非对象响应')
        if data.get('errcode', 0):
            code = data['errcode']
            hint = {40164:'检查调用出口 IP 白名单',48001:'账号没有此接口权限',40001:'检查凭据',42001:'令牌已过期',45009:'接口额度不足'}.get(code, '检查接口参数与权限')
            raise ValueError(f'微信接口错误 {code}：{hint}')
        return data
    def call(self, endpoint, payload):
        try:
            body = {'data': json.dumps(payload, ensure_ascii=False).encode('utf-8'), 'headers': {'Content-Type': 'application/json; charset=utf-8'}} if endpoint in ('cgi-bin/draft/add', 'cgi-bin/draft/update') else {'json': payload}
            return self.decode(requests.post(API+endpoint, params={'access_token':self.token}, timeout=45, **body))
        except requests.RequestException:
            raise ValueError('网络或 HTTP 错误；写入结果可能不确定，请先检查草稿箱，不要直接重试') from None
    def upload(self, path, cover=False):
        data, mime, filename = image_bytes(path)
        endpoint = 'cgi-bin/material/add_material' if cover else 'cgi-bin/media/uploadimg'
        params = {'access_token':self.token}
        if cover: params['type'] = 'image'
        try:
            result = self.decode(requests.post(API+endpoint, params=params, files={'media':(filename,data,mime)}, timeout=60))
        except requests.RequestException:
            raise ValueError('图片上传网络错误，停止执行') from None
        key = 'media_id' if cover else 'url'
        if not result.get(key): raise ValueError('图片上传响应缺少 '+key)
        return result
    @classmethod
    def from_env(cls):
        token = os.environ.get('WECHAT_ACCESS_TOKEN')
        if token: return cls(token)
        appid, secret = os.environ.get('WECHAT_APP_ID'), os.environ.get('WECHAT_APP_SECRET')
        if appid or secret:
            if not appid or not secret: raise ValueError('环境变量中的 AppID 和 AppSecret 必须成对设置')
        else:
            from config_ui import load_config
            saved = load_config()
            appid, secret = saved.get('app_id'), saved.get('app_secret')
        if not appid or not secret: raise ValueError('请打开本机配置页面填写 AppID 和 AppSecret')
        return cls.from_credentials(appid, secret)
    @classmethod
    def from_credentials(cls, appid, secret):
        try:
            result = cls.decode(requests.post(API+'cgi-bin/stable_token', json={'grant_type':'client_credential','appid':appid,'secret':secret,'force_refresh':False}, timeout=30))
        except requests.RequestException:
            raise ValueError('获取令牌失败，请检查网络及白名单') from None
        if not result.get('access_token'): raise ValueError('令牌响应缺少 access_token')
        return cls(result['access_token'])

def date_windows(begin, end, days=7):
    start, stop = date.fromisoformat(begin), date.fromisoformat(end)
    if start > stop or days < 1: raise ValueError('日期范围无效')
    result = []
    while start <= stop:
        last = min(stop, start + timedelta(days=days-1))
        result.append((start.isoformat(),last.isoformat())); start = last + timedelta(days=1)
    return result

def analyze_rows(rows):
    totals = {}
    for field in COUNT_FIELDS:
        values = [r[field] for r in rows if r.get(field) not in (None, '')]
        if values:
            try: totals[field] = sum(int(str(v).replace(',','')) for v in values)
            except ValueError: raise ValueError('指标必须为整数：'+field) from None
    return {'rows':len(rows),'totals':totals,'records':rows,'notes':['仅对次数求和；人数 UV 不跨日期或文章相加去重。','合计仅适用于无重叠的增量数据；累计快照不能直接求和。','缺失指标表示不可用，不代表 0；仅代表接口或导入文件覆盖的范围。']}

def analyze_csv(path):
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        rows = [{ALIASES.get(k,k):v for k,v in row.items()} for row in csv.DictReader(stream)]
    return analyze_rows(rows)

def save_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.write-',dir=path.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as f:
            json.dump(value,f,ensure_ascii=False,indent=2)
            f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('prepare','save'):
        p = sub.add_parser(name); p.add_argument('file',type=Path); p.add_argument('--title',required=True); p.add_argument('--out',type=Path,required=True)
        if name == 'save':
            p.add_argument('--cover',type=Path,required=True); p.add_argument('--author',default=''); p.add_argument('--digest',default=''); p.add_argument('--media-id'); p.add_argument('--index',type=int,default=0)
    p = sub.add_parser('list'); p.add_argument('--offset',type=int,default=0); p.add_argument('--count',type=int,default=20); p.add_argument('--out',type=Path,required=True)
    p = sub.add_parser('get'); p.add_argument('media_id'); p.add_argument('--out',type=Path,required=True)
    p = sub.add_parser('analytics'); p.add_argument('--begin',required=True); p.add_argument('--end',required=True); p.add_argument('--out',type=Path,required=True)
    p = sub.add_parser('analyze-csv'); p.add_argument('file',type=Path); p.add_argument('--out',type=Path,required=True)
    a = parser.parse_args()
    if a.command in ('prepare','save'):
        plan = prepare(a.file,a.title)
        if a.command == 'prepare':
            a.out.mkdir(parents=True, exist_ok=True)
            save_json(a.out/'audit.json',plan)
            (a.out/'preview.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><main style="max-width:640px;margin:auto;padding:20px">'+plan['html']+'</main>',encoding='utf-8')
            print(json.dumps({'preview':str(a.out/'preview.html'),'errors':plan['errors'],'warnings':plan['warnings']},ensure_ascii=False)); return 1 if plan['errors'] else 0
        if plan['errors']: raise ValueError('预检失败：'+'; '.join(plan['errors']))
        image_bytes(a.cover)
        if a.index < 0: raise ValueError('index 必须非负')
        if len(a.author) > 8 or len(a.digest) > 120: raise ValueError('作者最多 8 字，摘要最多 120 字')
        client = Client.from_env()
        if a.media_id:
            existing = client.call('cgi-bin/draft/get',{'media_id':a.media_id})
            items = existing.get('news_item',[])
            if a.index >= len(items): raise ValueError('草稿文章 index 不存在')
            save_json(a.out.with_suffix('.backup.json'), existing)
        article = build_article(plan,a.cover,client.upload,a.author,a.digest)
        if a.media_id:
            merged = {k:v for k,v in items[a.index].items() if k in ('content_source_url','need_open_comment','only_fans_can_comment')}
            merged.update(article)
            result = client.call('cgi-bin/draft/update',{'media_id':a.media_id,'index':a.index,'articles':merged})
            result['media_id'] = a.media_id
        else: result = client.call('cgi-bin/draft/add',{'articles':[article]})
        # Persist receipt before read-back: a verification error must not cause duplicate creation.
        save_json(a.out, {'result':result,'verification':'pending'})
        if not result.get('media_id'): raise ValueError('写入响应缺少 media_id，请人工检查草稿箱')
        verified = client.call('cgi-bin/draft/get',{'media_id':result['media_id']})
        save_json(a.out, {'result':result,'draft':verified,'verification':'read-back returned'})
    elif a.command == 'analyze-csv': save_json(a.out, analyze_csv(a.file))
    elif a.command == 'analytics':
        windows = date_windows(a.begin,a.end,days=1)
        if date.fromisoformat(a.end) >= date.today(): raise ValueError('数据查询结束日期需早于今天')
        client = Client.from_env(); rows=[]; completed=[]
        for begin,end in windows:
            result = client.call('datacube/getarticlesummary',{'begin_date':begin,'end_date':end})
            if not isinstance(result.get('list'),list): raise ValueError('数据响应缺少 list')
            rows.extend(result['list']); completed.append(begin)
            report = analyze_rows(rows); report.update(source='getarticlesummary',completed_dates=completed,requested_begin=a.begin,requested_end=a.end,complete=end == a.end)
            save_json(a.out,report)
    else:
        client = Client.from_env()
        if a.command == 'get': result = client.call('cgi-bin/draft/get',{'media_id':a.media_id})
        else:
            if not 1 <= a.count <= 20 or a.offset < 0: raise ValueError('count 范围为 1–20，offset 非负')
            result = client.call('cgi-bin/draft/batchget',{'offset':a.offset,'count':a.count,'no_content':0})
        save_json(a.out,result)
    print(json.dumps({'saved':str(a.out)},ensure_ascii=False))
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, OSError) as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False),file=sys.stderr); sys.exit(1)
