import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {themeColors,themeFor,THEME_LAYOUTS} from '../src/longform-themes.js';
import {pageSize,DEFAULT_PAGE_RATIO,COVER_SAFE} from '../src/page-size.js';
const presets=JSON.parse(readFileSync(new URL('../../assets/xhs-longform-presets.json',import.meta.url),'utf8'));

test('every base preset maps to its own page theme; combos compose existing parts',()=>{
 const bases=presets.filter(p=>!p.cover_layout),combos=presets.filter(p=>p.cover_layout);
 assert.deepEqual(bases.map(p=>p.layout),['blueprint','tweet','wireframe','photo','xstyle','canvas','doodle','devlog','plain','parts','bigtype']);
 assert.ok(presets.every(p=>THEME_LAYOUTS.includes(p.layout)));
 assert.ok(combos.length>=3);
 for(const c of combos){assert.ok(THEME_LAYOUTS.includes(c.cover_layout)&&THEME_LAYOUTS.includes(c.palette_from));assert.notEqual(c.cover_layout,c.layout)}
});

test('edition palette overrides template colours, which override theme defaults',()=>{
 const base={accent:'#111111',paper:'#ffffff',ink:'#000000',body:'#222222',muted:'#777777',rule:'#eeeeee'};
 assert.equal(themeColors(base,{accent:'#1a3ba8'}).accent,'#1a3ba8');
 const c=themeColors(base,{accent:'#1a3ba8'},{primary:'#2c1fea',paper:'#fafafa',text:'#3f3f46',on_primary:'#ffffff',surface:'#eff4ff'});
 assert.deepEqual([c.accent,c.paper,c.body,c.onPrimary,c.surface,c.ink],['#2c1fea','#fafafa','#3f3f46','#ffffff','#eff4ff','#000000']);
 assert.equal(themeColors(base,{},{primary:'not-a-colour'}).accent,'#111111');
 assert.match(themeColors(base,{}).surface,/^#[0-9a-f]{6}$/);
});

test('no preset draws a page header or footer, and figures stay inside the text column',()=>{
 for(const layout of THEME_LAYOUTS){
  const theme=themeFor({layout});
  assert.equal(theme.frame,undefined,layout);
  assert.doesNotMatch(theme.figureMargin,/-/,layout);
  assert.ok(theme.pad.top<=30&&theme.pad.bottom<=30,layout);
 }
});

test('pages default to tall 3:5 with covers inside the 3:4 feed crop',()=>{
 assert.equal(DEFAULT_PAGE_RATIO,'3:5');
 assert.deepEqual(pageSize({}),{width:360,height:600});
 assert.deepEqual(pageSize({page_ratio:'3:4'}),{width:360,height:480});
 assert.deepEqual(COVER_SAFE,{width:360,height:480});
 assert.ok(presets.every(p=>!p.page_ratio),'presets follow the single default page size');
});

test('body text is dense: about 31 CJK characters per line at line-height 1.6',()=>{
 for(const p of presets){
  const theme=themeFor(p),column=360-theme.pad.left-theme.pad.right,perLine=column/theme.size;
  assert.ok(perLine>=30&&perLine<=32,`${p.id}: ${perLine.toFixed(1)} per line`);
  assert.equal(theme.leading,1.6,p.id);
  assert.ok(theme.gap<=6,p.id);
 }
});

test('section titles carry no number, label or icon',()=>{
 const source=readFileSync(new URL('../src/longform-themes.js',import.meta.url),'utf8');
 const sections=source.split('\n').filter(l=>/^\s+section[:(]/.test(l));
 assert.equal(sections.length,THEME_LAYOUTS.length);
 assert.ok(sections.every(l=>/^\s+section:b=>sectionHead\(t,b(,\{[^}]*\})?\),$/.test(l)),sections.join('\n'));
});
