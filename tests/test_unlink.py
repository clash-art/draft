import unittest,tempfile,sys,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from workspace import Workspace
from wechat import save_json
class UnlinkTests(unittest.TestCase):
 def test_unlink_keeps_article_archives_report_and_checks_stale_state(self):
  for published in (False,True):
   with self.subTest(published=published),tempfile.TemporaryDirectory() as d:
    def forbidden():raise AssertionError('No WeChat request allowed')
    w=Workspace(Path(d),forbidden)
    e=w.dispatch('/api/editor/save',{'title':'保留我','body':'正文'})
    state={'media_id':'remote','index':0}
    if published:state['publication']={'msgid':'123_1'}
    save_json(w.sync_path(e['id']),state)
    save_json(w.article_analysis_path(e['id']),{'records':[{'value':2}]})
    receipt=w.root/('receipt-pending-'+hashlib.sha256((e['id']+'default').encode()).hexdigest()+'.json')
    save_json(receipt,{'media_id':'old-draft'})
    args={'id':e['id'],'expected_revision':e['revision'],'expected_sync':state}
    with self.assertRaises(ValueError):w.dispatch('/api/pending/unlink',dict(args,expected_sync={}))
    self.assertTrue(w.sync_path(e['id']).exists())
    result=w.dispatch('/api/pending/unlink',args)
    self.assertIsNone(result['sync'])
    self.assertFalse(receipt.exists())
    self.assertEqual(len(list((Path(d)/'unlinked').glob('*/creation-receipt.json'))),1)
    self.assertEqual(w.dispatch('/api/editor/load',{})['body'],'正文')
    self.assertEqual(len(w.dispatch('/api/pending/list',{'stage':'pending'})['items']),1)
    self.assertFalse(w.article_analysis_path(e['id']).exists())
    self.assertEqual(len(list((Path(d)/'unlinked').glob('*/analytics.json'))),1)
