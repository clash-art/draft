// Dev-only page for rendering longform pages against a local workbench backend.
// Not part of `build` or `build:app`; driven by scripts/render_xhs_pages.py.
import {defineConfig} from 'vite';
const backend=process.env.XHS_BACKEND||'http://127.0.0.1:8765',token=process.env.XHS_TOKEN||'';
export default defineConfig({
 server:{strictPort:true,proxy:{'/api':{target:backend,changeOrigin:true,configure:proxy=>proxy.on('proxyReq',req=>{req.removeHeader('origin');req.setHeader('X-Config-Token',token)})}}},
});
