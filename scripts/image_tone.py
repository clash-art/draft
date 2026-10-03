"""Figure toning for article layouts: pulls an image toward the layout's muted palette.

A duotone runs from a softened ink to a lightened paper by luminance; 'muted' keeps a little
of the original colour, 'duotone' none. Toned copies are written beside the originals under a
name derived from the source and tone, so originals are never modified and repeat renders
reuse the same file."""
import hashlib
from PIL import Image

TONES=('muted','duotone','original')
KEEP={'muted':0.22,'duotone':0.0}

def _rgb(color):return tuple(int(color[i:i+2],16) for i in (1,3,5))
def _mix(a,b,t):return tuple(round(x+(y-x)*t) for x,y in zip(_rgb(a),_rgb(b)))

def tone(image,ink,accent,paper,mode='muted'):
 if mode not in KEEP:return image
 dark,light=_mix(ink,accent,0.35),_mix(paper,'#ffffff',0.6)
 rgba=image.convert('RGBA');alpha=rgba.getchannel('A')
 gray=rgba.convert('L')
 lut=[]
 for k in range(3):lut+=[round(dark[k]+(light[k]-dark[k])*v/255) for v in range(256)]
 duo=Image.merge('RGB',[gray.point(lut[k*256:(k+1)*256]) for k in range(3)])
 out=Image.blend(duo,rgba.convert('RGB'),KEEP[mode]) if KEEP[mode] else duo
 out.putalpha(alpha)
 return out

def toned_ref(ws,ref,colors,mode):
 """Workspace ref of the toned copy of ref, creating it on first use."""
 if mode not in KEEP:return ref
 source=ws.image_path(ref)
 key=hashlib.md5(f"{ref}|{mode}|{colors['ink']}|{colors['primary']}|{colors['paper']}".encode()).hexdigest()
 target=source.parent/(key+'.png')
 if not target.exists():
  with Image.open(source) as image:tone(image,colors['ink'],colors['primary'],colors['paper'],mode).save(target,'PNG',optimize=True)
 return f'images/{key}.png'
