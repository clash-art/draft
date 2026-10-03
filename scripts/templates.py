"""Reusable article typography with lossless reference text and local persistence."""
import re, json, uuid, base64
from pathlib import Path
import markdown
from bs4 import BeautifulSoup
from wechat import save_json

# Article layouts plus the Xiaohongshu longform page themes (folio/brief/note).
LAYOUTS=('graphite','wechat','essay','journal','lab','letter','folio','brief','note')
BASE={'font_size':16,'line_height':1.85,'paragraph_gap':18,'reference_size':13,'reference_gap':8,'accent':'#333333'}
BUILTINS=[dict(BASE,id='graphite',name='石墨简报',description='细线章节 · 悬挂文献 · 技术长文',layout='graphite'),dict(BASE,id='wechat',name='微信清读',description='轻盈标题 · 浅底引文 · 知识分享',layout='wechat',accent='#07883f'),dict(BASE,id='essay',name='人文札记',description='宋体标题 · 留白段落 · 观点随笔',layout='essay',accent='#795548',line_height=2,paragraph_gap=22)]
BUILTINS += [
 dict(BASE,id='journal',name='纸上专题',description='居中章节 · 大图叙事 · 杂志专题',layout='journal',accent='#8c4b35',font_size=16,line_height=1.95,paragraph_gap=22),
 dict(BASE,id='lab',name='研究手记',description='左标章节 · 代码表格 · 研究解读',layout='lab',accent='#365b76',font_size=15.5,line_height=1.9),
 dict(BASE,id='letter',name='周末来信',description='宋体章节 · 轻图注 · 个人表达',layout='letter',accent='#686446',font_size=17,line_height=2,paragraph_gap=24),
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
    for key,low,high in [('font_size',14,20),('line_height',1.5,2.4),('paragraph_gap',10,32),('reference_size',11,15),('reference_gap',4,24)]:
        try:n=float(value.get(key,BASE[key]))
        except (ValueError,TypeError):raise ValueError('模板数值无效') from None
        if not low<=n<=high:raise ValueError('模板数值超出范围：'+key)
        out[key]=n
    accent=str(value.get('accent',BASE['accent']))
    if not re.fullmatch(r'#[0-9a-fA-F]{6}',accent):raise ValueError('主题色应为六位十六进制颜色')
    layout=value.get('layout',value.get('id','graphite'))
    out['layout']=layout if layout in LAYOUTS else 'graphite'
    out['accent']=accent
    if value.get('cover_style') in ('editorial','geek-report','consulting-report','clean-review'):out['cover_style']=value['cover_style']
    if value.get('page_ratio') in ('3:4','3:5','1:1','9:16'):out['page_ratio']=value['page_ratio']
    return out

def list_templates(root):
    folder=root/'templates';folder.mkdir(exist_ok=True)
    return BUILTINS+[json.loads(p.read_text()) for p in sorted(folder.glob('*.json'))]

def save_template(root,value):
    t=validate(value);identifier=t['id']
    if not re.fullmatch(r'[a-f0-9]{32}',identifier):identifier=uuid.uuid4().hex
    t['id']=identifier;folder=root/'templates';folder.mkdir(exist_ok=True);save_json(folder/(identifier+'.json'),t);return t

def render(body,template):
    t=validate(template);soup=BeautifulSoup(body if re.match(r'\s*<',body) else markdown.markdown(body,extensions=['tables','fenced_code']),'html.parser')
    for node in list(soup.find_all('span',attrs={'data-template-url':'true'}))+list(soup.find_all('span',attrs={'data-template-number':'true'})):node.unwrap()
    def style(node,css):
        node['style']=css
    # Replace typography left by earlier templates, keeping content and semantic marks.
    for node in soup.find_all(['span','a','strong','em','b','i','u']):
        declarations=[x for x in node.get('style','').split(';') if x.partition(':')[0].strip().lower() not in ('font-size','line-height','color','font-family')]
        if declarations:node['style']=';'.join(declarations)
        else:node.attrs.pop('style',None)
    for p in soup.find_all('p'):style(p,f"font-size:{t['font_size']:g}px;line-height:{t['line_height']:g};margin:{t['paragraph_gap']:g}px 0;color:#333333;overflow-wrap:anywhere;")
    for h in soup.find_all(['h1','h2','h3','h4']):style(h,f"font-size:{22 if h.name in ('h1','h2') else 18}px;line-height:1.5;margin:32px 0 14px;color:{t['accent']};font-weight:600;")
    for q in soup.find_all('blockquote'):style(q,f"margin:22px 0;padding:2px 16px;border-left:3px solid {t['accent']};background:#f7f7f7;")
    for img in soup.find_all('img'):style(img,'display:block;max-width:100%;height:auto;margin:20px auto;')
    for figure in soup.find_all('figure'):style(figure,'margin:26px 0;padding:0;')
    for caption in soup.find_all('figcaption'):style(caption,'font-size:12px;line-height:1.65;color:#888888;text-align:center;margin:10px 8px 0;')
    for a in soup.find_all('a'):style(a,f"color:{t['accent']};text-decoration:underline;word-break:break-all;")
    layout=t['layout']
    serif="font-family:'Songti SC','STSong','SimSun',serif;" if layout=='essay' else ''
    for h in soup.find_all(['h1','h2','h3','h4']):
        style(h,f"font-size:{24 if layout=='essay' else 21}px;line-height:1.5;margin:38px 0 16px;color:{t['accent']};font-weight:600;"+serif+('padding-top:18px;border-top:1px solid #d8d8d8;' if layout=='graphite' else 'padding-bottom:10px;border-bottom:1px solid #dce8df;' if layout=='wechat' else ''))
    first=soup.find('p')
    if first and not re.match(r'[〔\[（(]?\d',first.get_text(strip=True)):
        style(first,f"font-size:{18 if layout=='graphite' else 17}px;line-height:1.9;margin:0 0 28px;color:#444444;"+('padding-bottom:24px;border-bottom:1px solid #e1e7e2;' if layout=='wechat' else ''))
    for q in soup.find_all('blockquote'):
        style(q,('margin:26px 0;padding:18px 0;border-top:1px solid #bcbcbc;border-bottom:1px solid #e2e2e2;' if layout=='graphite' else 'margin:24px 0;padding:16px 18px;background:#f2f6f3;' if layout=='wechat' else 'margin:30px 12px;padding:0;color:#685a50;font-size:19px;line-height:1.9;'+serif))
    # Structural treatments, using inline styles that can travel with the article.
    if layout in ('journal','lab','letter'):
        for h in soup.find_all(['h1','h2','h3','h4']):
            size=23 if h.name in ('h1','h2') else 18
            base=f"font-size:{size}px;line-height:1.5;font-weight:600;color:{t['accent']};"
            treatment={
                'journal':"text-align:center;margin:42px 0 22px;padding:14px 0;border-top:1px solid #dcd4cd;border-bottom:1px solid #dcd4cd;letter-spacing:1px;",
                'lab':f"margin:32px 0 16px;padding:3px 0 3px 12px;border-left:3px solid {t['accent']};",
                'letter':"font-family:'Songti SC','STSong',serif;margin:40px 0 20px;font-weight:500;",
            }[layout]
            style(h,base+treatment)
        for q in soup.find_all('blockquote'):
            style(q,{
                'journal':f"margin:32px 14px;padding:18px 0;border-top:1px solid {t['accent']};border-bottom:1px solid {t['accent']};text-align:center;",
                'lab':"margin:24px 0;padding:16px 18px;background:#f2f5f7;border-radius:4px;",
                'letter':"margin:30px 6px;padding:0 16px;border-left:1px solid #c8c4b5;font-family:'Songti SC','STSong',serif;",
            }[layout])
        for caption in soup.find_all('figcaption'):
            style(caption,"font-size:12px;line-height:1.7;color:#888888;"+{
                'journal':"text-align:center;margin:12px 12px 0;letter-spacing:.4px;",
                'lab':"text-align:left;margin:10px 0 0;padding-left:10px;border-left:2px solid #ccd7df;",
                'letter':"text-align:center;margin:14px 12px 0;font-family:'Songti SC','STSong',serif;",
            }[layout])
        for figure in soup.find_all('figure'):style(figure,'margin:32px 0;padding:0;')
        if first:
            style(first,f"font-size:{18 if layout=='journal' else t['font_size']:g}px;line-height:1.95;margin:0 0 28px;color:#555555;"+('font-family:Songti SC,STSong,serif;' if layout=='letter' else ''))
    for listing in soup.find_all(['ul','ol']):style(listing,f"margin:18px 0;padding-left:24px;font-size:{t['font_size']:g}px;line-height:{t['line_height']:g};color:#333333;")
    for li in soup.find_all('li'):style(li,'margin:8px 0;padding-left:3px;')
    for pre in soup.find_all('pre'):style(pre,'margin:24px 0;padding:16px;background:#f4f5f6;border:1px solid #e8eaec;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.75;')
    for code in soup.find_all('code'):style(code,'font-family:ui-monospace,Menlo,monospace;font-size:13px;'+('' if code.parent.name=='pre' else 'padding:2px 4px;background:#f2f3f4;color:#4c5966;'))
    for table in soup.find_all('table'):style(table,'width:100%;table-layout:fixed;border-collapse:collapse;margin:24px 0;font-size:13px;line-height:1.7;')
    for cell in soup.find_all(['th','td']):style(cell,'padding:10px 8px;border-bottom:1px solid #e1e4e6;text-align:left;overflow-wrap:anywhere;'+('background:#f3f5f6;font-weight:600;' if cell.name=='th' else ''))
    reference_headers=[h for h in soup.find_all(['h1','h2','h3','h4','p']) if re.fullmatch(r'(参考资料|参考文献|参考链接|引用来源|References|Sources)[:：]?',h.get_text(strip=True),re.I)]
    for heading in reference_headers:
        style(heading,'font-size:16px;line-height:1.5;margin:30px 0 12px;padding-top:12px;border-top:1px solid #bcbcbc;color:#333333;font-weight:600;')
        for sibling in heading.next_siblings:
            if not getattr(sibling,'name',None):continue
            if sibling.name in ('h1','h2','h3','h4'):break
            nodes=[sibling]+list(sibling.find_all(['p','li','span','a','strong']))
            for n in nodes:
                style(n,f"font-size:{t['reference_size']:g}px;line-height:1.7;color:#666666;overflow-wrap:anywhere;word-break:break-word;"+(f"margin:0 0 {t['reference_gap']:g}px;" if n.name in ('p','li') else ''))
            # A full URL stays visible and copyable, but has its own quieter line.
            for node in list(sibling.find_all(string=True)):
                if node.parent.name in ('script','style','code'):continue
                if not re.search(r'https?://\S+',str(node)):continue
                parts=re.split(r'(https?://[^\s<>]+)',str(node))
                for part in parts:
                    if not part:continue
                    if re.match(r'https?://',part):
                        span=soup.new_tag('span');span['data-template-url']='true';span['style']=f'display:block;font-size:{t["reference_size"]:g}px;line-height:1.6;color:#666666;word-break:break-all;overflow-wrap:anywhere;';span.string=part;node.insert_before(span)
                    else:node.insert_before(part)
                node.extract()
            for p in ([sibling] if sibling.name in ('p','li') else sibling.find_all(['p','li'])):
                p['style']=f"font-size:{t['reference_size']:g}px;line-height:1.5;color:#333333;margin:0 0 {t['reference_gap']:g}px;padding:0 0 0 24px;border-bottom:none;text-indent:-24px;overflow-wrap:anywhere;"
                for text in p.find_all(string=True):
                    match=re.match(r'^(\s*[〔\[（(]?\d+[〕\]）).、]?)(.*)$',str(text),re.S)
                    if match:
                        label=soup.new_tag('span');label['data-template-number']='true';label['style']=f"display:inline-block;min-width:24px;text-indent:0;font-size:11px;color:{t['accent']};font-weight:600;";label.string=match.group(1);text.insert_before(label);text.replace_with(match.group(2))
                    break
                for url in p.find_all('span',attrs={'data-template-url':'true'}):
                    if getattr(url.previous_sibling,'name',None)=='br':url.previous_sibling.extract()
                    url['style']+='text-indent:0;margin-top:1px;font-size:11px;line-height:1.4;'
    # References stay complete; the surrounding rhythm follows the selected layout.
    if layout in ('journal','lab','letter'):
        for heading in reference_headers:
            if layout=='journal':heading['style']+='text-align:center;color:#8c4b35;letter-spacing:2px;'
            elif layout=='lab':heading['style']+='color:#365b76;border-top:2px solid #d7e0e7;'
            else:heading['style']+="font-family:'Songti SC','STSong',serif;font-weight:500;color:#686446;"
            for sibling in heading.next_siblings:
                if not getattr(sibling,'name',None):continue
                if sibling.name in ('h1','h2','h3','h4'):break
                for entry in ([sibling] if sibling.name in ('p','li') else sibling.find_all(['p','li'])):
                    if layout=='letter':entry['style']+='border-bottom:none;padding-bottom:0;'
                    elif layout=='lab':entry['style']+='border-bottom:none;'
    return str(soup)
