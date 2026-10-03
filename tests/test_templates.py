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
 def test_spark_sets_numeral_and_title_on_one_line_with_accent_emphasis(self):
  spark=next(t for t in BUILTINS if t['id']=='spark')
  body='导语\n\n01\n\n### 建一座城\n\n正文 **金句** 与 *Golconda*。\n\n![画](images/a.png)\n\n画'
  for accent in ('#e9682e','#3d6b8f'):
   with self.subTest(accent=accent):
    html=render(body,dict(spark,accent=accent));soup=BeautifulSoup(html,'html.parser')
    row=soup.find('section',attrs={'data-template-wrap':True})
    number,heading=[n for n in row.children if getattr(n,'name',None)]
    self.assertEqual((number.name,number.get_text(),heading.name,heading.get_text()),('p','01','h3','建一座城'))
    self.assertIn('display:inline',number['style']);self.assertIn('display:inline',heading['style'])
    self.assertIn(f'color:{accent}',number['style']);self.assertIn(f'color:{accent}',soup.strong['style'])
    self.assertIn('font-weight:400',heading['style']);self.assertIn('font-style:italic',soup.em['style'])
    self.assertIn('font-size:12px',soup.figcaption['style']);self.assertIn('text-align:center',soup.figcaption['style'])
    for banned in ('<style','class=','display:flex','position:','float:','@font-face'):self.assertNotIn(banned,html)
    again=BeautifulSoup(render(html,BUILTINS[0]),'html.parser')
    self.assertIsNone(again.find(attrs={'data-template-wrap':True}))
    self.assertEqual(again.get_text(),soup.get_text())
 def test_builtin_palettes_are_valid(self):
  from article_styles import PALETTES
  import json
  from palette import saturation
  for name,colors in PALETTES.items():
   with self.subTest(layout=name):self.assertEqual(validate_palette(colors),colors)
  presets=json.loads((Path(__file__).resolve().parents[1]/'assets/xhs-longform-presets.json').read_text())
  bases=[t for t in presets if not t.get('cover_layout')];self.assertEqual(len({t['accent'] for t in bases}),len(bases))
  for t in presets+BUILTINS:
   with self.subTest(template=t['id']):self.assertLessEqual(saturation(t['accent']),0.85)
 def test_figures_are_toned_to_layout_without_touching_originals(self):
  from PIL import Image
  with tempfile.TemporaryDirectory() as tmp:
   ws=Workspace(Path(tmp),lambda:None);(Path(tmp)/'images').mkdir(exist_ok=True)
   ref='images/'+'a'*32+'.png';Image.new('RGB',(40,20),'#e60023').save(Path(tmp)/ref)
   body=f'<p>正文</p><p><img src="{ref}" alt="图"/></p>'
   first=BeautifulSoup(render(body,BUILTINS[0],ws=ws),'html.parser').img
   self.assertNotEqual(first['src'],ref);self.assertEqual(first['data-template-src'],ref)
   r,g,b=Image.open(Path(tmp)/first['src']).convert('RGB').getpixel((5,5))
   self.assertLess(max(r,g,b)-min(r,g,b),90)
   self.assertEqual(Image.open(Path(tmp)/ref).convert('RGB').getpixel((5,5)),(230,0,35))
   again=BeautifulSoup(render(str(BeautifulSoup(render(body,BUILTINS[0],ws=ws),'html.parser')),BUILTINS[0],ws=ws),'html.parser').img
   self.assertEqual((again['src'],again['data-template-src']),(first['src'],ref))
   plain=BeautifulSoup(render(body,dict(BUILTINS[0],figure_tone='original'),ws=ws),'html.parser').img
   self.assertEqual(plain['src'],ref)
 def test_template_parts_are_composable(self):
  from templates import validate
  t=validate({'name':'x','layout':'devlog','cover_layout':'photo','palette_from':'wireframe','figure_tone':'duotone'})
  self.assertEqual((t['layout'],t['cover_layout'],t['palette_from'],t['figure_tone']),('devlog','photo','wireframe','duotone'))
  t=validate({'name':'x','layout':'press','cover_layout':'folio','palette_from':'graphite'})
  self.assertEqual(t['layout'],'press');self.assertNotIn('cover_layout',t);self.assertNotIn('palette_from',t)
 def test_palette_validation(self):
  self.assertEqual(validate_palette({'primary':'#7C8B78','name':'sage'}),{'primary':'#7c8b78','name':'sage'})
  self.assertEqual(validate_palette({'paper':'#f3efe9'}),{'paper':'#f3efe9'})
  self.assertIsNone(validate_palette(None))
  self.assertGreater(contrast('#000000','#ffffff'),20)
  for bad in ({'primary':'#12345'},{'ink':'#f0f0f0','paper':'#ffffff'},{'on_primary':'#ffffff','primary':'#ffd100'},{'primary':'#ff00ff'},{'accent':'#e60023'},{'paper':'#ffe066'},{'background':'#ffffff'},{'name':'only'}):
   with self.assertRaises(ValueError):validate_palette(bad)
