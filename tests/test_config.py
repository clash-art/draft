import json, os, sys, tempfile, threading, unittest
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import requests
import wechat
import config_ui

class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=Path(self.tmp.name)/'private'/'credentials.json'
    def tearDown(self): self.tmp.cleanup()
    def test_store_masks_secret_and_preserves_on_empty(self):
        config_ui.save_config(self.path, 'wx1234567890abcdef', 'a'*32)
        self.assertEqual(self.path.stat().st_mode & 0o777,0o600)
        config_ui.save_config(self.path,'wx1234567890abcdef','')
        self.assertEqual(config_ui.load_config(self.path)['app_secret'],'a'*32)
        with self.assertRaises(ValueError): config_ui.save_config(self.path,'wx0000000000000000','')
    def test_saved_pair_used_without_env_and_no_mixed_credentials(self):
        config_ui.save_config(self.path,'wx1234567890abcdef','a'*32)
        response=Mock();response.json.return_value={'access_token':'ok'}
        with patch.dict(os.environ,{'WECHAT_CONFIG_PATH':str(self.path)},clear=True), patch('wechat.requests.post',return_value=response) as post:
            self.assertEqual(wechat.Client.from_env().token,'ok')
            self.assertEqual(post.call_args.kwargs['json']['appid'],'wx1234567890abcdef')
            os.environ['WECHAT_APP_ID']='wx0000000000000000'
            with self.assertRaises(ValueError): wechat.Client.from_env()
    def test_http_requires_token_and_never_returns_secret(self):
        server=config_ui.make_server(self.path,0)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        try:
            self.assertEqual(requests.get(base+'/api/config').status_code,403)
            self.assertEqual(requests.get(base+'/?stage=draft').status_code,200)
            self.assertEqual(requests.get(base+'/api/config?stage=draft').status_code,403)
            headers={'X-Config-Token':server.token,'Origin':base}
            result=requests.post(base+'/api/config',headers=headers,json={'app_id':'wx1234567890abcdef','app_secret':'a'*32})
            self.assertEqual(result.status_code,200)
            self.assertNotIn('a'*32,result.text)
            status=requests.get(base+'/api/config',headers=headers).json()
            self.assertTrue(status['has_secret'])
            self.assertNotIn('app_secret',status)
            self.assertEqual(requests.post(base+'/api/config',headers={**headers,'Origin':'https://evil.example'},json={}).status_code,403)
            self.assertEqual(requests.get(base+'/',headers={'Host':'evil.example'}).status_code,403)
        finally:
            server.shutdown();server.server_close();thread.join()

if __name__=='__main__': unittest.main()
