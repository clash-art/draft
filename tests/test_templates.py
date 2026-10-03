import sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from bs4 import BeautifulSoup
from templates import render,BUILTINS,save_template,list_templates
from palette import validate_palette,contrast
from workspace import Workspace
class TemplateTests(unittest.TestCase):
 def test_references_preserve_text_urls_images(self):
  body='<p>正文</p><img src="images/test.png"/><h3>参考资料</h3><p>〔1〕来源<br/><a href="https://example.org/a/long/path">https://example.org/a/long/path</a></p>'
  before=BeautifulSoup(body,'html.parser');after=BeautifulSoup(render(body,BUILTINS[0]),'html.parser')
  self.assertEqual(before.get_text(),after.get_text())
  self.assertEqual(after.a['href'],before.a['href']);self.assertEqual(after.img['src'],before.img['src'])
  self.assertIn('font-size:13px',after.find_all('p')[-1]['style'])
  self.assertIn('word-break:break-all',after.a.span['style'])
 def test_custom_template_does_not_overwrite_builtin(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);saved=save_template(root,dict(BUILTINS[0],name='Custom'))
   self.assertNotEqual(saved['id'],'graphite');self.assertEqual(len(list_templates(root)),len(BUILTINS)+1)
   save_template(root,dict(saved,name='Renamed'));self.assertEqual(len(list_templates(root)),len(BUILTINS)+1)
 def test_preview_does_not_change_article_apply_requires_revision(self):
  with tempfile.TemporaryDirectory() as tmp:
   w=Workspace(Path(tmp),lambda:None)
   e=w.dispatch('/api/editor/save',{'title':'Test','body':'正文\n\n### 参考文献\n\n[1] https://example.org'})
   preview=w.dispatch('/api/templates/preview',{'current':True,'template':BUILTINS[0]})
   self.assertEqual(w.dispatch('/api/editor/load',{})['revision'],e['revision'])
   args={'current':True,'id':e['id'],'template':BUILTINS[0],'expected_revision':'stale'}
   with self.assertRaises(ValueError):w.dispatch('/api/templates/apply',args)
   result=w.dispatch('/api/templates/apply',dict(args,expected_revision=preview['revision']))
   self.assertEqual(result['revision'],e['revision']);self.assertEqual(result['body'],e['body'])
   edition=w.dispatch('/api/channels/get',{'id':e['id'],'channel':'wechat'})
   self.assertIsNotNone(edition['revision'])
   self.assertIn('font-size:13px',w.dispatch('/api/channels/preview',{'id':e['id'],'channel':'wechat'})['html'])
 def test_delete_only_custom_template(self):
  with tempfile.TemporaryDirectory() as tmp:
   w=Workspace(Path(tmp),lambda:None)
   with self.assertRaises(ValueError):w.dispatch('/api/templates/delete',{'id':'graphite'})
   t=w.dispatch('/api/templates/save',{'template':BUILTINS[0]})
   w.dispatch('/api/templates/delete',{'id':t['id']})
   self.assertEqual(len(w.dispatch('/api/templates/list',{})['items']),len(BUILTINS))
   self.assertTrue((Path(tmp)/'templates'/(t['id']+'.archived')).exists())

 def test_all_layouts_preserve_content_when_reapplied(self):
  body='<p>导语</p><h2>章节</h2><figure><img src="images/test.png"/><figcaption>图片说明</figcaption></figure><pre><code>x = 1</code></pre><table><tr><th>字段</th></tr><tr><td>值</td></tr></table><h3>参考资料</h3><p>〔1〕来源 https://example.org/a</p>'
  expected=BeautifulSoup(body,'html.parser').get_text()
  for t in BUILTINS:
   with self.subTest(template=t['id']):
    result=BeautifulSoup(render(render(body,t),t),'html.parser')
    self.assertEqual(result.get_text(),expected)
    self.assertEqual(result.img['src'],'images/test.png')
    self.assertIn('font-size:12px',result.figcaption['style'])
    self.assertIn('table-layout:fixed',result.table['style'])
 def test_bundled_sample_contains_images_and_captions(self):
  with tempfile.TemporaryDirectory() as tmp:
   w=Workspace(Path(tmp),lambda:None)
   result=w.dispatch('/api/templates/preview',{'current':False,'template':BUILTINS[-1]})
   soup=BeautifulSoup(result['html'],'html.parser')
   self.assertEqual(len(soup.find_all('img')),2)
   self.assertEqual(len(soup.find_all('figcaption')),2)
   self.assertTrue(all(i['src'].startswith('data:image/svg+xml;base64,') for i in soup.find_all('img')))
 def test_layouts_are_distinct_and_palette_overrides_colours(self):
  body='01\n\n### 章节\n\n导语 **重点** 与 `code`。\n\n![图](images/a.png)\n\n图\n\n> 引用\n\n### 参考资料\n\n〔1〕来源  \nhttps://example.org/a'
  outputs={t['id']:render(body,t) for t in BUILTINS}
  self.assertEqual(len(set(outputs.values())),len(BUILTINS))
  self.assertGreaterEqual(len(BUILTINS),8)
  brand={'primary':'#4a6d47','paper':'#fdfefb','ink':'#2a332a'}
  for t in BUILTINS:
   with self.subTest(template=t['id']):
    html=render(body,t,brand);soup=BeautifulSoup(html,'html.parser')
    self.assertIn('#4a6d47',html);self.assertNotIn(t['accent'],html.replace('#4a6d47',''))
    self.assertEqual(soup.get_text(),BeautifulSoup(render(html,BUILTINS[0]),'html.parser').get_text())
    self.assertEqual(soup.figure.figcaption.get_text(),'图')
    self.assertNotIn('<style',html);self.assertNotIn('class=',html)
 def test_palette_validation(self):
  self.assertEqual(validate_palette({'primary':'#2C1FEA','name':'Braintrust'}),{'primary':'#2c1fea','name':'Braintrust'})
  self.assertIsNone(validate_palette(None))
  self.assertGreater(contrast('#000000','#ffffff'),20)
  for bad in ({'primary':'#12345'},{'ink':'#f0f0f0','paper':'#ffffff'},{'on_primary':'#ffffff','primary':'#ffd100'},{'background':'#ffffff'},{'name':'only'}):
   with self.assertRaises(ValueError):validate_palette(bad)
