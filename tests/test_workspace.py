import base64,io,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from PIL import Image
import workspace

class WorkspaceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.client=Mock();self.ws=workspace.Workspace(Path(self.tmp.name),lambda:self.client)
  stream=io.BytesIO();Image.new('RGB',(640,320),'green').save(stream,'PNG');self.image=base64.b64encode(stream.getvalue()).decode()
 def tearDown(self):self.tmp.cleanup()
 def test_upload_and_preview_audit(self):
  image=self.ws.dispatch('/api/upload',{'data':self.image,'name':'../pic.png'})
  report=self.ws.dispatch('/api/audit',{'title':'标题','body':'正文\n\n![说明]('+image['ref']+')'})
  self.assertEqual(report['errors'],[]);self.assertEqual(len(report['images']),1)
  self.assertIn('data:image/png;base64,',report['preview_html'])
  self.assertTrue(Path(report['review_file']).exists())
 def test_bundled_fonts_are_open_licensed_and_served_only_from_manifest(self):
  root=Path(workspace.__file__).resolve().parents[1]/'assets/fonts'
  manifest=json.loads((root/'manifest.json').read_text())
  self.assertEqual({f['family'] for f in manifest['faces']},{'Draft Sans SC','Draft Serif SC','Draft Rounded SC','Draft Inter','Draft Mono','Draft Smiley'})
  for face in manifest['faces']:
   self.assertTrue(face['files'] and all((root/f).is_file() and (root/f).read_bytes()[:4]==b'wOF2' for f,_ in face['files']),face['id'])
   self.assertIn('SIL Open Font License',(root/'licenses'/f"{face['source']}.txt").read_text())
   self.assertIn(face['name'],(root/'LICENSES.md').read_text())
  first=next(f for face in manifest['faces'] for f,_ in face['files'])
  served=self.ws.dispatch('/api/font',{'files':[first]})['fonts'][first]
  self.assertEqual(base64.b64decode(served.split(',',1)[1]),(root/first).read_bytes())
  for bad in (['../manifest.json'],['sans-sc-400/missing.woff2'],[],'sans-sc-400/sc000.woff2',[first]*49):
   with self.assertRaises(ValueError):self.ws.dispatch('/api/font',{'files':bad})
 def test_arbitrary_local_file_blocked(self):
  with self.assertRaises(ValueError):self.ws.dispatch('/api/audit',{'title':'标题','body':'![图](../../private.png)'})
 def test_save_reuses_receipt_for_same_operation(self):
  image=self.ws.dispatch('/api/upload',{'data':self.image,'name':'pic.png'})
  self.client.upload.side_effect=lambda path,cover=False: {'media_id':'cover'} if cover else {'url':'https://mmbiz.qpic.cn/a'}
  self.client.call.side_effect=lambda endpoint,payload: {'media_id':'draft'} if endpoint.endswith('/add') else {'news_item':[{'title':'标题'}]}
  payload={'title':'标题','body':'![图]('+image['ref']+')','cover':image['ref'],'operation_id':'test-op'}
  first=self.ws.dispatch('/api/draft/save',payload);second=self.ws.dispatch('/api/draft/save',payload)
  self.assertEqual(first['media_id'],'draft');self.assertEqual(second['media_id'],'draft')
  self.assertEqual(sum(c.args[0].endswith('/add') for c in self.client.call.call_args_list),1)
 def test_csv_counts_and_no_fake_uv(self):
  report=self.ws.dispatch('/api/csv',{'text':'日期,阅读次数,阅读人数\n2026-01-01,20,10\n2026-01-02,30,10','mode':'incremental'})
  self.assertEqual(report['totals']['int_page_read_count'],50)
  self.assertNotIn('int_page_read_user',report['totals'])
 def test_cumulative_csv_is_not_summed(self):
  report=self.ws.dispatch('/api/csv',{'text':'日期,阅读次数\n2026-01-01,20\n2026-01-02,30','mode':'snapshot'})
  self.assertEqual(report['totals'],{})
 def test_draft_list_page(self):
  self.client.call.return_value={'total_count':3,'item':[]}
  report=self.ws.dispatch('/api/drafts/list',{'offset':20})
  self.assertEqual(report['total_count'],3)
  self.assertEqual(self.client.call.call_args.args[1]['offset'],20)

 def test_receipts_do_not_cross_accounts(self):
  self.ws.account_identity=lambda:'account-a'
  image=self.ws.dispatch('/api/upload',{'data':self.image,'name':'pic.png'})
  self.client.upload.side_effect=lambda path,cover=False: {'media_id':'cover'} if cover else {'url':'https://mmbiz.qpic.cn/a'}
  self.client.call.side_effect=lambda endpoint,payload: {'media_id':'draft'} if endpoint.endswith('/add') else {'news_item':[{'title':'标题'}]}
  payload={'title':'标题','body':'![图]('+image['ref']+')','cover':image['ref'],'operation_id':'same-op'}
  self.ws.dispatch('/api/draft/save',payload)
  self.ws.account_identity=lambda:'account-b'
  with self.assertRaises(ValueError):self.ws.dispatch('/api/draft/save',payload)

 def test_native_snapshot_is_private_read_only_and_versioned(self):
  img=self.ws.dispatch('/api/upload',{'data':self.image,'name':'pic.png'})
  article=self.ws.dispatch('/api/editor/save',{'title':'Native test','body':'正文 ![示意]('+img['ref']+')','assets':[{'ref':img['ref'],'name':'pic.png'}]})
  before=(self.ws.root/'editor.json').read_bytes()
  result=self.ws.dispatch('/api/app/snapshot',{})
  self.assertEqual(result['article']['revision'],article['revision'])
  self.assertIn('data:image/png;base64,',result['preview_html'])
  self.assertNotIn('assets',result['article'])
  self.assertEqual(before,(self.ws.root/'editor.json').read_bytes())
  self.assertFalse((self.ws.root/'article.md').exists())
  self.client.assert_not_called()
 def test_content_filters_do_not_change_workspace(self):
  a=self.ws.dispatch('/api/editor/save',{'title':'Agent research','body':'Example'})
  self.assertEqual(len(self.ws.dispatch('/api/pending/list',{'q':'AGENT','stage':'pending'})['items']),1)
  self.assertEqual(self.ws.dispatch('/api/pending/list',{'stage':'draft'})['items'],[])
  self.assertEqual(self.ws.dispatch('/api/pending/list',{'q':'missing'})['items'],[])
  self.assertEqual(self.ws.dispatch('/api/editor/load',{})['revision'],a['revision'])
 def test_draft_relations_are_exact_and_detect_changes(self):
  from wechat import save_json
  a=self.ws.dispatch('/api/editor/save',{'title':'Local','body':'Example'})
  remote={'title':'Remote','content':'Example'}
  save_json(self.ws.sync_path(a['id']),{'media_id':'media','index':1,'verified':True,'revision':a['revision'],'remote_hash':self.ws.remote_hash(remote)})
  self.client.call.return_value={'news_item':[{'title':'Unrelated'},dict(remote)]}
  result=self.ws.dispatch('/api/drafts/list',{'media_id':'media'})
  rows=result['item'][0]['content']['news_item']
  self.assertIsNone(rows[0]['workspace_link'])
  self.assertEqual(rows[1]['workspace_link']['id'],a['id'])
  self.assertEqual(rows[1]['workspace_link']['state'],'synced')
  self.client.call.return_value={'news_item':[{},dict(remote,title='Changed')]}
  result=self.ws.dispatch('/api/drafts/list',{'media_id':'media'})
  self.assertEqual(result['item'][0]['content']['news_item'][1]['workspace_link']['state'],'remote_changed')
  b=self.ws.dispatch('/api/pending/new',{})
  with self.assertRaisesRegex(ValueError,'已关联内容'):
   self.ws.dispatch('/api/pending/link',{'id':b['id'],'expected_revision':b['revision'],'media_id':'media','index':1})
 def test_editor_links_are_validated_and_account_scoped(self):
  self.client.call.return_value={'news_item':[{'title':'Article'}]}
  url='https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&appmsgid=123&token=test'
  self.ws.dispatch('/api/drafts/editor-link',{'media_id':'m','index':0,'url':url})
  self.assertEqual(self.ws.dispatch('/api/drafts/list',{'media_id':'m'})['item'][0]['content']['news_item'][0]['editor_url'],url)
  self.assertEqual(self.ws.editor_links_path().stat().st_mode&0o777,0o600)
  with self.assertRaises(ValueError):self.ws.dispatch('/api/drafts/editor-link',{'media_id':'m','url':'https://mp.weixin.qq.com/s?tempkey=x'})
  self.ws.account_identity=lambda:'another'
  self.assertEqual(self.ws.editor_links(),{})
 def test_published_backend_url_validates_identity(self):
  from wechat import save_json
  a=self.ws.dispatch('/api/editor/save',{'title':'Article','body':'Body'})
  save_json(self.ws.sync_path(a['id']),{'media_id':'m','publication':{'msgid':'123_1'}})
  url='https://mp.weixin.qq.com/misc/appmsganalysis?action=detailpage&msgid=123_1&publish_date=2026-08-24&token=test'
  result=self.ws.dispatch('/api/publication/analytics-link',{'id':a['id'],'url':url})
  self.assertEqual(result['publication']['analytics_url'],url)
  with self.assertRaisesRegex(ValueError,'不一致'):self.ws.dispatch('/api/publication/analytics-link',{'id':a['id'],'url':url.replace('123_1','456_1')})
 def test_data_link_can_link_publication_in_one_step(self):
  from wechat import save_json
  a=self.ws.dispatch('/api/editor/save',{'title':'Article','body':'Body'})
  save_json(self.ws.sync_path(a['id']),{'media_id':'m'})
  url='https://mp.weixin.qq.com/misc/appmsganalysis?action=detailpage&msgid=123_1&publish_date=2026-08-24&token=test'
  state=self.ws.dispatch('/api/publication/manual',{'id':a['id'],'url':url,'confirmed':True})
  self.assertEqual(state['publication']['msgid'],'123_1')
  self.assertEqual(state['publication']['analytics_url'],url)
  self.assertNotIn('url',state['publication'])
 def test_analytics_attaches_only_matching_article_and_restores(self):
  from wechat import save_json
  a=self.ws.dispatch('/api/editor/save',{'title':'Published','body':'Body'})
  save_json(self.ws.sync_path(a['id']),{'media_id':'m','publication':{'msgid':'123_1'}})
  report=self.ws.dispatch('/api/csv',{'text':'图文消息ID,阅读次数\n123_1,12\n456_1,99','mode':'incremental'})
  saved=self.ws.dispatch('/api/analytics/attach',{'id':a['id'],'report_id':report['report_id']})
  self.assertEqual(saved['totals']['int_page_read_count'],12)
  self.assertEqual(len(saved['records']),1)
  listed=self.ws.dispatch('/api/analytics/articles',{})['items']
  self.assertEqual(listed[0]['analytics_report']['totals']['int_page_read_count'],12)
  with self.assertRaisesRegex(ValueError,'不一致'):
   self.ws.dispatch('/api/analytics/attach',{'id':a['id'],'report_id':report['report_id'],'confirmed':True})
  with self.assertRaisesRegex(ValueError,'已变化'):
   self.ws.dispatch('/api/analytics/attach',{'id':a['id'],'report_id':'stale'})
  self.ws.account_identity=lambda:'another'
  self.assertEqual(self.ws.dispatch('/api/analytics/articles',{})['items'],[])
 def test_single_article_snapshot_needs_confirmation_and_never_sums(self):
  from wechat import save_json
  a=self.ws.dispatch('/api/editor/save',{'title':'Published','body':'Body'})
  save_json(self.ws.sync_path(a['id']),{'media_id':'m','publication':{'url':'https://mp.weixin.qq.com/s/example'}})
  report=self.ws.dispatch('/api/csv',{'text':'日期,阅读次数\n2026-09-01,20\n2026-09-02,30'})
  with self.assertRaises(ValueError):self.ws.dispatch('/api/analytics/attach',{'id':a['id'],'report_id':report['report_id']})
  saved=self.ws.dispatch('/api/analytics/attach',{'id':a['id'],'report_id':report['report_id'],'confirmed':True})
  self.assertEqual(saved['totals'],{})
  self.assertEqual(len(saved['records']),2)
