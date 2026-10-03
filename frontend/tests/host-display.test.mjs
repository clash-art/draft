import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestWorkbenchDisplay} from '../src/host-bridge.js';
test('requests only advertised fullscreen and records actual response',async()=>{
 let input;const app={getHostContext:()=>({displayMode:'inline',availableDisplayModes:['inline','fullscreen']}),requestDisplayMode:async p=>{input=p;return {mode:'inline'}}};
 const r=await requestWorkbenchDisplay(app);
 assert.deepEqual(input,{mode:'fullscreen'});assert.equal(r.actualMode,'inline');assert.equal(r.requestedMode,'fullscreen');
});
test('does not request unavailable display mode',async()=>{
 const r=await requestWorkbenchDisplay({getHostContext:()=>({displayMode:'inline',availableDisplayModes:['inline']})});
 assert.equal(r.actualMode,'inline');assert.equal(r.requestedMode,null);
});
test('display rejection leaves working message connection usable',async()=>{
 const r=await requestWorkbenchDisplay({getHostContext:()=>({displayMode:'inline',availableDisplayModes:['fullscreen']}),requestDisplayMode:async()=>{throw Error('denied')}});
 assert.equal(r.actualMode,'inline');assert.equal(r.error,'denied');
});

test('already fullscreen does not request again',async()=>{
 const r=await requestWorkbenchDisplay({getHostContext:()=>({displayMode:'fullscreen',availableDisplayModes:['fullscreen']})});
 assert.equal(r.actualMode,'fullscreen');assert.equal(r.requestedMode,null);
});
test('pip-only host is not asked to open pip',async()=>{
 const r=await requestWorkbenchDisplay({getHostContext:()=>({displayMode:'inline',availableDisplayModes:['inline','pip']})});
 assert.equal(r.requestedMode,null);
});
test('compatibility-only host can request fullscreen',async()=>{
 let input;const r=await requestWorkbenchDisplay(null,{openai:{displayMode:'inline',requestDisplayMode:async p=>{input=p;return {mode:'fullscreen'}}}});
 assert.deepEqual(input,{mode:'fullscreen'});assert.equal(r.actualMode,'fullscreen');
});
test('compatibility display rejection falls back to advertised native fullscreen',async()=>{
 const app={getHostContext:()=>({displayMode:'inline',availableDisplayModes:['fullscreen']}),requestDisplayMode:async()=>({mode:'fullscreen'})};
 const r=await requestWorkbenchDisplay(app,{openai:{requestDisplayMode:async()=>{throw Error('unsupported')}}});
 assert.equal(r.actualMode,'fullscreen');assert.equal(r.error,undefined);
});
test('requests fullscreen when host omits availableDisplayModes',async()=>{
 let input;const r=await requestWorkbenchDisplay({getHostContext:()=>({}),requestDisplayMode:async p=>{input=p;return {mode:'fullscreen'}}});
 assert.deepEqual(input,{mode:'fullscreen'});assert.equal(r.actualMode,'fullscreen');
});
test('compatibility inline response does not prevent native fullscreen request',async()=>{
 let called=false;const r=await requestWorkbenchDisplay({getHostContext:()=>({}),requestDisplayMode:async()=>{called=true;return {mode:'fullscreen'}}},{openai:{displayMode:'inline',requestDisplayMode:async()=>({mode:'inline'})}});
 assert.equal(called,true);assert.equal(r.actualMode,'fullscreen');
});
