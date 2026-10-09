"""Builds the bundled page fonts in assets/fonts (dev-only; needs `pip install fonttools brotli py7zr`).

Every face is open-licensed (SIL OFL 1.1). CJK faces are cut into the frequency-ordered
unicode-range slices Google Fonts uses for Simplified Chinese, so a page only loads and embeds
the few slices its text touches. Smiley Sans reserves its font names, so it is shipped as the
official woff2 without modification.
"""
import argparse,io,json,re,shutil,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/fonts'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
GF='https://github.com/google/fonts/raw/main/ofl/'
SOURCES={
 'noto-sans-sc':{'url':GF+'notosanssc/NotoSansSC%5Bwght%5D.ttf','license':GF+'notosanssc/OFL.txt'},
 'noto-serif-sc':{'url':GF+'notoserifsc/NotoSerifSC%5Bwght%5D.ttf','license':GF+'notoserifsc/OFL.txt'},
 'inter':{'url':GF+'inter/Inter%5Bopsz,wght%5D.ttf','license':GF+'inter/OFL.txt'},
 'jetbrains-mono':{'url':GF+'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf','license':GF+'jetbrainsmono/OFL.txt'},
 'resource-han-rounded':{'url':'https://github.com/CyanoHao/Resource-Han-Rounded/releases/download/v0.990/RHR-CN-0.990.7z','license':'https://raw.githubusercontent.com/CyanoHao/Resource-Han-Rounded/master/OFL-License.txt'},
 'smiley-sans':{'url':'https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip','license':'https://raw.githubusercontent.com/atelier-anchor/smiley-sans/main/LICENSE'},
}
# Latin faces leave CJK-context punctuation (curly quotes, ellipsis, em dash, middle dot) to the CJK face.
LATIN='U+0000-00B6,U+00B8-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-2013,U+2016-2017,U+2020-2022,U+2030,U+2032-2033,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+21D2,U+2212,U+2215,U+2248,U+2260,U+2264-2265,U+FEFF,U+FFFD'
FACES=[
 {'id':'sans-sc-400','family':'Draft Sans SC','weight':400,'source':'noto-sans-sc','wght':400,'slices':'sc','name':'Noto Sans SC'},
 {'id':'sans-sc-700','family':'Draft Sans SC','weight':700,'source':'noto-sans-sc','wght':700,'slices':'sc','name':'Noto Sans SC'},
 {'id':'serif-sc-400','family':'Draft Serif SC','weight':400,'source':'noto-serif-sc','wght':400,'slices':'sc','name':'Noto Serif SC'},
 {'id':'serif-sc-700','family':'Draft Serif SC','weight':700,'source':'noto-serif-sc','wght':700,'slices':'sc','name':'Noto Serif SC'},
 {'id':'rounded-sc-400','family':'Draft Rounded SC','weight':400,'source':'resource-han-rounded','member':'ResourceHanRoundedCN-Regular.ttf','slices':'sc','name':'Resource Han Rounded CN'},
 {'id':'rounded-sc-700','family':'Draft Rounded SC','weight':700,'source':'resource-han-rounded','member':'ResourceHanRoundedCN-Bold.ttf','slices':'sc','name':'Resource Han Rounded CN'},
 {'id':'inter-400','family':'Draft Inter','weight':400,'source':'inter','wght':400,'opsz':14,'range':LATIN,'name':'Inter'},
 {'id':'inter-700','family':'Draft Inter','weight':700,'source':'inter','wght':700,'opsz':14,'range':LATIN,'name':'Inter'},
 {'id':'mono-400','family':'Draft Mono','weight':400,'source':'jetbrains-mono','wght':400,'range':LATIN,'name':'JetBrains Mono'},
 {'id':'mono-700','family':'Draft Mono','weight':700,'source':'jetbrains-mono','wght':700,'range':LATIN,'name':'JetBrains Mono'},
 {'id':'smiley','family':'Draft Smiley','weight':400,'source':'smiley-sans','member':'SmileySans-Oblique.ttf.woff2','verbatim':True,'name':'Smiley Sans Oblique'},
]

def fetch(url,path):
 if not path.exists():
  path.parent.mkdir(parents=True,exist_ok=True)
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA})) as r:path.write_bytes(r.read())
 return path

def parse(spec):
 out=set()
 for part in spec.split(','):
  part=part.strip()[2:]
  a,_,b=part.partition('-');out.update(range(int(a,16),int(b or a,16)+1))
 return out

def sc_ranges(cache):
 css=fetch('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400',cache/'noto-sans-sc.css').read_text()
 return [r.strip() for r in re.findall(r'unicode-range:\s*([^;]+);',css)]

def source_font(face,cache):
 from fontTools.ttLib import TTFont
 from fontTools.varLib import instancer
 src=SOURCES[face['source']];raw=fetch(src['url'],cache/Path(src['url'].split('?')[0]).name.replace('%5B','[').replace('%5D',']').replace('%2C',','))
 if raw.suffix=='.7z':
  import py7zr
  target=cache/face['member']
  if not target.exists():
   with py7zr.SevenZipFile(raw) as z:z.extract(path=cache,targets=[face['member']])
  raw=target
 elif raw.suffix=='.zip':
  target=cache/face['member']
  if not target.exists():zipfile.ZipFile(raw).extract(face['member'],cache)
  raw=target
 if face.get('verbatim'):return raw.read_bytes()
 font=TTFont(raw)
 if 'fvar' in font:
  axes={a.axisTag for a in font['fvar'].axes}
  font=instancer.instantiateVariableFont(font,{k:v for k,v in (('wght',face.get('wght')),('opsz',face.get('opsz'))) if k in axes and v},updateFontNames=True)
 buf=io.BytesIO();font.save(buf);return buf.getvalue()

def cut(data,codepoints):
 from fontTools.ttLib import TTFont
 from fontTools import subset
 font=TTFont(io.BytesIO(data))
 if not set(font.getBestCmap())&codepoints:return None
 o=subset.Options();o.flavor='woff2';o.layout_features=['*'];o.hinting=False;o.desubroutinize=True
 s=subset.Subsetter(o);s.populate(unicodes=codepoints);s.subset(font)
 b=io.BytesIO();font.flavor='woff2';font.save(b);return b.getvalue()

def spec(codes):
 codes=sorted(codes);out=[];i=0
 while i<len(codes):
  j=i
  while j+1<len(codes) and codes[j+1]==codes[j]+1:j+=1
  out.append(f'U+{codes[i]:04X}'+(f'-{codes[j]:04X}' if j>i else ''));i=j+1
 return ','.join(out)

def absent(face,ranges):
 """Code points inside a face's slice ranges that the font itself has no glyph for."""
 from fontTools.ttLib import TTFont
 missing=set()
 for file,key in face['files']:
  if key:missing|=parse(ranges[key])-set(TTFont(OUT/file,lazy=True).getBestCmap())
 return spec(missing)

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--cache',default=str(ROOT/'work/font-src'));ap.add_argument('--only',nargs='*')
 ap.add_argument('--manifest-only',action='store_true',help='recompute glyph gaps for the existing files')
 args=ap.parse_args();cache=Path(args.cache)
 if args.manifest_only:
  manifest=json.loads((OUT/'manifest.json').read_text())
  for face in manifest['faces']:face['absent']=absent(face,manifest['ranges'])
  (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n');return
 ranges=sc_ranges(cache);manifest={'ranges':{'latin':LATIN,**{f'sc{i:03d}':r for i,r in enumerate(ranges)}},'faces':[]}
 old=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {'faces':[]}
 for face in FACES:
  if args.only and face['id'] not in args.only:
   manifest['faces']+=[f for f in old['faces'] if f['id']==face['id']];continue
  folder=OUT/face['id'];shutil.rmtree(folder,ignore_errors=True);folder.mkdir(parents=True)
  data=source_font(face,cache);files=[]
  if face.get('verbatim'):(folder/'font.woff2').write_bytes(data);files.append([f"{face['id']}/font.woff2",None])
  else:
   for key in ([k for k in manifest['ranges'] if k.startswith('sc')] if face.get('slices') else ['latin']):
    woff=cut(data,parse(manifest['ranges'][key]))
    if woff:(folder/f'{key}.woff2').write_bytes(woff);files.append([f"{face['id']}/{key}.woff2",key])
  entry={k:face[k] for k in ('id','family','weight','name')}|{'source':face['source'],'files':files}
  manifest['faces'].append(entry|{'absent':absent(entry,manifest['ranges'])})
  print(face['id'],len(files),'files',sum((OUT/f).stat().st_size for f,_ in files),'bytes',flush=True)
 lic=OUT/'licenses';lic.mkdir(exist_ok=True)
 for key,src in SOURCES.items():fetch(src['license'],lic/f'{key}.txt')
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')

if __name__=='__main__':main()
