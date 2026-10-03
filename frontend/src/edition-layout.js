// Only fields that determine page pixels. Canonical keys ignore response key order.
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value}
export function layoutSignature(edition){return JSON.stringify(canonical({title:edition?.title||'',body:edition?.body||'',template:edition?.template||{}}))}
export function assertCurrentPages(edition,signature,pages){if(!pages.length||layoutSignature(edition)!==signature)throw Error('排版已更新，请等待最新分页完成后再导出');return pages}
