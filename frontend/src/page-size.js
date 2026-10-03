export const PAGE_SIZES={'3:4':{width:360,height:480},'3:5':{width:360,height:600},'1:1':{width:360,height:360},'9:16':{width:360,height:640}};
export const PAGE_SIZE_OPTIONS=Object.entries(PAGE_SIZES).map(([value,s])=>({value,label:`${value} · ${s.width*3} × ${s.height*3}`}));
export function pageSize(template){return PAGE_SIZES[template?.page_ratio]||PAGE_SIZES['3:4']}
