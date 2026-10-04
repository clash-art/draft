import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {themeColors,themeFor,THEME_LAYOUTS} from '../src/longform-themes.js';
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
