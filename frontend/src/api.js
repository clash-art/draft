// The native MCP App imports this module but uses its host transport.
// Sandboxed MCP frames may have no storage access: never touch it on import.
function httpAuth(){
 const fragment=location.hash.slice(1);
 let saved='';
 try{if(fragment)sessionStorage.setItem('wechat-config-token',fragment);saved=sessionStorage.getItem('wechat-config-token')||''}catch{if(!fragment)throw Error('浏览器无法读取本机工作台凭据，请从配置入口重新打开')}
 if(fragment)history.replaceState(null,'',location.pathname+location.search);
 return fragment||saved;
}
let hostTransport;
export function setHostTransport(transport){hostTransport=transport}
export async function api(path,body){if(hostTransport)return hostTransport(path,body);let r;try{r=await fetch(path,{method:body?'POST':'GET',headers:{'X-Config-Token':httpAuth(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})}catch{throw Error('工作台服务连接中断，请确认本机服务已启动，再重试。未保存的编辑仍保留在页面中。')}let data;try{data=await r.json()}catch{throw Error('工作台连接异常，请重新打开页面')}if(!r.ok)throw Error(data.error||'操作未完成');return data}
export function download(name,text,type='text/plain'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export const file64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('文件读取失败'));r.readAsDataURL(file)});
export const dateLabel=value=>value?new Date(typeof value==='number'?value*1000:value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
