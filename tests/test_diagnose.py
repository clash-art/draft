import sys, unittest, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import diagnose

class DiagnoseTests(unittest.TestCase):
    def test_whitelist_extracts_ip_without_echoing_message(self):
        result=diagnose.summarize({'errcode':40164,'errmsg':'invalid ip 106.38.59.62 ipv6 ::ffff:106.38.59.62, secret-value rid:abc'})
        self.assertIn('106.38.59.62',result['wechat_seen_ips'])
        self.assertNotIn('secret-value',json.dumps(result))
    def test_success_does_not_leak_token_or_invent_ip(self):
        result=diagnose.summarize({'access_token':'secret-token','expires_in':7200})
        self.assertTrue(result['connected'])
        self.assertEqual(result['wechat_seen_ips'],[])
        self.assertNotIn('secret-token',json.dumps(result))
    def test_other_errors_do_not_claim_ip_evidence(self):
        result=diagnose.summarize({'errcode':40001,'errmsg':'bad credential 1.2.3.4'})
        self.assertEqual(result['errcode'],40001)
        self.assertEqual(result['wechat_seen_ips'],[])
    def test_diagnose_uses_saved_credentials_and_redacts_proxy(self):
        from unittest.mock import patch,Mock
        response=Mock();response.json.return_value={'access_token':'never-return-this'}
        with patch.object(diagnose.requests,'post',return_value=response) as post,patch.object(diagnose.requests.utils,'get_environ_proxies',return_value={'https':'http://user:password@proxy:8080'}):
            result=diagnose.diagnose_credentials('saved-app','saved-secret')
        self.assertEqual(post.call_args.kwargs['json']['appid'],'saved-app')
        self.assertTrue(result['proxy_detected'])
        self.assertIn('checked_at',result)
        for value in ['never-return-this','saved-secret','password','proxy:8080']:
            self.assertNotIn(value,json.dumps(result))
