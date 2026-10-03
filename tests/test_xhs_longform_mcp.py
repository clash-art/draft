"""Xiaohongshu longform through the MCP tools, using the bundled example article end to end."""
import base64,io,json,re,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import mcp_server as server
from load_example import load
from workspace import Workspace
from wechat import save_json

EXAMPLE=ROOT/'examples/xhs-longform-agent-self-evolution'
ARTICLE=(EXAMPLE/'article.md').read_text(encoding='utf-8')
EDITOR=json.loads((EXAMPLE/'editor.json').read_text(encoding='utf-8'))
CONDENSED=(EXAMPLE/'xiaohongshu-condensed.md').read_text(encoding='utf-8')

def png(size=(1080,1440)):
 buffer=io.BytesIO();Image.new('RGB',size,'white').save(buffer,'PNG');return base64.b64encode(buffer.getvalue()).decode()

class LongformMcpTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name)/'workspace'
  self.loaded=load(EXAMPLE,self.root)
  self.ws=Workspace(self.root,lambda:None)
  for name,value in (('ws',self.ws),('root',self.root)):
   p=patch.object(server,name,value);p.start();self.addCleanup(p.stop)
  self.id=self.loaded['id']
 def brief(self):return server.get_channel_brief(self.id,'xiaohongshu')
 def save(self,**changes):
  b=self.brief();e=b['current_edition']
  args=dict(content_id=self.id,channel='xiaohongshu',title=e['title'],body=e['body'],images=e['images'],source_revision=b['source_revision'],expected_revision=b['expected_revision'],template=e['template'])
  return server.save_channel_edition(**{**args,**changes})

 def test_example_keeps_full_source_and_ships_condensed_edition(self):
  self.assertEqual(EDITOR['body'],ARTICLE)
  self.assertEqual(len(re.findall(r'^!\[',ARTICLE,re.M)),10)
  self.assertEqual(len(re.findall(r'^〔\d+〕',ARTICLE,re.M)),21)
  self.assertIn(EDITOR['cover'],[a['ref'] for a in EDITOR['assets']])
  edition=json.loads((EXAMPLE/'channels/xiaohongshu.json').read_text(encoding='utf-8'))
  self.assertEqual((edition['format'],edition['template']['id'],edition['body'],edition['condensed']),('longform','xhs-blueprint',CONDENSED,True))
  self.assertIsNone(edition['palette'])
  figures=re.findall(r'^!\[[^\]]*\]\(([^)\s]+)',CONDENSED,re.M)
  self.assertEqual(edition['images'],figures)
  self.assertEqual(len(figures),7)
  self.assertTrue(all((EXAMPLE/ref).is_file() for ref in figures))
  self.assertGreaterEqual(len(set(figures)&{a['ref'] for a in EDITOR['assets']}),5)
  self.assertEqual(len(re.findall(r'^〔\d+〕',CONDENSED,re.M)),21)
  self.assertEqual((edition['cover_page']['title'],edition['cover_page']['subtitle']),('工业界如何做 Agent 自进化','从真实反馈到持续改进'))
  for path in sorted((EXAMPLE/'layouts').glob('*.json')):
   layout=json.loads(path.read_text(encoding='utf-8'))
   pages=layout['pages']
   self.assertEqual(layout['page_count'],len(pages),path.name)
   self.assertLessEqual(layout['page_count'],10,path.name)
   self.assertEqual(sum(len(p.get('figures',[])) for p in pages),6,path.name)
   self.assertEqual(sum(p.get('references',0) for p in pages),21,path.name)
   self.assertEqual(pages[0].get('figures',[]),[],path.name)
   self.assertNotIn('cover_image',layout,path.name)

 def test_brief_is_longform_v1_and_never_truncated(self):
  b=self.brief()
  self.assertEqual((b['layout_protocol'],b['format'],b['channel']),('longform-v1','longform','xiaohongshu'))
  self.assertEqual(b['source']['markdown'],ARTICLE)
  self.assertEqual(b['source']['cover'],EDITOR['cover'])
  self.assertEqual([t['id'] for t in b['templates']],['xhs-folio','xhs-blueprint','xhs-tweet','xhs-brief','xhs-press','xhs-marker','xhs-note'])
  self.assertEqual(b['template']['id'],'xhs-blueprint')
  self.assertIn('palette',b['instructions'])
  self.assertIsNone(b['palette'])
  self.assertEqual(b['current_edition']['body'],CONDENSED)
  self.assertTrue(b['completeness']['condensed'])
  self.assertFalse(b['completeness']['body_matches_source'])
  self.assertEqual(b['completeness']['body_images_not_listed'],[])
  self.assertIn('condensed',b['instructions'])
  self.assertNotIn('卡片',b['instructions'].replace('不生成摘要卡片','').replace('不按卡片截断',''))

 def test_legacy_cards_edition_is_saved_as_longform_with_longform_template(self):
  save_json(self.root/'channels'/self.id/'xiaohongshu.json',{'channel':'xiaohongshu','format':'cards','title':'旧卡片','body':'摘要','images':[],'template':{'id':'xhs-guide'},'cards':[{'title':'1','body':'x'}],'revision':'old','source_revision':EDITOR['revision'],'publication':None})
  b=self.brief()
  self.assertEqual((b['format'],b['template']['id']),('longform','xhs-folio'))
  saved=server.save_channel_edition(self.id,'xiaohongshu',EDITOR['title'],ARTICLE,[a['ref'] for a in EDITOR['assets']],b['source_revision'],'old')
  self.assertEqual((saved['format'],saved['template']['id'],saved['cards'],saved['condensed']),('longform','xhs-folio',[],False))
  self.assertEqual(saved['body'],ARTICLE)
  self.assertTrue(saved['render_pending'])
  self.assertTrue(saved['completeness']['body_matches_source'])
  self.assertEqual(server.get_channel_edition(self.id,'xiaohongshu')['layout_protocol'],'longform-v1')

 def test_template_save_via_mcp_keeps_snapshot_and_full_body(self):
  listing=server.list_channel_templates()
  self.assertEqual(listing['layout_protocol'],'longform-v1')
  custom=server.save_channel_template({**next(t for t in listing['items'] if t['id']=='xhs-brief'),'name':'我的研报','font_size':16})
  self.assertRegex(custom['id'],r'^[a-f0-9]{32}$')
  self.assertIn(custom['id'],[t['id'] for t in server.list_channel_templates()['items']])
  saved=self.save(template=custom)
  self.assertEqual((saved['template']['layout'],saved['template']['font_size']),('brief',16))
  self.assertEqual((saved['body'],saved['condensed']),(CONDENSED,True))
  with self.assertRaises(ValueError):server.list_channel_templates('wechat')
  with self.assertRaises(ValueError):self.save(format='summary')

 def test_page_export_saved_through_mcp(self):
  edition=self.save(template=next(t for t in server.list_channel_templates()['items'] if t['id']=='xhs-note'))
  pages=[self.ws.dispatch('/api/upload',{'name':f'page-{i}.png','data':png()})['ref'] for i in range(10)]
  b=self.brief()
  with self.assertRaises(ValueError):self.save(page_images=pages+pages[:1],page_count=11,rendered_for_revision=edition['revision'])
  exported=self.save(page_images=pages,page_count=10,rendered_for_revision=edition['revision'])
  self.assertEqual((exported['page_images'],exported['render_pending']),(pages,False))
  self.assertEqual(exported['body'],CONDENSED)
  wrong=self.ws.dispatch('/api/upload',{'name':'wrong.png','data':png((1080,1080))})['ref']
  with self.assertRaises(ValueError):self.save(page_images=pages[:-1]+[wrong],page_count=10,rendered_for_revision=exported['revision'])
  with self.assertRaises(ValueError):self.save(page_images=pages,page_count=9,rendered_for_revision=exported['revision'])
  changed=self.save(body=CONDENSED+'\n补充')
  self.assertEqual((changed['page_images'],changed['render_pending']),([],True))
  self.assertTrue(changed['completeness']['condensed'])
  self.assertEqual(b['layout_protocol'],'longform-v1')

 def test_full_edition_round_trip(self):
  saved=self.save(body=ARTICLE,images=[a['ref'] for a in EDITOR['assets']],condensed=False,cover_page={})
  self.assertEqual((saved['body'],saved['condensed'],saved['cover_page']),(ARTICLE,False,None))
  self.assertTrue(saved['completeness']['body_matches_source'])
  self.assertFalse(saved['completeness']['condensed'])
  self.assertEqual(saved['completeness']['missing_images'],[])

 def test_cover_page_is_edition_content(self):
  plan={'title':'自进化','subtitle':'从反馈到改进','points':['验证','上线','改权重']}
  saved=self.save(cover_page=plan)
  self.assertEqual(saved['cover_page'],plan)
  self.assertTrue(saved['condensed'])
  self.assertEqual(self.brief()['current_edition']['cover_page'],plan)
  pages=[self.ws.dispatch('/api/upload',{'name':f'p{i}.png','data':png()})['ref'] for i in range(10)]
  exported=self.save(page_images=pages,page_count=10,rendered_for_revision=saved['revision'])
  self.assertFalse(exported['render_pending'])
  again=self.save(cover_page={**plan,'subtitle':'换个副标题'})
  self.assertEqual((again['page_images'],again['render_pending']),([],True))
  for bad in ({'points':['x']*6},{'points':['长'*31]},{'title':'长'*41},'封面'):
   with self.assertRaises(ValueError):self.save(cover_page=bad)

 def test_palette_is_edition_data_for_both_channels(self):
  brand={'name':'Example','primary':'#7c8b78','paper':'#f3efe9','ink':'#24201c','text':'#2e2924'}
  saved=self.save(palette=brand)
  self.assertEqual(saved['palette']['primary'],'#7c8b78')
  self.assertEqual(saved['template']['id'],'xhs-blueprint')
  pages=[self.ws.dispatch('/api/upload',{'name':f'q{i}.png','data':png()})['ref'] for i in range(10)]
  exported=self.save(page_images=pages,page_count=10,rendered_for_revision=saved['revision'])
  changed=self.save(palette={**brand,'primary':'#4a6d47'})
  self.assertEqual((changed['page_images'],changed['render_pending']),([],True))
  for bad in ({'primary':'blue'},{'text':'#eeeeee','paper':'#ffffff'},{'logo':'#000000'},{'primary':'#2c1fea'},{'paper':'#ffe066'}):
   with self.assertRaises(ValueError):self.save(palette=bad)
  wechat=server.get_channel_brief(self.id,'wechat')
  self.assertEqual((wechat['template']['id'],wechat['palette']),('blueprint',None))
  self.assertIn('palette',wechat['instructions'])
  html=server.save_channel_edition(self.id,'wechat',wechat['current_edition']['title'],wechat['current_edition']['body'],wechat['current_edition']['images'],wechat['source_revision'],wechat['expected_revision'],wechat['template'],palette={'primary':'#4a6d47'})
  self.assertEqual(html['palette'],{'primary':'#4a6d47'})
  preview=self.ws.dispatch('/api/channels/preview',{'id':self.id,'channel':'wechat'})['html']
  self.assertIn('#4a6d47',preview);self.assertNotIn('#2c1fea',preview)

 def test_longform_prepare_is_refused(self):
  edition=self.save()
  with self.assertRaises(ValueError):self.ws.dispatch('/api/channels/prepare',{'id':self.id,'channel':'xiaohongshu','expected_revision':edition['revision']})

 def test_loader_refuses_overwrite_and_never_touches_credentials(self):
  with self.assertRaises(ValueError):load(EXAMPLE,self.root)
  load(EXAMPLE,self.root,force=True)
  self.assertFalse(any(p.name.startswith('credentials') for p in self.root.parent.rglob('*')))

if __name__=='__main__':unittest.main()
