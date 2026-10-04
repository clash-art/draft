export const PAGE_SIZES={'3:4':{width:360,height:480},'3:5':{width:360,height:600},'1:1':{width:360,height:360},'9:16':{width:360,height:640}};
// Xiaohongshu longform layout is 360 CSS px wide; notes display full-width at EXPORT_WIDTH (1440 × 2400 for 3:5).
// 3:5 is the tallest portrait ratio the note viewer shows whole; the feed thumbnail crops the first image to 3:4,
// so covers keep their content in COVER_SAFE (1440 × 1920 export).
export const EXPORT_WIDTH=1440;
export const CSS_PAGE_WIDTH=360;
export const DEFAULT_PAGE_RATIO='3:5';
export const COVER_SAFE=PAGE_SIZES['3:4'];
export function exportPixelRatio(){return EXPORT_WIDTH/CSS_PAGE_WIDTH}
export function exportSize(ratio=DEFAULT_PAGE_RATIO){const key=PAGE_SIZES[ratio]?ratio:DEFAULT_PAGE_RATIO,s=PAGE_SIZES[key],k=exportPixelRatio();return {width:Math.round(s.width*k),height:Math.round(s.height*k)}}
export const PAGE_SIZE_OPTIONS=Object.entries(PAGE_SIZES).map(([value,s])=>{const k=exportPixelRatio();return {value,label:`${value} · ${s.width*k} × ${s.height*k}`}});
export function pageRatio(template){return PAGE_SIZES[template?.page_ratio]?template.page_ratio:DEFAULT_PAGE_RATIO}
export function pageSize(template){return PAGE_SIZES[pageRatio(template)]}
