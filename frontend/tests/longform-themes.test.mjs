import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {themeColors,THEME_LAYOUTS} from '../src/longform-themes.js';
const presets=JSON.parse(readFileSync(new URL('../../assets/xhs-longform-presets.json',import.meta.url),'utf8'));

test('every preset maps to its own page theme',()=>{
 assert.deepEqual(presets.map(p=>p.layout),['folio','blueprint','tweet','brief','press','marker','note']);
 assert.ok(presets.every(p=>THEME_LAYOUTS.includes(p.layout)));
 assert.equal(new Set(presets.map(p=>p.layout)).size,presets.length);
});

test('edition palette overrides template colours, which override theme defaults',()=>{
 const base={accent:'#111111',paper:'#ffffff',ink:'#000000',body:'#222222',muted:'#777777',rule:'#eeeeee'};
 assert.equal(themeColors(base,{accent:'#1a3ba8'}).accent,'#1a3ba8');
 const c=themeColors(base,{accent:'#1a3ba8'},{primary:'#2c1fea',paper:'#fafafa',text:'#3f3f46',on_primary:'#ffffff',surface:'#eff4ff'});
 assert.deepEqual([c.accent,c.paper,c.body,c.onPrimary,c.surface,c.ink],['#2c1fea','#fafafa','#3f3f46','#ffffff','#eff4ff','#000000']);
 assert.equal(themeColors(base,{},{primary:'not-a-colour'}).accent,'#111111');
 assert.match(themeColors(base,{}).surface,/^#[0-9a-f]{6}$/);
});
