import sys,unittest,tempfile
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from workspace import Workspace
class BridgeTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.ws=Workspace(Path(self.temp.name),Mock())
 def tearDown(self):self.temp.cleanup()
 def test_editor_shared_state_and_review_round_trip(self):
  draft={'title':'文章','body':'原文','author':'作者','digest':'摘要','cover':'','assets':[]}
  saved=self.ws.dispatch('/api/editor/save',draft)
  loaded=self.ws.dispatch('/api/editor/load',{})
  self.assertEqual(loaded['body'],'原文');self.assertTrue(saved['revision'])
  self.ws.dispatch('/api/review/publish',{'revision':saved['revision'],'summary':'正文清晰','findings':[{'severity':'suggestion','location':'开头','message':'补充背景'}]})
  report=self.ws.dispatch('/api/review/latest',{})
  self.assertEqual(report['summary'],'正文清晰');self.assertFalse(report['stale'])
  self.ws.dispatch('/api/editor/save',{**draft,'body':'修改后的原文'})
  self.assertTrue(self.ws.dispatch('/api/review/latest',{})['stale'])
 def test_editor_optimistic_concurrency(self):
  first=self.ws.dispatch('/api/editor/save',{'title':'文章','body':'一'})
  self.ws.dispatch('/api/editor/save',{'title':'文章','body':'二','expected_revision':first['revision']})
  with self.assertRaises(ValueError):self.ws.dispatch('/api/editor/save',{'title':'文章','body':'三','expected_revision':first['revision']})
 def test_review_requires_matching_article_revision(self):
  self.ws.dispatch('/api/editor/save',{'title':'文章','body':'内容'})
  with self.assertRaises(ValueError):self.ws.dispatch('/api/review/publish',{'revision':'wrong','summary':'错误文章','findings':[]})
 def test_pending_multiple_articles_and_comments(self):
  first=self.ws.dispatch('/api/editor/save',{'title':'第一篇','body':'原文'})
  comment=self.ws.dispatch('/api/comments/add',{'id':first['id'],'revision':first['revision'],'quote':'原文','text':'补充例子'})
  second=self.ws.dispatch('/api/pending/new',{'expected_revision':first['revision']})
  self.assertNotEqual(first['id'],second['id'])
  self.assertEqual(len(self.ws.dispatch('/api/pending/list',{})['items']),2)
  self.ws.dispatch('/api/pending/open',{'id':first['id'],'expected_revision':second['revision']})
  self.assertEqual(self.ws.dispatch('/api/editor/load',{})['body'],'原文')
  self.ws.dispatch('/api/comments/resolve',{'id':first['id'],'comment_id':comment['id']})
  self.assertTrue(self.ws.dispatch('/api/comments/list',{'id':first['id']})['items'][0]['resolved'])
 def test_sync_creates_then_updates_same_draft_and_detects_remote_changes(self):
  from unittest.mock import patch
  client=Mock();self.ws.client_factory=lambda:client
  remote={'title':'测试','content':'<p>正文</p>','thumb_media_id':'cover'}
  client.call.side_effect=lambda route,data: {'media_id':'remote-one'} if route.endswith('/add') else {'news_item':[dict(remote)]} if route.endswith('/get') else {'errcode':0}
  first=self.ws.dispatch('/api/editor/save',{'title':'测试','body':'正文'})
  with patch.object(self.ws,'audit',return_value={'errors':[]}),patch.object(self.ws,'image_path',return_value=Path('/mock.png')),patch('workspace.image_bytes',return_value=(b'x','image/png','x')),patch('workspace.build_article',return_value=remote):
   args={'id':first['id'],'expected_revision':first['revision']}
   receipt=self.ws.dispatch('/api/pending/sync',args)
   self.assertTrue(receipt['verified']);self.ws.dispatch('/api/pending/sync',args)
   self.assertEqual(sum(c.args[0].endswith('/add') for c in client.call.call_args_list),1)
   second=self.ws.dispatch('/api/editor/save',{'title':'第二版','body':'正文二','expected_revision':first['revision']})
   self.ws.dispatch('/api/pending/sync',{'id':second['id'],'expected_revision':second['revision']})
   updates=[c for c in client.call.call_args_list if c.args[0].endswith('/update')]
   self.assertEqual(len(updates),1);self.assertEqual(updates[0].args[1]['media_id'],'remote-one')
   third=self.ws.dispatch('/api/editor/save',{'title':'第三版','body':'正文三','expected_revision':second['revision']})
   remote['title']='微信端修改'
   with self.assertRaisesRegex(ValueError,'微信端草稿已修改'):self.ws.dispatch('/api/pending/sync',{'id':third['id'],'expected_revision':third['revision']})
 def test_publication_requires_confirmation_and_freezes_draft_sync(self):
  client=Mock();client.call.return_value={'news_item':[{'title':'发布文章','content':'正文'}]};self.ws.client_factory=lambda:client
  e=self.ws.dispatch('/api/editor/save',{'title':'发布文章','body':'正文'})
  self.ws.dispatch('/api/pending/link',{'id':e['id'],'expected_revision':e['revision'],'media_id':'existing'})
  with self.assertRaises(ValueError):self.ws.dispatch('/api/publication/manual',{'id':e['id'],'url':'https://mp.weixin.qq.com/s/test'})
  with self.assertRaises(ValueError):self.ws.dispatch('/api/publication/manual',{'id':e['id'],'url':'https://evil.example/s/test','confirmed':True})
  state=self.ws.dispatch('/api/publication/manual',{'id':e['id'],'url':'https://mp.weixin.qq.com/s/test','confirmed':True})
  self.assertEqual(state['publication']['source'],'user_confirmed')
  with self.assertRaisesRegex(ValueError,'已关联发布'):self.ws.dispatch('/api/pending/sync',{'id':e['id'],'expected_revision':e['revision']})
  self.ws.dispatch('/api/publication/metric',{'id':e['id'],'msgid':'123_1'})
  self.assertEqual(self.ws.dispatch('/api/editor/load',{})['sync']['publication']['msgid'],'123_1')
 def test_reviews_are_article_specific(self):
  first=self.ws.dispatch('/api/editor/save',{'title':'一','body':'一'})
  self.ws.dispatch('/api/review/publish',{'revision':first['revision'],'summary':'第一篇建议','findings':[]})
  second=self.ws.dispatch('/api/pending/new',{'expected_revision':first['revision']})
  self.assertFalse(self.ws.dispatch('/api/review/latest',{})['available'])
  self.ws.dispatch('/api/pending/open',{'id':first['id'],'expected_revision':second['revision']})
  self.assertEqual(self.ws.dispatch('/api/review/latest',{})['summary'],'第一篇建议')
