import sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import mcp_server as server

class WorkbenchTransportTests(unittest.TestCase):
 def test_config_status_never_returns_secret(self):
  with patch.object(server,'load_config',return_value={'app_id':'test','app_secret':'never-return-me'}):
   self.assertEqual(server.content_workbench_local('/api/config',{}),{'app_id':'test','has_secret':True})
   with self.assertRaises(ValueError):server.content_workbench_local('/api/config',{'app_secret':'new'})
 def test_external_actions_cannot_use_local_bridge(self):
  with patch.object(server,'route') as route:
   for path in ['/api/pending/sync','/api/channels/prepare','/api/channels/login','/api/draft/save','/api/arbitrary']:
    with self.assertRaises(ValueError):server.content_workbench_local(path,{})
   route.assert_not_called()
 def test_external_bridge_is_bounded(self):
  with patch.object(server,'route',return_value={'ok':True}) as route:
   self.assertEqual(server.content_workbench_external('/api/pending/sync',{'expected_revision':'v1'}),{'ok':True})
   route.assert_called_once_with('content_workbench_external','/api/pending/sync',{'expected_revision':'v1'})
   with self.assertRaises(ValueError):server.content_workbench_external('/api/publish',{})
 def test_local_edits_keep_revision(self):
  with patch.object(server,'route',return_value={'revision':'v2'}) as route:
   server.content_workbench_local('/api/channels/save',{'expected_revision':'v1'})
   route.assert_called_once_with('content_workbench_local','/api/channels/save',{'expected_revision':'v1'})

class AppMetadataTests(unittest.IsolatedAsyncioTestCase):
 async def test_widget_tools_are_accessible_to_compatibility_bridge(self):
  tools={t.name:t for t in await server.mcp.list_tools()}
  for name in ['open_content_app','content_app_channel','content_workbench_local','content_workbench_external']:
   self.assertTrue(tools[name].meta.get('openai/widgetAccessible'),name)
 async def test_resource_declares_fullscreen_on_read(self):
  contents=await server.mcp.read_resource(server.APP_URI)
  self.assertEqual(list(contents)[0].meta['ui']['availableDisplayModes'],['fullscreen','inline'])
