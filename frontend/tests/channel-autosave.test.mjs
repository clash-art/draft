import test from 'node:test';import assert from 'node:assert/strict';import {ChannelAutosave} from '../src/channel-autosave.js';
test('serializes edits and carries returned revision, independently per channel',async()=>{
 let release;const seen=[];const queue=new ChannelAutosave(async(key,data)=>{seen.push([key,data]);if(seen.length===1)await new Promise(r=>release=r);return {...data,revision:'r'+seen.length}},()=>{},60000);
 queue.edit('x',{body:'first',revision:'r0'},'s');const pending=queue.flush('x');queue.edit('x',{body:'latest',revision:'r0'},'s');release();await pending;clearTimeout(queue.entry('x').timer);
 assert.equal(seen.length,2);assert.equal(seen[1][1].expected_revision,'r1');assert.equal(queue.entry('x').value.body,'latest');assert.equal(queue.entry('x').state,'saved');
});
test('failed save preserves modifications and explicit retry succeeds',async()=>{
 let fail=true;const queue=new ChannelAutosave(async(k,d)=>{if(fail)throw Error('offline');return {...d,revision:'r1'}},()=>{},60000);queue.edit('x',{body:'keep',revision:'r0'},'s');await assert.rejects(queue.flush('x'));assert.equal(queue.entry('x').value.body,'keep');assert.equal(queue.entry('x').state,'error');fail=false;await queue.flush('x');assert.equal(queue.entry('x').state,'saved');
});
