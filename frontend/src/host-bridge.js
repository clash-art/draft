// Only documented, feature-detected host APIs are used. No localhost-to-session IPC.
export function compatibilityHost(scope){
 const bridge=scope?.openai;
 if(typeof bridge?.sendFollowUpMessage!=='function')return {};
 return {sendToAgent:async text=>{
  const result=await bridge.sendFollowUpMessage({prompt:text});
  if(result?.isError)throw Error('宿主未接受请求，请重试');
 }};
}
export function mcpHost(app,scope={}){
 const compatibility=compatibilityHost(scope);
 const native=!!app?.getHostCapabilities()?.message;
 if(!native&&!compatibility.sendToAgent)return {native:true};
 return {native:true,sendToAgent:async text=>{
  if(native){
   // An ambiguous transport failure can mean the host already accepted the message.
   // Do not send it twice; only an explicit rejection permits compatibility fallback.
   const result=await app.sendMessage({role:'user',content:[{type:'text',text}]});
   if(!result?.isError)return;
   if(!compatibility.sendToAgent)throw Error('宿主未接受请求，请重试');
  }
  await compatibility.sendToAgent(text);
 }};
}
export async function callHostTool(app,scope,name,args){
 const result=typeof scope?.openai?.callTool==='function'
  ?await scope.openai.callTool(name,args)
  :app?await app.callServerTool({name,arguments:args})
  :(()=>{throw Error('宿主工具连接尚未建立')})();
 return toolData(result);
}
export function toolData(result){
 if(result.isError)throw Error(result.content?.find(c=>c.type==='text')?.text||'操作失败');
 return result.structuredContent??JSON.parse(result.content.find(c=>c.type==='text').text);
}

export async function requestWorkbenchDisplay(app,scope={}){
 const context=app?.getHostContext()||{};
 const bridge=scope.openai;
 const result={availableModes:context.availableDisplayModes||[],requestedMode:null,actualMode:bridge?.displayMode||context.displayMode||'unknown'};
 if(result.actualMode==='fullscreen')return result;
 if(typeof bridge?.requestDisplayMode==='function'){
  result.requestedMode='fullscreen';
  try{
   const response=await bridge.requestDisplayMode({mode:'fullscreen'});
   result.actualMode=response?.mode||bridge.displayMode||result.actualMode;
   if(result.actualMode==='fullscreen')return result;
  }catch(error){result.error=error.message}
 }
 if(typeof app?.requestDisplayMode!=='function')return result;
 if(result.availableModes.length&&!result.availableModes.includes('fullscreen'))return result;
 result.requestedMode='fullscreen';
 try{result.actualMode=(await app.requestDisplayMode({mode:'fullscreen'},{timeout:5000})).mode;delete result.error}
 catch(error){result.error=error.message}
 return result;
}
