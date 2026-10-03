import {test} from 'node:test';
import fs from 'node:fs';
test('native transport can import HTTP helpers in a storage-denied sandbox',async()=>{
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('Sandbox storage denied')}});
 Object.defineProperty(globalThis,'location',{configurable:true,get(){throw Error('Unexpected HTTP location access')}});
 try{
  const source=fs.readFileSync(new URL('../src/api.js',import.meta.url),'utf8');
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 }finally{delete globalThis.sessionStorage;delete globalThis.location}
});
