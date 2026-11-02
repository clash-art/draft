import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from readback import compare_readback

class ReadbackTests(unittest.TestCase):
 def article(self,content):return {'title':'完整文章','content':content,'content_source_url':'https://github.com/openma-ai/OpenMatter'}
 def test_platform_markup_and_image_resize_are_equivalent(self):
  a=self.article('<p>正文 <strong>加粗</strong></p><img src="https://mmbiz.qpic.cn/a/0?wx_fmt=png">')
  b=self.article('<section><p>正文<strong>加粗</strong></p><img src="https://mmbiz.qpic.cn/a/640?wx_fmt=jpeg"></section>')
  self.assertTrue(compare_readback(a,b)['content_matches'])
 def test_missing_external_link_is_reported(self):
  a=self.article('<p><a href="https://github.com/openma-ai/OpenMatter">OpenMatter</a></p>')
  r=compare_readback(a,self.article('<p>OpenMatter</p>'))
  self.assertFalse(r['content_matches']);self.assertIn('OpenMatter',' '.join(r['issues']))
 def test_empty_bullets_lost_text_and_images_are_reported(self):
  a=self.article('<p>完整正文</p><ul><li>连续</li></ul><img src="https://mmbiz.qpic.cn/a/0">')
  b=self.article('<p>正文</p><ul><li></li><li>连续</li></ul>')
  issues=' '.join(compare_readback(a,b)['issues'])
  for word in ['正文','图片','列表']:self.assertIn(word,issues)
 def test_read_original_and_title_differences_are_reported(self):
  a=self.article('<p>正文</p>');b={**a,'title':'改了','content_source_url':''}
  issues=' '.join(compare_readback(a,b)['issues'])
  self.assertIn('标题',issues);self.assertIn('阅读原文',issues)
 def test_wechat_short_link_rewrite_keeps_link(self):
  a=self.article('<a href="https://mp.weixin.qq.com/s/short">原文</a>')
  b=self.article('<a href="https://mp.weixin.qq.com/s?mid=1&amp;idx=1">原文</a>')
  self.assertTrue(compare_readback(a,b)['content_matches'])
