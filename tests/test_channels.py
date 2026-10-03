import unittest,tempfile,sys,json,base64,io
from pathlib import Path
from unittest.mock import patch,Mock
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from workspace import Workspace
from templates import BUILTINS
from wechat import save_json
class ChannelsTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.w=Workspace(self.tmp.name,lambda:None)
  self.e=self.w.dispatch('/api/editor/save',{'title':'源内容','body':'## 章节\n原文'})
 def call(self,name,**data):return self.w.dispatch('/api/channels/'+name,{'id':self.e['id'],'channel':'xiaohongshu',**data})
 def save(self,channel='xiaohongshu',**changes):
  old=self.call('get',channel=channel)
  return self.call('save',**{**old,'source_revision':self.e['revision'],'expected_revision':old['revision'],**changes})
 def test_longform_template_catalog_isolated_and_snapshot_survives_delete(self):
  listing=self.call('templates/list',format='longform')
  self.assertEqual(listing['format'],'longform')
  self.assertEqual(len(listing['items']),7)
  self.assertEqual(self.call('get')['template']['id'],'lieflat-editorial')
  template=self.call('templates/save',format='longform',template={**listing['items'][0],'name':'我的长文'})
  self.assertNotIn(template['id'],[t['id'] for t in self.call('templates/list')['items']])
  saved=self.save(template=template)
  self.call('templates/delete',format='longform',id=template['id'])
  self.assertNotIn(template['id'],[t['id'] for t in self.call('templates/list',format='longform')['items']])
  self.assertEqual(self.call('get')['template'],saved['template'])
  self.assertEqual(self.call('get')['body'],self.e['body'])

 def test_independent_revisions_and_source(self):
  x=self.save(title='笔记',body='短正文')
  w=self.save(channel='wechat',title='微信文章',body='长正文')
  self.assertEqual(self.call('get')['title'],'笔记')
  self.assertEqual(self.call('get',channel='wechat')['title'],'微信文章')
  self.assertNotEqual(x['revision'],w['revision'])
  self.assertEqual(self.w.dispatch('/api/editor/load',{})['title'],'源内容')
  with self.assertRaises(ValueError):self.call('save',title='过期',expected_revision=None,source_revision=self.e['revision'])
 def test_stale_source_and_invalid_images(self):
  with self.assertRaises(ValueError):self.call('save',source_revision='stale')
  with self.assertRaises(ValueError):self.save(images=['../../credentials.json'])
  with self.assertRaises(ValueError):self.call('get',channel='other')
 def test_fill_order_receipt_no_publish(self):
  stream=io.BytesIO();Image.new('RGB',(20,20),'red').save(stream,format='PNG')
  refs=[self.w.upload({'data':base64.b64encode(stream.getvalue()).decode()})['ref'] for _ in range(2)]
  e=self.save(format='cards',template={'id':'xhs-guide'},title='测试笔记',body='正文',images=refs[::-1])
  connector=Mock();connector.call.return_value={'status':'filled'}
  with patch('xiaohongshu.connect',return_value=connector):
   result=self.call('prepare',expected_revision=e['revision'])
   self.assertIsNone(result['publication']);self.assertEqual(result['delivery']['status'],'filled')
   args=connector.call.call_args
   self.assertEqual(args.args,('prepare',));self.assertNotIn('auto_publish',args.kwargs)
   self.assertEqual(args.kwargs['images'],[str(self.w.image_path(r)) for r in refs[::-1]])
   with self.assertRaises(ValueError):self.call('prepare',expected_revision=e['revision'])
   self.assertEqual(connector.call.call_count,1)
 def test_prepare_failure_stays_uncertain_and_requires_reset(self):
  e=self.save(title='测试',body='文',images=[])
  with self.assertRaises(ValueError):self.call('prepare',expected_revision=e['revision'])
  with self.assertRaises(ValueError):self.call('published',expected_revision=e['revision'],url='https://www.xiaohongshu.com/')
 def test_wechat_sync_uses_edition_and_revision(self):
  edition=self.save(channel='wechat',title='渠道标题',body='## 渠道正文')
  remote={'title':'老稿','content':'old'}
  state={'media_id':'m','verified':True,'revision':self.e['revision'],'remote_hash':self.w.remote_hash(remote)}
  save_json(self.w.sync_path(self.e['id']),state)
  client=Mock();client.call.return_value={'news_item':[remote]};self.w.client_factory=lambda:client
  self.w.audit=Mock(return_value={'errors':[]});self.w.image_path=Mock(return_value=Path('/cover'))
  with patch('workspace.build_article',return_value={'title':'渠道标题','content':'formatted'}):
   result=self.w.dispatch('/api/pending/sync',{'id':self.e['id'],'expected_revision':self.e['revision'],'intent':'update'})
  self.assertEqual(result['channel_revision'],edition['revision'])
  used=self.w.audit.call_args.args[0];self.assertEqual(used['title'],'渠道标题');self.assertIn('渠道正文',used['body'])
  self.assertIn('style=',used['body'])
  self.assertEqual(self.w.dispatch('/api/editor/load',{})['body'],self.e['body'])
 def test_agent_context_and_template_brief(self):
  self.e=self.w.dispatch('/api/editor/save',{'expected_revision':self.e['revision'],'title':'原稿','body':'# Markdown\n\n事实与来源','agent_context':'面向开发者，不要编造数据'})
  edition=self.save(template=BUILTINS[1])
  brief=self.call('brief')
  self.assertEqual(brief['source']['agent_context'],'面向开发者，不要编造数据')
  self.assertEqual(brief['source']['markdown'],self.e['body'])
  self.assertEqual(brief['template']['id'],BUILTINS[1]['id'])
  self.assertEqual(brief['expected_revision'],edition['revision'])
  self.assertEqual(brief['source_revision'],self.e['revision'])
  self.assertNotIn('面向开发者',self.call('preview')['html'])
  saved=self.w.dispatch('/api/editor/save',{'expected_revision':self.e['revision'],'title':'原稿','body':'修改正文'})
  self.assertEqual(saved['agent_context'],'面向开发者，不要编造数据')
 def test_legacy_conversion_does_not_save(self):
  self.e=self.w.dispatch('/api/editor/save',{'title':'旧稿','body':'<h2>标题</h2><p>文字<strong>加粗</strong></p>'})
  result=self.w.dispatch('/api/editor/markdown',{'expected_revision':self.e['revision']})
  self.assertIn('## 标题',result['body']);self.assertIn('**加粗**',result['body'])
  self.assertEqual(self.w.dispatch('/api/editor/load',{})['body'],self.e['body'])
 def test_image_template_catalog_and_snapshot(self):
  original=self.w.dispatch('/api/channels/templates/list',{})['items'][0]
  custom=self.w.dispatch('/api/channels/templates/save',{'template':{**original,'name':'我的图片模板'}})
  self.assertNotEqual(custom['id'],original['id'])
  saved=self.save(format='cards',template={'id':custom['id']})
  self.assertEqual(saved['template']['name'],'我的图片模板')
  self.w.dispatch('/api/channels/templates/delete',{'id':custom['id']})
  self.assertEqual(self.save(template=saved['template'])['template']['name'],'我的图片模板')
 def test_cards_export_in_app_and_keep_source(self):
  stream=io.BytesIO();Image.new('RGB',(1080,1440),'red').save(stream,format='PNG')
  ref=self.w.upload({'data':base64.b64encode(stream.getvalue()).decode()})['ref']
  pages=[{'title':'封面','text':'短文','image_ref':ref}]
  saved=self.save(cards=pages,template={'id':'xhs-guide'})
  self.assertEqual(saved['images'],[]);self.assertTrue(saved['render_pending'])
  exported=self.save(images=[ref],rendered_for_revision=saved['revision'])
  self.assertFalse(exported['render_pending']);self.assertEqual(exported['images'],[ref])
  with self.assertRaises(ValueError):self.save(images=[ref],rendered_for_revision=saved['revision'])
  updated=self.save(cards=[{**pages[0],'text':'新的内容'}])
  self.assertEqual(updated['images'],[]);self.assertTrue(updated['render_pending'])
  self.assertEqual(self.w.dispatch('/api/editor/load',{})['body'],self.e['body'])
  with self.assertRaises(ValueError):self.save(cards=[{'title':'标题','text':'a'*241}])
  with self.assertRaises(ValueError):self.save(cards=[{'title':'标题','image_ref':'../../private'}])
 def test_new_xhs_preserves_full_article(self):
  edition=self.call('get')
  self.assertEqual(edition['body'],self.e['body']);self.assertEqual(edition['title'],self.e['title'])
  self.assertEqual(edition['format'],'longform')
  self.assertIn('不删减',self.call('brief')['instructions'])
  saved=self.save(template=BUILTINS[1])
  self.assertEqual(saved['body'],self.e['body'])
  self.assertIn('原文',self.call('preview')['html'])
  with patch('xiaohongshu.connect') as connector:
   with self.assertRaisesRegex(ValueError,'长文'):self.call('prepare',expected_revision=saved['revision'])
   connector.assert_not_called()

 def test_longform_export_is_separate_and_invalidated(self):
  saved=self.save()
  stream=io.BytesIO();Image.new('RGB',(1080,1440),'white').save(stream,format='PNG')
  ref=self.w.upload({'data':base64.b64encode(stream.getvalue()).decode()})['ref']
  result=self.save(page_images=[ref],page_count=1,rendered_for_revision=saved['revision'])
  self.assertEqual(result['body'],self.e['body'])
  self.assertEqual(result['images'],[])
  self.assertEqual(result['page_images'],[ref])
  changed=self.save(template=BUILTINS[1])
  self.assertEqual(changed['page_images'],[])
  with self.assertRaises(ValueError):self.save(page_images=[ref],page_count=1,rendered_for_revision=result['revision'])
