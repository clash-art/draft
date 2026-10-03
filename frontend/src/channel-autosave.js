// A queue per content/channel survives tab switches and serializes revision writes.
export class ChannelAutosave {
 constructor(send,onChange=()=>{},delay=700){this.send=send;this.onChange=onChange;this.delay=delay;this.entries=new Map()}
 entry(key){return this.entries.get(key)}
 edit(key,value,sourceRevision){let e=this.entries.get(key);if(!e){e={value,version:0,saved:0,revision:value.revision,state:'idle'};this.entries.set(key,e)}if(e.saved===e.version&&!e.running)e.revision=value.revision;e.value=value;e.sourceRevision=sourceRevision;e.version++;e.state='pending';e.error=null;clearTimeout(e.timer);e.timer=setTimeout(()=>{this.flush(key).catch(()=>{})},this.delay);this.onChange(key);}
 async flush(key){const e=this.entries.get(key);if(!e)return null;clearTimeout(e.timer);if(e.running){await e.running;if(e.saved<e.version)return this.flush(key);return e.value}
 const run=async()=>{while(e.saved<e.version){const version=e.version,snapshot=e.value;e.state='saving';this.onChange(key);try{const saved=await this.send(key,{...snapshot,source_revision:e.sourceRevision,expected_revision:e.revision});e.revision=saved.revision;e.saved=version;e.value=e.version===version?saved:{...e.value,revision:saved.revision};e.state=e.saved===e.version?'saved':'pending';e.error=null;this.onChange(key)}catch(error){e.state='error';e.error=error.message;this.onChange(key);throw error}}return e.value};
 e.running=run();try{return await e.running}finally{e.running=null}
 }
}
