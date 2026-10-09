"""Colour tokens. Every template ships its own palette (white, dark, cool or warm paper; a couple
are Morandi) with one tasteful accent. An edition may override any token: paper and text tokens
stay near-neutral, and primary/accent may be crisp but not neon (saturation is capped)."""
import re

KEYS=('paper','surface','ink','text','muted','primary','on_primary','accent','rule')
HEX=re.compile(r'#[0-9a-fA-F]{6}')

def _luminance(color):
 def channel(c):
  c=int(c,16)/255
  return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
 r,g,b=(channel(color[i:i+2]) for i in (1,3,5))
 return 0.2126*r+0.7152*g+0.0722*b

def contrast(a,b):
 x,y=sorted((_luminance(a),_luminance(b)),reverse=True)
 return (x+0.05)/(y+0.05)

NEUTRAL=('paper','surface','ink','text','muted','rule')
MAX_CHROMA=28
MAX_SATURATION=0.85
def chroma(color):
 c=[int(color[i:i+2],16) for i in (1,3,5)]
 return max(c)-min(c)
def saturation(color):
 c=[int(color[i:i+2],16)/255 for i in (1,3,5)]
 hi,lo=max(c),min(c);l=(hi+lo)/2
 return 0 if hi==lo else (hi-lo)/(1-abs(2*l-1))

# Pairs that carry body text; 4.5 is the WCAG AA threshold for normal text.
READABLE=(('text','paper',4.5),('ink','paper',4.5),('on_primary','primary',3.0),('muted','paper',2.8))

def validate_palette(value):
 if not value:return None
 if not isinstance(value,dict):raise ValueError('配色无效')
 out={}
 for key in KEYS:
  if key not in value or value[key] in (None,''):continue
  color=str(value[key])
  if not HEX.fullmatch(color):raise ValueError(f'配色 {key} 应为六位十六进制颜色')
  out[key]=color.lower()
 unknown=set(value)-set(KEYS)-{'name','source'}
 if unknown:raise ValueError('未知配色字段：'+'、'.join(sorted(unknown)))
 if not out:raise ValueError('配色至少需要一个颜色')
 for key in NEUTRAL:
  if key in out and chroma(out[key])>MAX_CHROMA:raise ValueError(f'配色 {key} 应接近中性（{out[key]} 颜色太重）；纸面可用白、浅灰或很淡的莫兰迪色')
 for key in ('primary','accent'):
  if key in out and saturation(out[key])>MAX_SATURATION:raise ValueError(f'配色 {key} 太刺眼（{out[key]}）；请用克制的点缀色')
 for fg,bg,minimum in READABLE:
  if fg in out and bg in out and contrast(out[fg],out[bg])<minimum:raise ValueError(f'配色 {fg} 与 {bg} 对比度不足（{contrast(out[fg],out[bg]):.1f}，需要 ≥ {minimum}）')
 for key,limit in (('name',40),('source',300)):
  if value.get(key):out[key]=str(value[key]).strip()[:limit]
 return out

def resolve(defaults,template=None,palette=None):
 """Layout defaults < template accent/palette < edition palette."""
 out=dict(defaults)
 if template:
  if template.get('accent') and template['accent'].lower()!='#333333':out['primary']=template['accent'].lower()
  out.update({k:v for k,v in (template.get('palette') or {}).items() if k in KEYS})
 out.update({k:v for k,v in (palette or {}).items() if k in KEYS})
 return out
