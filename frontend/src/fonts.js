// Bundled open-licensed page fonts (assets/fonts, built by scripts/build_fonts.py; licences in
// assets/fonts/LICENSES.md). Pages are laid out and exported with these faces only: the slices a
// page's text needs are fetched through the workbench API, registered as FontFace objects before
// measuring, and embedded into each exported PNG, so no installed system font stands in for them.
import manifest from '../../assets/fonts/manifest.json';

const parse=spec=>spec.split(',').map(p=>{const [a,b]=p.trim().slice(2).split('-');return [parseInt(a,16),parseInt(b||a,16)]});
// Code point -> slice keys holding it.
const OWNER=new Map();
for(const [key,spec] of Object.entries(manifest.ranges))for(const [a,b] of parse(spec))for(let c=a;c<=b;c++){if(!OWNER.has(c))OWNER.set(c,[]);OWNER.get(c).push(key)}
const FAMILIES=new Map();
const codes=spec=>new Set(spec?parse(spec).flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i)):[]);
for(const face of manifest.faces){face.keys=new Set(face.files.map(([,key])=>key));face.gaps=codes(face.absent);if(!FAMILIES.has(face.family))FAMILIES.set(face.family,[]);FAMILIES.get(face.family).push(face)}
// CSS font matching between the bundled weights (400/700): 500 and below take the lighter face.
function pick(family,weight){
 const faces=[...FAMILIES.get(family)].sort((a,b)=>a.weight-b.weight);
 const lighter=faces.filter(f=>f.weight<=weight).at(-1),heavier=faces.find(f=>f.weight>=weight);
 return weight>500?heavier||lighter:lighter||heavier;
}
const familiesOf=value=>value.split(',').map(x=>x.trim().replace(/^["']|["']$/g,''));

// Slices the rendered text of `root` uses, plus characters no bundled face covers.
function needs(root){
 const use=new Map(),missing=new Set(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  let text=node.textContent;if(!text.trim())continue;
  const s=getComputedStyle(node.parentElement);
  if(s.textTransform==='uppercase')text=text.toUpperCase();
  const faces=[...new Set(familiesOf(s.fontFamily).filter(f=>FAMILIES.has(f)).map(f=>pick(f,parseInt(s.fontWeight,10)||400)))];
  // The line strut comes from the first face whose loaded slices cover U+0020, so that slice always loads.
  for(const face of faces)if(!use.has(face))use.set(face,new Set((OWNER.get(32)||[]).filter(k=>face.keys.has(k)).slice(0,1)));
  for(const ch of new Set(text)){
   if(/[\t\n\r ]/.test(ch))continue;
   const code=ch.codePointAt(0),keys=OWNER.get(code)||[];let covered=false;
   for(const face of faces){if(face.keys.has(null)){covered=true;continue}if(face.gaps.has(code))continue;for(const k of keys)if(face.keys.has(k)){use.get(face).add(k);covered=true}}
   if(!covered)missing.add(ch);
  }
 }
 const files=[];
 for(const [face,keys] of use)for(const [file,key] of face.files)if(key===null||keys.has(key))files.push({file,key,family:face.family,weight:face.weight});
 return {files,missing};
}

const data=new Map(),registered=new Set();
async function fetchFiles(files,api){
 const wanted=[...new Set(files.map(f=>f.file))].filter(f=>!data.has(f));
 for(let i=0;i<wanted.length;i+=24){const batch=wanted.slice(i,i+24),r=await api('/api/font',{files:batch});for(const f of batch)data.set(f,r.fonts[f])}
}
// Loads every bundled slice the text under `root` (attached to the document) needs. Returns the
// characters that will fall back to another font because no bundled face covers them.
export async function loadFonts(root,api){
 const {files,missing}=needs(root);await fetchFiles(files,api);
 await Promise.all(files.filter(f=>!registered.has(f.file)).map(async f=>{
  registered.add(f.file);
  const face=new FontFace(f.family,`url(${data.get(f.file)})`,{weight:String(f.weight),...(f.key?{unicodeRange:manifest.ranges[f.key]}:{})});
  document.fonts.add(await face.load());
 }));
 return [...missing].join('');
}
// @font-face rules embedding exactly the slices `root` uses, for html-to-image's fontEmbedCSS.
export async function fontEmbedCSS(root,api){
 await loadFonts(root,api);
 return needs(root).files.map(f=>`@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};src:url(${data.get(f.file)}) format("woff2");${f.key?`unicode-range:${manifest.ranges[f.key]};`:''}}`).join('\n');
}
