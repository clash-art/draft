"""WeChat article layouts as static style specs over colour and type tokens.

Everything is an inline style on WeChat-safe tags (section/p/span/h*/figure/img/blockquote/
pre/code/table). Decoration is borders and colour blocks only, never injected text, so the
published article text stays identical to the source.
"""
SANS="-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"
SERIF="'Songti SC','STSong','Noto Serif CJK SC','Source Han Serif SC',serif"
MONO="'SF Mono',Menlo,Consolas,'Liberation Mono',monospace"

def mix(a,b,t):
 x=[int(a[i:i+2],16) for i in (1,3,5)];y=[int(b[i:i+2],16) for i in (1,3,5)]
 return '#'+''.join(f'{round(u+(v-u)*t):02x}' for u,v in zip(x,y))

# Default palettes. An edition palette (the article's project colours) overrides these.
PALETTES={
 'graphite':dict(paper='#ffffff',surface='#f4f5f7',ink='#16181d',text='#3b3f46',muted='#8a9099',primary='#2f3a48',on_primary='#ffffff',accent='#2f3a48',rule='#e3e6ea'),
 'wechat':dict(paper='#ffffff',surface='#eef6f1',ink='#18241d',text='#3a443e',muted='#87918b',primary='#1f8a5b',on_primary='#ffffff',accent='#1f8a5b',rule='#dfe9e3'),
 'essay':dict(paper='#fbf8f3',surface='#f3ece2',ink='#2b2420',text='#463d36',muted='#9a8d80',primary='#8a5a44',on_primary='#ffffff',accent='#8a5a44',rule='#e6dccf'),
 'journal':dict(paper='#ffffff',surface='#f7f3ef',ink='#1f1a17',text='#3f3833',muted='#968b83',primary='#8c4b35',on_primary='#ffffff',accent='#8c4b35',rule='#e2d8cf'),
 'lab':dict(paper='#ffffff',surface='#f1f5f8',ink='#15222d',text='#36434f',muted='#7f8d99',primary='#365b76',on_primary='#ffffff',accent='#365b76',rule='#dbe3ea'),
 'letter':dict(paper='#fcfbf6',surface='#f2f0e6',ink='#2e2c22',text='#4a473b',muted='#9a9684',primary='#686446',on_primary='#ffffff',accent='#686446',rule='#e4e1d3'),
 'blueprint':dict(paper='#f4f3ef',surface='#e8edf8',ink='#111111',text='#2c2c2c',muted='#85847f',primary='#1a3ba8',on_primary='#ffffff',accent='#1a3ba8',rule='#b9c3d9'),
 'column':dict(paper='#ffffff',surface='#f6f3f1',ink='#141414',text='#363636',muted='#8c8c8c',primary='#b4232c',on_primary='#ffffff',accent='#b4232c',rule='#e6e1de'),
}

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
   kicker=f"margin:44px 0 0;padding-top:14px;border-top:1px solid {c['ink']};font-family:{MONO};font-size:12px;line-height:1.4;letter-spacing:3px;font-weight:700;color:{c['muted']};",
   h3=base['h3'].replace('margin:0 0 16px','margin:6px 0 18px'),
   lead=base['lead']+f"padding-bottom:22px;border-bottom:1px solid {c['rule']};",
   quote=f"margin:28px 0;padding:16px 0;border-top:1px solid {c['ink']};border-bottom:1px solid {c['rule']};color:{c['ink']};font-size:{fs+1:g}px;line-height:{lh:g};",
   frame=f"margin:0;padding:0;border:1px solid {c['rule']};",
   caption=base['caption'].replace('text-align:center','text-align:left').replace('margin:10px 8px 0','margin:10px 0 0'),
   pre=f"margin:24px 0;padding:16px;background:{c['ink']};color:#f2f3f5;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;",
  )
 elif layout=='wechat':
  base.update(
   kicker=f"margin:40px 0 8px;font-family:{MONO};font-size:12px;line-height:1;letter-spacing:1px;font-weight:700;color:{c['on_primary']};background:{p};display:inline-block;padding:4px 9px;border-radius:999px;",
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
   pre=f"margin:24px 0;padding:16px;background:#14202b;color:#e6edf3;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;",
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
   kicker=f"margin:44px 0 10px;font-family:{MONO};font-size:12px;line-height:1;letter-spacing:2px;font-weight:700;color:{c['on_primary']};background:{p};display:inline-block;padding:6px 10px;",
   h3=f"margin:0 0 18px;font-size:{fs+4:g}px;line-height:1.45;font-weight:800;color:{c['ink']};letter-spacing:0.3px;",
   h4=f"margin:26px 0 10px;font-family:{MONO};font-size:13px;line-height:1.5;font-weight:700;color:{c['muted']};letter-spacing:2px;text-transform:uppercase;",
   strong=f"font-weight:700;color:{c['ink']};",
   quote=f"margin:24px 0;padding:14px 16px;background:{tint};border:1px dashed {p};color:{c['ink']};",
   frame=f"margin:0;padding:10px;background:#ffffff;border:{dash};",
   caption=f"margin:10px 2px 0;padding-left:10px;border-left:2px solid {p};font-size:12px;line-height:1.6;color:{c['muted']};text-align:left;letter-spacing:0.3px;",
   pre=f"margin:24px 0;padding:14px 16px;background:#ffffff;border:{dash};white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.75;color:{c['ink']};",
   code_inline=f"font-family:{MONO};font-size:0.86em;padding:1px 5px;margin:0 2px;background:{tint};color:{p};",
   th=f"padding:9px 8px;background:{p};color:{c['on_primary']};text-align:left;overflow-wrap:anywhere;font-weight:700;font-family:{MONO};font-size:12px;letter-spacing:1px;",
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
   quote=f"margin:28px 0;padding:18px 18px;background:{p};color:{c['on_primary']};font-size:{fs+1:g}px;line-height:{lh:g};font-weight:600;",
   quote_inner=f"color:{c['on_primary']};",
   caption=f"margin:10px 0 0;font-size:12px;line-height:1.65;color:{c['muted']};text-align:left;padding-top:8px;border-top:2px solid {p};display:inline-block;",
   ref_heading=f"margin:52px 0 16px;padding:8px 12px;background:{c['ink']};color:#ffffff;font-size:15px;line-height:1.5;font-weight:800;letter-spacing:2px;display:inline-block;",
  )
 return base
