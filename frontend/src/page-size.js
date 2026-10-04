export const PAGE_SIZES={'3:4':{width:360,height:480},'3:5':{width:360,height:600},'1:1':{width:360,height:360},'9:16':{width:360,height:640}};
// Xiaohongshu longform page size. 3:5 (1080 × 1800) is the tallest portrait ratio the note viewer shows
// whole; the feed thumbnail crops the first image to 3:4, so covers keep their content in COVER_SAFE.
export const DEFAULT_PAGE_RATIO='3:5';
export const COVER_SAFE=PAGE_SIZES['3:4'];
export const PAGE_SIZE_OPTIONS=Object.entries(PAGE_SIZES).map(([value,s])=>({value,label:`${value} · ${s.width*3} × ${s.height*3}`}));
export function pageRatio(template){return PAGE_SIZES[template?.page_ratio]?template.page_ratio:DEFAULT_PAGE_RATIO}
export function pageSize(template){return PAGE_SIZES[pageRatio(template)]}
