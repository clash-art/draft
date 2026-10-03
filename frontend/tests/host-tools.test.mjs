import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callHostTool} from '../src/host-bridge.js';
test('uses compatibility callTool before MCP proxy',async()=>{
 let called;const result=await callHostTool({callServerTool:()=>{throw Error('wrong transport')}},{openai:{callTool:async(name,args)=>{called={name,args};return {structuredContent:{ok:true}}}}},'save',{revision:'v1'});
 assert.deepEqual(result,{ok:true});assert.deepEqual(called,{name:'save',args:{revision:'v1'}});
});
test('does not retry a business failure or ambiguous transport failure',async()=>{
 for(const fail of [()=>({isError:true,content:[{type:'text',text:'revision conflict'}]}),()=>{throw Error('timeout')}]){
 let retries=0;await assert.rejects(callHostTool({callServerTool:()=>{retries++}},{openai:{callTool:async()=>fail()}},'save',{}));assert.equal(retries,0);
 }
});
test('uses MCP proxy when no compatibility API exists',async()=>{
 assert.deepEqual(await callHostTool({callServerTool:async()=>({structuredContent:{ok:true}})},{},'read',{}),{ok:true});
});
