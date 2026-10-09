"""WeChat article layouts as static style specs over colour and type tokens.

Everything is an inline style on WeChat-safe tags (section/p/span/h*/figure/img/blockquote/
pre/code/table). Decoration is thin rules, borders and pale tints only, never injected text, so the
published article text stays identical to the source.
"""
SANS="-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"
SERIF="'Songti SC','STSong','Noto Serif CJK SC','Source Han Serif SC',serif"
MONO="'SF Mono',Menlo,Consolas,'Liberation Mono',monospace"

def mix(a,b,t):
 x=[int(a[i:i+2],16) for i in (1,3,5)];y=[int(b[i:i+2],16) for i in (1,3,5)]
 return '#'+''.join(f'{round(u+(v-u)*t):02x}' for u,v in zip(x,y))

# Each layout has its own soft palette: a light paper (white, cool grey or a pale muted tint),
# dark ink and one low-saturation Morandi accent for numbers, small labels, thin rules and links.
# An edition palette may override these tokens.
PALETTES={
 'graphite':dict(paper='#ffffff',surface='#f2f3f4',ink='#1c1e21',text='#33363a',muted='#80858b',primary='#6b7480',on_primary='#ffffff',accent='#6b7480',rule='#e2e4e7'),
 'wechat':dict(paper='#ffffff',surface='#f0f3f1',ink='#1d211f',text='#353a37',muted='#7f8782',primary='#7d9184',on_primary='#ffffff',accent='#7d9184',rule='#e1e6e3'),
 'essay':dict(paper='#f6f1ea',surface='#ece5db',ink='#2a2420',text='#3f3833',muted='#8a7f75',primary='#8b7765',on_primary='#ffffff',accent='#8b7765',rule='#ddd3c6'),
 'journal':dict(paper='#fcfbf9',surface='#f2eeea',ink='#141414',text='#2c2a28',muted='#85807b',primary='#a0624f',on_primary='#ffffff',accent='#a0624f',rule='#dcd6d0'),
 'lab':dict(paper='#f1f3f3',surface='#e5eaea',ink='#1a2020',text='#313838',muted='#7a8484',primary='#6a8a8a',on_primary='#ffffff',accent='#6a8a8a',rule='#d3dbdb'),
 'letter':dict(paper='#f4f1ea',surface='#e9e5da',ink='#2b2a23',text='#433f37',muted='#8b877a',primary='#8a8466',on_primary='#ffffff',accent='#8a8466',rule='#dcd7c9'),
 'blueprint':dict(paper='#fbfbfa',surface='#eef1f4',ink='#16191d',text='#2c3035',muted='#7d858e',primary='#6e8098',on_primary='#ffffff',accent='#6e8098',rule='#c5cdd6'),
 'column':dict(paper='#f6f1f0',surface='#ece3e2',ink='#211c1c',text='#3a3332',muted='#877c7b',primary='#a07a7f',on_primary='#ffffff',accent='#a07a7f',rule='#ded3d2'),
 'spark':dict(paper='#ffffff',surface='#f7f7f7',ink='#4e4e4e',text='#333333',muted='#999999',primary='#e9682e',on_primary='#ffffff',accent='#e9682e',rule='#e6e6e6'),
}
# 火花: Latin in a Times-style serif over the reader's CJK sans for body text; section titles in a
# regular-weight Song face with an accent numeral on the same line.
SPARK_BODY="'Times New Roman',Times,Georgia,-apple-system,'PingFang SC','Hiragino Sans GB','Noto Sans CJK SC','Microsoft YaHei',sans-serif"
SPARK_HEAD="'Times New Roman',Times,Georgia,'Songti SC','STSong','Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC',serif"

def spec(layout,c,t):
 """CSS per role. c: resolved palette, t: template typography."""
 fs,lh,gap=t['font_size'],t['line_height'],t['paragraph_gap']
 rs,rg=t['reference_size'],t['reference_gap']
 serif=layout in ('essay','letter','journal')
 body_font=SERIF if layout in ('essay','letter') else SANS
 head_font=SERIF if serif else SANS
 tint=c['surface']
 base=dict(
  root=f"margin:0;padding:{'0' if c['paper']=='#ffffff' else '22px 18px'};background:{c['paper']};font-family:{body_font};",
  p=f"margin:0 0 {gap:g}px;font-size:{fs:g}px;line-height:{lh:g};letter-spacing:0.5px;color:{c['text']};text-align:left;overflow-wrap:anywhere;",
  lead=f"margin:0 0 {gap+10:g}px;font-size:{fs+1:g}px;line-height:{lh:g};letter-spacing:0.5px;color:{c['ink']};text-align:left;",
  kicker=f"margin:40px 0 6px;font-family:{MONO};font-size:13px;line-height:1.4;letter-spacing:2px;font-weight:700;color:{c['primary']};",
  h2=f"margin:0 0 16px;font-family:{head_font};font-size:{fs+5:g}px;line-height:1.45;font-weight:700;color:{c['ink']};letter-spacing:0.5px;",
  h3=f"margin:0 0 16px;font-family:{head_font};font-size:{fs+3:g}px;line-height:1.5;font-weight:700;color:{c['ink']};letter-spacing:0.5px;",
  h4=f"margin:26px 0 10px;font-family:{head_font};font-size:{fs+1:g}px;line-height:1.5;font-weight:700;color:{c['ink']};",
  strong=f"font-weight:700;color:{c['ink']};",
  em=f"font-style:normal;color:{c['primary']};",
  a=f"color:{c['primary']};text-decoration:none;border-bottom:1px solid {mix(c['primary'],c['paper'],0.6)};word-break:break-all;",
  quote=f"margin:24px 0;padding:14px 18px;background:{tint};border-left:3px solid {c['primary']};color:{c['ink']};",
  figure="margin:28px 0;padding:0;",
  frame="margin:0;padding:0;",
  img="display:block;max-width:100%;height:auto;margin:0 auto;",
  caption=f"margin:10px 8px 0;font-size:12px;line-height:1.65;color:{c['muted']};text-align:center;letter-spacing:0.3px;",
  ul=f"margin:0 0 {gap:g}px;padding-left:22px;font-size:{fs:g}px;line-height:{lh:g};color:{c['text']};",
  li="margin:6px 0;padding-left:2px;",
  pre=f"margin:24px 0;padding:16px;background:{tint};border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;color:{c['ink']};",
  code=f"font-family:{MONO};font-size:13px;",
  code_inline=f"font-family:{MONO};font-size:0.88em;padding:1px 5px;margin:0 2px;background:{tint};color:{c['primary']};border-radius:3px;",
  table=f"width:100%;table-layout:fixed;border-collapse:collapse;margin:24px 0;font-size:13px;line-height:1.7;color:{c['text']};",
  th=f"padding:10px 8px;border-bottom:1px solid {c['ink']};text-align:left;overflow-wrap:anywhere;font-weight:700;color:{c['ink']};",
  td=f"padding:10px 8px;border-bottom:1px solid {c['rule']};text-align:left;overflow-wrap:anywhere;",
  hr=f"margin:36px auto;width:48px;border:0;border-top:2px solid {c['primary']};",
  ref_heading=f"margin:48px 0 16px;padding-top:14px;border-top:1px solid {c['ink']};font-family:{head_font};font-size:16px;line-height:1.5;font-weight:700;color:{c['ink']};letter-spacing:1px;",
  ref=f"margin:0 0 {rg:g}px;padding:0 0 0 30px;text-indent:-30px;font-size:{rs:g}px;line-height:1.55;color:{c['ink']};overflow-wrap:anywhere;",
  ref_num=f"display:inline-block;min-width:30px;text-indent:0;font-family:{MONO};font-size:11px;font-weight:700;color:{c['primary']};",
  ref_url=f"display:block;text-indent:0;margin-top:2px;font-size:11px;line-height:1.45;color:{c['muted']};word-break:break-all;overflow-wrap:anywhere;",
 )
 p=c['primary']
 if layout=='graphite':
  base.update(
   h3=base['h3'].replace('margin:0 0 16px','margin:6px 0 18px'),
   lead=base['lead']+f"padding-bottom:22px;border-bottom:1px solid {c['rule']};",
   quote=f"margin:28px 0;padding:16px 0;border-top:1px solid {c['ink']};border-bottom:1px solid {c['rule']};color:{c['ink']};font-size:{fs+1:g}px;line-height:{lh:g};",
   frame=f"margin:0;padding:0;border:1px solid {c['rule']};",
   caption=base['caption'].replace('text-align:center','text-align:left').replace('margin:10px 8px 0','margin:10px 0 0'),
   kicker=f"margin:44px 0 0;padding-top:14px;border-top:1px solid {c['ink']};font-family:{MONO};font-size:12px;line-height:1.4;letter-spacing:3px;font-weight:700;color:{p};",
   pre=f"margin:24px 0;padding:16px;background:{tint};border-left:2px solid {p};white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;color:{c['ink']};",
  )
 elif layout=='wechat':
  base.update(
   kicker=f"margin:40px 0 8px;font-family:{MONO};font-size:13px;line-height:1.4;letter-spacing:2px;font-weight:700;color:{p};",
   h3_wrap=f"padding-bottom:4px;border-bottom:3px solid {mix(p,c['paper'],0.7)};",
   quote=f"margin:24px 0;padding:16px 18px;background:{tint};border-radius:8px;color:{c['ink']};",
   frame="margin:0;padding:0;border-radius:8px;overflow:hidden;",
  )
 elif layout=='essay':
  base.update(
   p=base['p']+'letter-spacing:1px;',
   lead=f"margin:0 0 34px;font-family:{SERIF};font-size:{fs+2:g}px;line-height:2;color:{c['ink']};text-align:left;letter-spacing:1px;",
   kicker=f"margin:52px 0 4px;font-family:{SERIF};font-size:28px;line-height:1.2;font-weight:400;color:{c['primary']};text-align:center;letter-spacing:4px;",
   h3=f"margin:0 0 26px;font-family:{SERIF};font-size:{fs+4:g}px;line-height:1.6;font-weight:600;color:{c['ink']};text-align:center;letter-spacing:2px;",
   quote=f"margin:32px 12px;padding:0;font-family:{SERIF};font-size:{fs+3:g}px;line-height:1.9;color:{c['primary']};text-align:center;letter-spacing:1px;",
   caption=base['caption']+f"font-family:{SERIF};",
   ref_heading=f"margin:52px 0 18px;font-family:{SERIF};font-size:16px;line-height:1.5;font-weight:600;color:{c['ink']};text-align:center;letter-spacing:6px;",
  )
 elif layout=='journal':
  base.update(
   lead=f"margin:0 0 30px;font-family:{SERIF};font-size:{fs+2:g}px;line-height:1.95;color:{c['ink']};text-align:left;",
   kicker=f"margin:48px 0 0;font-family:{SERIF};font-size:40px;line-height:1;font-weight:700;color:{c['primary']};text-align:center;",
   h3=f"margin:12px 0 22px;padding:12px 0;border-top:1px solid {c['rule']};border-bottom:1px solid {c['rule']};font-family:{SERIF};font-size:{fs+4:g}px;line-height:1.5;font-weight:700;color:{c['ink']};text-align:center;letter-spacing:1px;",
   quote=f"margin:32px 10px;padding:18px 0;border-top:2px solid {p};border-bottom:2px solid {p};font-family:{SERIF};font-size:{fs+2:g}px;line-height:1.85;color:{c['ink']};text-align:center;",
   figure="margin:32px -2px;padding:0;",
   caption=base['caption']+'letter-spacing:1px;',
   ref_heading=f"margin:52px 0 18px;padding:10px 0;border-top:2px solid {c['ink']};border-bottom:1px solid {c['ink']};font-family:{SERIF};font-size:15px;line-height:1.5;font-weight:700;color:{c['ink']};text-align:center;letter-spacing:6px;",
  )
 elif layout=='lab':
  base.update(
   kicker=f"margin:40px 0 6px;font-family:{MONO};font-size:12px;line-height:1.4;letter-spacing:2px;font-weight:700;color:{p};",
   h3=f"margin:0 0 16px;padding:2px 0 2px 12px;border-left:4px solid {p};font-size:{fs+3:g}px;line-height:1.5;font-weight:700;color:{c['ink']};",
   quote=f"margin:24px 0;padding:14px 16px;background:{tint};border-radius:6px;color:{c['ink']};",
   frame=f"margin:0;padding:8px;background:{tint};border-radius:6px;",
   caption=f"margin:10px 0 0;padding-left:10px;border-left:2px solid {c['rule']};font-size:12px;line-height:1.65;color:{c['muted']};text-align:left;",
   pre=f"margin:24px 0;padding:16px;background:{tint};color:{c['ink']};border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;",
   ref_heading=f"margin:48px 0 16px;padding-top:12px;border-top:2px solid {mix(p,c['paper'],0.75)};font-size:16px;line-height:1.5;font-weight:700;color:{p};",
  )
 elif layout=='letter':
  base.update(
   p=base['p']+'letter-spacing:1px;',
   lead=f"margin:0 0 30px;font-family:{SERIF};font-size:{fs:g}px;line-height:2;color:{c['muted']};text-align:left;",
   kicker=f"margin:46px 0 4px;font-family:{SERIF};font-size:15px;line-height:1.4;color:{c['muted']};letter-spacing:3px;",
   h3=f"margin:0 0 20px;font-family:{SERIF};font-size:{fs+3:g}px;line-height:1.6;font-weight:500;color:{c['ink']};letter-spacing:1px;",
   quote=f"margin:28px 4px;padding:0 0 0 16px;border-left:1px solid {c['primary']};font-family:{SERIF};color:{c['ink']};font-size:{fs:g}px;line-height:2;",
   caption=base['caption']+f"font-family:{SERIF};",
   ref_heading=f"margin:52px 0 16px;font-family:{SERIF};font-size:15px;line-height:1.5;font-weight:500;color:{c['ink']};letter-spacing:3px;",
  )
 elif layout=='blueprint':
  dash=f"1px dashed {c['rule']}"
  base.update(
   lead=f"margin:0 0 26px;padding:16px 18px;background:{c['paper'] if c['paper']!='#ffffff' else tint};border:{dash};font-size:{fs:g}px;line-height:{lh:g};letter-spacing:0.5px;color:{c['ink']};text-align:left;",
   kicker=f"margin:44px 0 10px;font-family:{MONO};font-size:12px;line-height:1;letter-spacing:2px;font-weight:700;color:{p};border:1px solid {p};display:inline-block;padding:5px 9px;",
   h3=f"margin:0 0 18px;font-family:{SERIF};font-size:{fs+5:g}px;line-height:1.45;font-weight:800;color:{c['ink']};letter-spacing:0.3px;",
   h4=f"margin:26px 0 10px;font-family:{MONO};font-size:13px;line-height:1.5;font-weight:700;color:{c['muted']};letter-spacing:2px;text-transform:uppercase;",
   strong=f"font-weight:700;color:{c['ink']};",
   quote=f"margin:24px 0;padding:14px 16px;background:{tint};border:1px dashed {p};color:{c['ink']};",
   frame=f"margin:0;padding:10px;background:#ffffff;border:{dash};",
   caption=f"margin:10px 2px 0;padding-left:10px;border-left:2px solid {p};font-size:12px;line-height:1.6;color:{c['muted']};text-align:left;letter-spacing:0.3px;",
   pre=f"margin:24px 0;padding:14px 16px;background:#ffffff;border:{dash};white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;color:{c['ink']};",
   code_inline=f"font-family:{MONO};font-size:0.86em;padding:1px 5px;margin:0 2px;background:{tint};color:{p};",
   th=f"padding:9px 8px;background:{tint};color:{c['ink']};border-bottom:1px solid {p};text-align:left;overflow-wrap:anywhere;font-weight:700;font-family:{MONO};font-size:12px;letter-spacing:1px;",
   td=f"padding:9px 8px;border-bottom:{dash};text-align:left;overflow-wrap:anywhere;",
   hr=f"margin:32px 0;border:0;border-top:{dash};",
   ref_heading=f"margin:48px 0 14px;padding:0 0 10px;border-bottom:2px solid {p};font-size:16px;line-height:1.5;font-weight:800;color:{c['ink']};letter-spacing:1px;",
   ref=f"margin:0;padding:{max(rg-2,3):g}px 0 {max(rg-2,3):g}px 30px;text-indent:-30px;border-bottom:{dash};font-size:{rs:g}px;line-height:1.55;color:{c['ink']};overflow-wrap:anywhere;",
  )
 elif layout=='column':
  base.update(
   lead=f"margin:0 0 30px;padding:0 0 0 14px;border-left:4px solid {p};font-size:{fs+1:g}px;line-height:{lh:g};letter-spacing:0.5px;color:{c['ink']};text-align:left;font-weight:500;",
   kicker=f"margin:46px 0 0;font-size:44px;line-height:1;font-weight:900;color:{p};letter-spacing:-1px;font-family:{SANS};",
   h3=f"margin:6px 0 20px;padding:0 0 12px;border-bottom:1px solid {c['ink']};font-size:{fs+5:g}px;line-height:1.4;font-weight:900;color:{c['ink']};",
   quote=f"margin:28px 0;padding:18px 18px;background:{tint};border-left:3px solid {p};color:{c['ink']};font-size:{fs+1:g}px;line-height:{lh:g};font-weight:600;",
   caption=f"margin:10px 0 0;font-size:12px;line-height:1.65;color:{c['muted']};text-align:left;padding-top:8px;border-top:2px solid {p};display:inline-block;",
   ref_heading=f"margin:52px 0 16px;padding:0 0 8px;border-bottom:3px solid {p};color:{c['ink']};font-size:16px;line-height:1.5;font-weight:900;letter-spacing:2px;",
  )
 elif layout=='spark':
  # Paragraphs are separated by one blank line (gap ≈ font size × line height); a section opens
  # after two blank lines and sits 10px above its text.
  title=f"font-family:{SPARK_HEAD};font-size:24px;line-height:1.4;font-weight:400;color:{c['ink']};letter-spacing:1px;text-align:left;"
  open_gap=round(gap*2+10)
  base.update(
   root=f"margin:0;padding:0 10px;background:{c['paper']};font-family:{SPARK_BODY};text-align:justify;",
   p=f"margin:0 0 {gap:g}px;font-size:{fs:g}px;line-height:{lh:g};color:{c['text']};text-align:justify;overflow-wrap:anywhere;",
   lead=f"margin:0 0 {gap:g}px;font-size:{fs:g}px;line-height:{lh:g};color:{c['text']};text-align:justify;overflow-wrap:anywhere;",
   heading_row=f"margin:{open_gap}px 0 10px;line-height:1.4;text-align:left;",
   kicker=f"display:inline;margin:0 12px 0 0;font-family:{SPARK_HEAD};font-size:24px;line-height:1.4;font-weight:400;color:{p};",
   heading_inline="display:inline;margin:0;"+title,
   h2=f"margin:{open_gap}px 0 10px;"+title.replace('font-size:24px','font-size:26px'),
   h3=f"margin:{open_gap}px 0 10px;"+title,
   h4=f"margin:{gap:g}px 0 8px;font-size:{fs+1:g}px;line-height:1.6;font-weight:700;color:{c['ink']};",
   strong=f"font-weight:700;color:{p};",
   em="font-style:italic;",
   quote=f"margin:{gap:g}px 0;padding:0 0 0 14px;border-left:2px solid {p};color:{mix(c['text'],c['paper'],0.25)};font-size:{fs:g}px;line-height:{lh:g};",
   figure=f"margin:{gap+10:g}px 0 {gap:g}px;padding:0;",
   caption=f"margin:10px 0 0;font-size:12px;line-height:1.8;color:{c['muted']};text-align:center;",
   hr=f"margin:{gap*2:g}px auto;width:32px;border:0;border-top:1px solid {p};",
   ref_heading=f"margin:{open_gap}px 0 14px;font-family:{SPARK_HEAD};font-size:18px;line-height:1.5;font-weight:400;color:{c['ink']};letter-spacing:1px;",
   ref_num=f"display:inline-block;min-width:30px;text-indent:0;font-family:{SPARK_HEAD};font-size:12px;color:{p};",
  )
 return base
