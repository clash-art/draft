import test from 'node:test';import assert from 'node:assert/strict';
import {layoutWarnings,assertPageBounds} from '../src/layout-quality.js';
test('warns about sparse body pages without flagging deliberate cover space',()=>{
 const warnings=layoutWarnings({pages:[{page:1,roles:['cover'],fill:.2},{page:2,fill:.54},{page:3,fill:.75}]});
 assert.equal(warnings.length,1);assert.match(warnings[0],/第 2 页.*54%/);
});
const page=(width,scroll)=>({clientWidth:width,scrollWidth:scroll,clientHeight:800,scrollHeight:800,querySelectorAll:()=>[]});
test('refuses clipped horizontal content before exporting',()=>{
 assert.throws(()=>assertPageBounds(page(600,800)),/超出页面/);
 assert.doesNotThrow(()=>assertPageBounds(page(600,600)));
});
test('refuses an empty bullet introduced by rich text conversion',()=>{
 const p=page(600,600);p.querySelectorAll=selector=>selector==='li'?[{textContent:' ',querySelector:()=>null}]:[];
 assert.throws(()=>assertPageBounds(p),/空列表/);
});
