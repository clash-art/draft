import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import requests
from wechat import Client
class EncodingTest(unittest.TestCase):
 def test_wechat_json_uses_utf8_despite_http_default(self):
  r=requests.Response();r.status_code=200;r._content='{"title":"中文标题"}'.encode('utf-8');r.encoding='ISO-8859-1'
  self.assertEqual(Client.decode(r)['title'],'中文标题')
 def test_draft_write_sends_real_utf8_characters(self):
  from unittest.mock import patch,Mock
  response=Mock();response.json.return_value={'errcode':0}
  with patch('wechat.requests.post',return_value=response) as post:
   Client('token').call('cgi-bin/draft/update',{'articles':{'title':'中文标题'}})
   kwargs=post.call_args.kwargs
   self.assertIn('中文标题'.encode(),kwargs.get('data',b''))
