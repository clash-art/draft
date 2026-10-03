"""Reusable article typography with lossless reference text and local persistence."""
import re, json, uuid, base64
from pathlib import Path
import markdown
from bs4 import BeautifulSoup
from wechat import save_json

from palette import validate_palette,resolve
from article_styles import PALETTES,spec

# WeChat article layouts plus the Xiaohongshu longform page themes.
ARTICLE_LAYOUTS=tuple(PALETTES)
XHS_THEMES=('folio','blueprint','tweet','brief','press','marker','note')
LAYOUTS=ARTICLE_LAYOUTS+('folio','brief','note','tweet','poster','swiss','press','marker')
BASE={'font_size':16,'line_height':1.85,'paragraph_gap':18,'reference_size':13,'reference_gap':8,'accent':'#333333'}
def builtin(id,name,description,**values):return dict(BASE,id=id,name=name,description=description,layout=id,accent=PALETTES[id]['primary'],**values)
BUILTINS=[
 builtin('graphite','石墨简报','细线分节 · 等宽编号 · 石板灰点缀',font_size=15.5,line_height=1.85,paragraph_gap=18),
 builtin('blueprint','蓝图','白底点阵感 · 宋体标题 · 虚线图框 · 雾霾蓝点缀',font_size=15.5,line_height=1.85,paragraph_gap=18),
 builtin('wechat','微信清读','清爽白底 · 等宽编号 · 灰绿点缀',font_size=16,line_height=1.85,paragraph_gap=18),
 builtin('column','专栏','淡玫瑰纸面 · 大号编号 · 灰粉点缀',font_size=16,line_height=1.85,paragraph_gap=20),
 builtin('journal','纸上专题','报刊式居中章节 · 双线引文 · 陶土红点缀',font_size=16,line_height=1.95,paragraph_gap=22),
 builtin('lab','研究手记','冷灰纸面 · 左标章节 · 灰青点缀',font_size=15.5,line_height=1.9,paragraph_gap=18),
 builtin('essay','人文札记','暖米色纸 · 宋体居中 · 暖灰褐点缀',font_size=16,line_height=2,paragraph_gap=22),
 builtin('letter','周末来信','淡卡其纸面 · 宋体章节 · 橄榄灰点缀',font_size=16.5,line_height=2,paragraph_gap=24),
]

def sample_image(name):
    raw=(Path(__file__).resolve().parents[1]/'assets/templates'/name).read_bytes()
    return 'data:image/svg+xml;base64,'+base64.b64encode(raw).decode('ascii')

SAMPLE=f'''<p>一篇好的文章，让文字讲清观点，让图片帮助理解。读者既能顺着正文读下去，也能在图里停留片刻。</p>
<figure><img src="{sample_image('reading-cover.svg')}" alt="纸页、图表与卡片组成的阅读插画"/><figcaption>图 1 · 在文字与图像之间，留一点呼吸的空间。</figcaption></figure>
<h2>先把问题说清楚</h2><p>开篇不急着堆满信息。先交代一个具体问题，再用<strong>一张有意义的配图</strong>帮助读者建立印象。图片不只是装饰，也应该承担叙事。</p>
<blockquote>文字负责解释，图片负责让关系变得可见。</blockquote>
<h2>让图片接住正文</h2><p>当段落开始讨论步骤、结构或相互关系时，用图解把它们展开。图前说明“为什么看”，图后补上“看到了什么”。</p>
<figure><img src="{sample_image('reading-flow.svg')}" alt="提出问题、图解关系、回到证据的三步阅读路径"/><figcaption>图 2 · 从问题到图解，再回到可查阅的证据。</figcaption></figure>
<p>图注使用更轻的颜色与更小的字号，与正文拉开层级。横图保持完整比例，长图自然向下延伸，不裁掉关键信息。</p>
<h2>把信息组织成可读的层次</h2><ul><li>用段落解释一个观点。</li><li>用列表给出并列的建议。</li><li>用表格比较真正需要比较的内容。</li></ul><table><thead><tr><th>内容</th><th>呈现方式</th></tr></thead><tbody><tr><td>流程与关系</td><td>配图与图注</td></tr><tr><td>方法与操作</td><td>步骤与代码</td></tr></tbody></table><pre><code>article.preview()
article.save_draft()</code></pre><h3>参考资料</h3><p>〔1〕排版示例 · 研究与方法<br/>https://example.org/research/a-long-reference-address-that-needs-to-wrap-on-a-mobile-screen</p><p>〔2〕排版示例 · 项目文档<br/><a href="https://example.org/docs">https://example.org/docs</a></p>'''

def validate(value):
    out={'id':str(value.get('id','')),'name':str(value.get('name','')).strip()[:40],'description':str(value.get('description','')).strip()[:120]}
    if not out['name']:raise ValueError('请填写模板名称')
    for key,low,high in [('font_size',12,20),('line_height',1.5,2.4),('paragraph_gap',4,32),('reference_size',8,15),('reference_gap',1,24)]:
        try:n=float(value.get(key,BASE[key]))
        except (ValueError,TypeError):raise ValueError('模板数值无效') from None
        if not low<=n<=high:raise ValueError('模板数值超出范围：'+key)
        out[key]=n
    accent=str(value.get('accent',BASE['accent']))
    if not re.fullmatch(r'#[0-9a-fA-F]{6}',accent):raise ValueError('主题色应为六位十六进制颜色')
    layout=value.get('layout',value.get('id','graphite'))
    out['layout']=layout if layout in LAYOUTS else 'graphite'
    out['accent']=accent
    if value.get('palette'):out['palette']=validate_palette(value['palette'])
    if value.get('cover_style') in ('editorial','geek-report','consulting-report','clean-review'):out['cover_style']=value['cover_style']
    if value.get('page_ratio') in ('3:4','3:5','1:1','9:16'):out['page_ratio']=value['page_ratio']
    if value.get('figure_tone') in ('muted','duotone','original'):out['figure_tone']=value['figure_tone']
    for key in ('cover_layout','palette_from'):
        if value.get(key) in XHS_THEMES:out[key]=value[key]
    return out

def list_templates(root):
    folder=root/'templates';folder.mkdir(exist_ok=True)
    return BUILTINS+[json.loads(p.read_text()) for p in sorted(folder.glob('*.json'))]

def save_template(root,value):
    t=validate(value);identifier=t['id']
    if not re.fullmatch(r'[a-f0-9]{32}',identifier):identifier=uuid.uuid4().hex
    t['id']=identifier;folder=root/'templates';folder.mkdir(exist_ok=True);save_json(folder/(identifier+'.json'),t);return t

REFERENCE_HEADING=re.compile(r'(参考资料|参考文献|参考链接|引用来源|References|Sources)[:：]?',re.I)
MARKERS=('data-template-root','data-template-wrap','data-template-frame','data-template-url','data-template-number')

def render(body,template,palette=None,ws=None):
    """Restyle an article with a layout. Text, links and images are kept exactly; earlier
    template markup is unwrapped first, so rendering again with another layout is lossless.
    With a workspace, local figures are swapped for copies toned to the layout palette; the
    original ref is kept in data-template-src so a later render starts from the original."""
    t=validate(template);layout=t['layout'] if t['layout'] in ARTICLE_LAYOUTS else 'graphite'
    c=resolve(PALETTES[layout],t,palette);css=spec(layout,c,t)
    soup=BeautifulSoup(body if re.match(r'\s*<',body) else markdown.markdown(body,extensions=['tables','fenced_code']),'html.parser')
    for marker in MARKERS:
        for node in soup.find_all(attrs={marker:True}):node.unwrap()
    for node in soup.find_all(True):node.attrs.pop('style',None)
    for img in soup.find_all('img',attrs={'data-template-src':True}):img['src']=img.attrs.pop('data-template-src')
    def style(node,key,extra=''):node['style']=css[key]+extra
    def text_of(node):return node.get_text(strip=True)
    def element_siblings(node):
        n=node.next_sibling
        while n is not None and not getattr(n,'name',None):n=n.next_sibling
        return n
    blocks=[n for n in soup.contents if getattr(n,'name',None)]
    refs_at=next((i for i,n in enumerate(blocks) if n.name in ('h1','h2','h3','h4','p') and REFERENCE_HEADING.fullmatch(text_of(n))),None)
    body_blocks=blocks if refs_at is None else blocks[:refs_at]
    lead_done=False
    for i,node in enumerate(body_blocks):
        name=node.name;nxt=body_blocks[i+1] if i+1<len(body_blocks) else None
        if name=='p':
            only_img=node.find('img') and not text_of(node) and all(getattr(k,'name',None) in ('img','br',None) for k in node.contents)
            if only_img:
                img=node.find('img');node.name='figure';style(node,'figure')
                frame=soup.new_tag('section');frame['data-template-frame']='true';frame['style']=css['frame'];img.wrap(frame)
                if nxt is not None and nxt.name=='p' and text_of(nxt) and (text_of(nxt)==(img.get('alt') or '').strip() or re.match(r'^图\s*\d',text_of(nxt))):
                    nxt['data-caption']='true'
                lead_done=True;continue
            if node.get('data-caption'):
                del node['data-caption'];node.name='figcaption';style(node,'caption');node.extract();body_blocks[i-1].append(node);continue
            if re.fullmatch(r'\d{1,2}',text_of(node)) and nxt is not None and nxt.name in ('h2','h3','h4'):style(node,'kicker');continue
            if not lead_done and not re.match(r'[〔\[（(]?\d',text_of(node)):style(node,'lead');lead_done=True;continue
            style(node,'p')
        elif name in ('h1','h2'):style(node,'h2')
        elif name=='h3':style(node,'h3')
        elif name=='h4':style(node,'h4')
        elif name=='figure':
            style(node,'figure')
            img=node.find('img')
            if img:
                frame=soup.new_tag('section');frame['data-template-frame']='true';frame['style']=css['frame'];img.wrap(frame)
        lead_done=lead_done or name in ('h2','h3','figure')
    for h in soup.find_all(['h2','h3']):
        if css.get('h3_wrap') and h.contents:
            span=soup.new_tag('span');span['data-template-wrap']='true';span['style']=css['h3_wrap']
            for child in list(h.contents):span.append(child.extract())
            h.append(span)
    for q in soup.find_all('blockquote'):
        style(q,'quote')
        for p in q.find_all('p'):p['style']=f"margin:0;font-size:inherit;line-height:inherit;color:inherit;"
    for img in soup.find_all('img'):style(img,'img')
    for caption in soup.find_all('figcaption'):style(caption,'caption')
    for listing in soup.find_all(['ul','ol']):style(listing,'ul')
    for li in soup.find_all('li'):style(li,'li')
    for pre in soup.find_all('pre'):style(pre,'pre')
    for code in soup.find_all('code'):style(code,'code' if code.parent.name=='pre' else 'code_inline')
    for table in soup.find_all('table'):style(table,'table')
    for cell in soup.find_all(['th','td']):style(cell,cell.name)
    for hr in soup.find_all('hr'):style(hr,'hr')
    for node in soup.find_all(['strong','b']):style(node,'strong')
    for node in soup.find_all(['em','i']):style(node,'em')
    for a in soup.find_all('a'):style(a,'a')
    if refs_at is not None:
        heading=blocks[refs_at];style(heading,'ref_heading')
        for sibling in blocks[refs_at+1:]:
            if sibling.name in ('h1','h2','h3','h4'):break
            # A full URL stays visible and copyable, but has its own quieter line.
            for node in list(sibling.find_all(string=True)):
                if node.parent.name in ('script','style','code') or not re.search(r'https?://\S+',str(node)):continue
                for part in re.split(r'(https?://[^\s<>]+)',str(node)):
                    if not part:continue
                    if re.match(r'https?://',part):
                        span=soup.new_tag('span');span['data-template-url']='true';span['style']=css['ref_url'];span.string=part;node.insert_before(span)
                    else:node.insert_before(part)
                node.extract()
            for entry in ([sibling] if sibling.name in ('p','li') else sibling.find_all(['p','li'])):
                style(entry,'ref')
                for text in entry.find_all(string=True):
                    match=re.match(r'^(\s*[〔\[（(]?\d+[〕\]）).、]?)(.*)$',str(text),re.S)
                    if match:
                        label=soup.new_tag('span');label['data-template-number']='true';label['style']=css['ref_num'];label.string=match.group(1);text.insert_before(label);text.replace_with(match.group(2))
                    break
                for url in entry.find_all('span',attrs={'data-template-url':'true'}):
                    if getattr(url.previous_sibling,'name',None)=='br':url.previous_sibling.extract()
                for a in entry.find_all('a'):a['style']=f"color:{c['muted']};text-decoration:none;word-break:break-all;"
    mode=t.get('figure_tone','muted')
    if ws is not None and mode!='original':
        from image_tone import toned_ref
        for img in soup.find_all('img'):
            ref=img.get('src','')
            if not re.fullmatch(r'images/[a-f0-9]{32}\.png',ref):continue
            try:img['src']=toned_ref(ws,ref,c,mode)
            except (ValueError,OSError):continue
            img['data-template-src']=ref
    root=soup.new_tag('section');root['data-template-root']='true';root['style']=css['root']
    for child in list(soup.contents):root.append(child.extract())
    soup.append(root)
    return str(soup)
