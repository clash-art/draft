"""Loopback-only credential settings; no secret is returned to the browser."""
import argparse
import mimetypes
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import webbrowser
from urllib.parse import urlsplit


def config_path():
    return Path(os.environ.get('WECHAT_CONFIG_PATH', str(Path.home()/'.config/wechat-drafts/credentials.json'))).expanduser()


def load_config(path=None):
    path = Path(path) if path is not None else config_path()
    if not path.exists(): return {}
    try:
        value=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(value,dict): raise ValueError()
        return value
    except (ValueError,OSError): raise ValueError('无法读取本地公众号配置，请重新配置') from None


def save_config(path, app_id, app_secret):
    if not isinstance(app_id,str) or not isinstance(app_secret,str): raise ValueError('请输入有效的 AppID 和 AppSecret')
    app_id,app_secret=app_id.strip(),app_secret.strip()
    if not re.fullmatch(r'wx[0-9a-fA-F]{16}',app_id): raise ValueError('AppID 应为 wx 开头的 18 位标识')
    old=load_config(path)
    if not app_secret:
        if app_id != old.get('app_id'): raise ValueError('更换 AppID 时请同时填写对应 AppSecret')
        app_secret=old.get('app_secret','')
    if not re.fullmatch(r'[0-9a-zA-Z]{32}',app_secret): raise ValueError('AppSecret 应为 32 位字母或数字')
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    fd,tmp=tempfile.mkstemp(prefix='.credentials-',dir=path.parent)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as f:
            json.dump({'app_id':app_id,'app_secret':app_secret},f)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)


def make_server(path=None, port=0):
    destination=Path(path) if path is not None else config_path()
    from workspace import Workspace
    def saved_client():
        from wechat import Client
        c=load_config(destination)
        if not c.get('app_id') or not c.get('app_secret'): raise ValueError('请先到账号设置填写 AppID 和 AppSecret')
        return Client.from_credentials(c['app_id'],c['app_secret'])
    workspace=Workspace(destination.parent/'workspace',saved_client,lambda:load_config(destination).get('app_id',''))
    routes={'/api/channels/templates/list','/api/channels/templates/save','/api/channels/templates/delete','/api/editor/markdown','/api/channels/brief','/api/channels/get','/api/channels/save','/api/channels/preview','/api/channels/login','/api/channels/status','/api/channels/prepare','/api/channels/reset-delivery','/api/channels/published','/api/pending/unlink','/api/templates/delete','/api/templates/list','/api/templates/save','/api/templates/preview','/api/templates/apply','/api/analytics/articles','/api/analytics/attach','/api/publication/analytics-link','/api/drafts/editor-link','/api/analytics/import','/api/publication/manual','/api/pending/import','/api/pending/link','/api/publications/list','/api/publication/link','/api/publication/metric','/api/pending/list','/api/pending/new','/api/pending/open','/api/pending/sync','/api/comments/list','/api/comments/add','/api/comments/resolve','/api/editor/load','/api/editor/save','/api/review/publish','/api/review/latest','/api/image/preview','/api/font','/api/bridge/status','/api/upload','/api/audit','/api/draft/save','/api/drafts/list','/api/drafts/get','/api/analytics','/api/csv'}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def send(self,status,value,html=False,content_type=None):
            data=value if isinstance(value,bytes) else value.encode('utf-8') if html else json.dumps(value,ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type',content_type or ('text/html; charset=utf-8' if html else 'application/json; charset=utf-8'))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: https://mmbiz.qpic.cn https://mmbiz.qlogo.cn; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def allowed(self,auth=True):
            host=f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != host: return False
            origin=self.headers.get('Origin')
            if origin and origin != 'http://'+host: return False
            return not auth or secrets.compare_digest(self.headers.get('X-Config-Token',''),self.server.token)
        def status(self):
            c=load_config(destination)
            return {'app_id':c.get('app_id',''),'has_secret':bool(c.get('app_secret'))}
        def do_GET(self):
            path=urlsplit(self.path).path
            if not self.allowed(auth=not(path=='/' or path.startswith('/ui/'))): return self.send(403,{'error':'请从本机配置入口打开页面'})
            if path=='/':
                page=(Path(__file__).resolve().parents[1]/'assets/ui/index.html').read_text(encoding='utf-8')
                return self.send(200,page,html=True)
            if path.startswith('/ui/'):
                root=(Path(__file__).resolve().parents[1]/'assets/ui').resolve()
                target=(root/path[4:].split('?')[0]).resolve()
                if not target.is_relative_to(root) or not target.is_file(): return self.send(404,{'error':'资源不存在'})
                return self.send(200,target.read_bytes(),content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
            if path=='/api/config':
                try: return self.send(200,self.status())
                except ValueError as e: return self.send(400,{'error':str(e)})
            self.send(404,{'error':'不存在的页面'})
        def do_POST(self):
            if not self.allowed(): return self.send(403,{'error':'页面已失效，请重新打开配置入口'})
            if self.path not in routes | {'/api/config','/api/test','/api/network/diagnose'}: return self.send(404,{'error':'不存在的接口'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0 < length <= (12*1024*1024 if self.path in routes else 4096): raise ValueError('请求长度无效')
                if self.headers.get('Content-Type','').split(';')[0]!='application/json': raise ValueError('请求格式无效')
                data=json.loads(self.rfile.read(length))
                if not isinstance(data,dict): raise ValueError('请求格式无效')
                if self.path in routes: return self.send(200,workspace.dispatch(self.path,data))
                if self.path=='/api/config':
                    save_config(destination,data.get('app_id',''),data.get('app_secret',''))
                    return self.send(200,{**self.status(),'message':'已保存，插件下次调用会自动读取。'})
                # Test saved credentials explicitly, independent of shell overrides.
                from wechat import Client
                c=load_config(destination)
                if not c.get('app_id') or not c.get('app_secret'): raise ValueError('请先保存 AppID 和 AppSecret')
                if self.path=='/api/network/diagnose':
                    from diagnose import diagnose_credentials
                    return self.send(200,diagnose_credentials(c['app_id'],c['app_secret']))
                Client.from_credentials(c['app_id'],c['app_secret'])
                return self.send(200,{'message':'连接成功，已取得调用令牌。具体草稿、素材和数据权限需在使用时验证。'})
            except ValueError as e:
                if self.path in routes: return self.send(400,{'error':str(e)[:500]})
                return self.send(400,{'error':'操作未完成：请检查 AppID、AppSecret、IP 白名单和网络；更换 AppID 时须填写对应密钥。'})
            except OSError:
                # Never echo upstream exceptions containing credential-bearing requests.
                return self.send(400,{'error':'操作未完成：请检查 AppID、AppSecret、IP 白名单和网络；更换 AppID 时须填写对应密钥。'})
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    server.token=secrets.token_urlsafe(32)
    return server


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    server=make_server(port=args.port)
    url=f'http://127.0.0.1:{server.server_port}/#'+server.token
    print(url,flush=True)
    if not args.no_browser: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=='__main__': main()
