import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compatibilityHost,mcpHost,toolData} from '../src/host-bridge.js';
import {api,setHostTransport} from '../src/api.js';
test('ordinary browser never claims host messaging',()=>{
 assert.equal(compatibilityHost({}).sendToAgent,undefined);
 assert.equal(mcpHost({getHostCapabilities:()=>({})}).sendToAgent,undefined);
});
test('native host sends one user message and surfaces rejection',async()=>{
 let request;
 const app={getHostCapabilities:()=>({message:{}}),sendMessage:async r=>{request=r;return {}}};
 await mcpHost(app).sendToAgent('fill selected template');
 assert.deepEqual(request,{role:'user',content:[{type:'text',text:'fill selected template'}]});
 app.sendMessage=async()=>({isError:true});
 await assert.rejects(mcpHost(app).sendToAgent('again'),/未接受/);
});
test('compatibility bridge preserves native prompt and propagates errors',async()=>{
 let request;
 await compatibilityHost({openai:{sendFollowUpMessage:async r=>{request=r}}}).sendToAgent('fill');
 assert.deepEqual(request,{prompt:'fill'});
 await assert.rejects(compatibilityHost({openai:{sendFollowUpMessage:async()=>{throw Error('offline')}}}).sendToAgent('fill'),/offline/);
});
test('shared API uses MCP transport without accessing HTTP credentials',async()=>{
 setHostTransport(async(path,data)=>({path,data}));
 try{assert.deepEqual(await api('/api/editor/load',{}),{path:'/api/editor/load',data:{}})}finally{setHostTransport(undefined)}
});
test('MCP errors are not mistaken for successful data',()=>{
 assert.throws(()=>toolData({isError:true,content:[{type:'text',text:'revision conflict'}]}),/revision conflict/);
 assert.deepEqual(toolData({structuredContent:{ok:true}}),{ok:true});
});

test('native host retains compatibility messaging when capability is absent',async()=>{
 let sent;
 const host=mcpHost({getHostCapabilities:()=>({})},{openai:{sendFollowUpMessage:async r=>{sent=r;return {}}}});
 assert.equal(typeof host.sendToAgent,'function');await host.sendToAgent('fill');assert.deepEqual(sent,{prompt:'fill'});
});
test('explicit native rejection falls back to compatibility message',async()=>{
 let count=0;
 const host=mcpHost({getHostCapabilities:()=>({message:{}}),sendMessage:async()=>({isError:true})},{openai:{sendFollowUpMessage:async()=>{count++;return {}}}});
 await host.sendToAgent('fill');assert.equal(count,1);
});
test('unknown native delivery failure is not resent',async()=>{
 let count=0;
 const host=mcpHost({getHostCapabilities:()=>({message:{}}),sendMessage:async()=>{throw Error('timeout')}},{openai:{sendFollowUpMessage:async()=>{count++}}});
 await assert.rejects(host.sendToAgent('fill'),/timeout/);assert.equal(count,0);
});
