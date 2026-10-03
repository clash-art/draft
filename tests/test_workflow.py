import sys, unittest, tempfile, csv
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import wechat
from PIL import Image

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        Image.new('RGB', (20, 10), 'red').save(self.root / 'a.png')
    def tearDown(self): self.tmp.cleanup()
    def article(self, content):
        p = self.root / 'post.md'; p.write_text(content); return p
    def test_markdown_preview_resolves_images_and_audits(self):
        plan = wechat.prepare(self.article('# 标题\n\n![说明](a.png)\n\n![缺图](missing.png)'), '标题')
        self.assertEqual(len(plan['images']), 2)
        self.assertTrue(any('missing.png' in e for e in plan['errors']))
        self.assertIn('<h1', plan['html'])
    def test_refuses_unsafe_markup_and_data_image(self):
        p = wechat.prepare(self.article('<script>alert(1)</script><img src="data:image/png;base64,aaa">'), '标题')
        self.assertGreaterEqual(len(p['errors']), 2)
    def test_duplicate_image_upload_rewritten_once_and_cover_separate(self):
        plan = wechat.prepare(self.article('![一](a.png)\n\n![二](a.png)'), '标题')
        calls = []
        def upload(path, cover=False):
            calls.append(cover)
            return {'media_id':'cover-id'} if cover else {'url':'https://mmbiz.qpic.cn/body'}
        article = wechat.build_article(plan, self.root/'a.png', upload)
        self.assertEqual(calls, [False, True])
        self.assertEqual(article['content'].count('https://mmbiz.qpic.cn/body'), 2)
        self.assertEqual(article['thumb_media_id'], 'cover-id')
    def test_csv_does_not_sum_uv_across_days(self):
        p = self.root/'data.csv'
        p.write_text('ref_date,int_page_read_user,int_page_read_count,share_user,share_count\n2026-01-01,10,20,2,3\n2026-01-02,10,30,3,4\n')
        report = wechat.analyze_csv(p)
        self.assertEqual(report['totals']['int_page_read_count'], 50)
        self.assertNotIn('int_page_read_user', report['totals'])
        self.assertEqual(report['rows'], 2)
    def test_data_windows_reject_reverse_and_split_seven_days(self):
        self.assertEqual(wechat.date_windows('2026-01-01','2026-01-09'), [('2026-01-01','2026-01-07'),('2026-01-08','2026-01-09')])
        with self.assertRaises(ValueError): wechat.date_windows('2026-01-09','2026-01-01')
    def test_api_errors_redact_and_do_not_retry_mutation(self):
        response = unittest.mock.Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {'errcode':40001,'errmsg':'secret-token'}
        with patch('wechat.requests.post', return_value=response) as post:
            client = wechat.Client('secret-token')
            with self.assertRaisesRegex(ValueError, '40001') as e: client.call('cgi-bin/draft/add', {'articles':[]})
            self.assertNotIn('secret-token', str(e.exception))
            self.assertEqual(post.call_count, 1)


    def test_save_end_to_end_with_http_boundary(self):
        import os
        source = self.article('![图片](a.png)')
        out = self.root/'receipt.json'
        seen = []
        def post(url, **kwargs):
            endpoint = url.split('weixin.qq.com/')[1]
            seen.append((endpoint, kwargs))
            response = unittest.mock.Mock()
            response.raise_for_status.return_value = None
            responses = {'cgi-bin/media/uploadimg':{'url':'https://mmbiz.qpic.cn/example'}, 'cgi-bin/material/add_material':{'media_id':'cover'}, 'cgi-bin/draft/add':{'media_id':'draft'}, 'cgi-bin/draft/get':{'news_item':[{'title':'标题'}]}}
            response.json.return_value = responses[endpoint]
            return response
        with patch.dict(os.environ, {'WECHAT_ACCESS_TOKEN':'test-token'}), patch('wechat.requests.post', side_effect=post), patch.object(sys, 'argv', ['wechat','save',str(source),'--title','标题','--cover',str(self.root/'a.png'),'--out',str(out)]):
            self.assertEqual(wechat.main(), 0)
        import json
        self.assertEqual(json.loads(out.read_text())['result']['media_id'], 'draft')
        article = next(json.loads(kwargs['data'])['articles'][0] for endpoint,kwargs in seen if endpoint == 'cgi-bin/draft/add')
        self.assertIn('https://mmbiz.qpic.cn/example', article['content'])
        self.assertEqual(article['thumb_media_id'], 'cover')
        self.assertFalse(any('freepublish' in endpoint for endpoint,_ in seen))

    def test_invalid_local_image_prevents_network(self):
        import os
        source = self.article('![图片](absent.png)')
        with patch('wechat.requests.post') as post, patch.object(sys, 'argv', ['wechat','save',str(source),'--title','标题','--cover',str(self.root/'a.png'),'--out',str(self.root/'receipt.json')]):
            with self.assertRaises(ValueError): wechat.main()
            self.assertEqual(post.call_count, 0)

    def test_analytics_fetches_each_day_and_marks_complete(self):
        import os, json
        out = self.root/'stats.json'
        dates = []
        def post(url, **kwargs):
            dates.append(kwargs['json'])
            response = unittest.mock.Mock()
            response.raise_for_status.return_value = None
            response.json.return_value = {'list':[{'ref_date':kwargs['json']['begin_date'], 'int_page_read_count':8,'int_page_read_user':6}]}
            return response
        with patch.dict(os.environ, {'WECHAT_ACCESS_TOKEN':'test'}), patch('wechat.requests.post',side_effect=post), patch.object(sys,'argv',['wechat','analytics','--begin','2026-01-01','--end','2026-01-02','--out',str(out)]):
            wechat.main()
        result = json.loads(out.read_text())
        self.assertTrue(result['complete'])
        self.assertEqual(result['totals']['int_page_read_count'],16)
        self.assertEqual(dates,[{'begin_date':'2026-01-01','end_date':'2026-01-01'},{'begin_date':'2026-01-02','end_date':'2026-01-02'}])

if __name__ == '__main__': unittest.main()
