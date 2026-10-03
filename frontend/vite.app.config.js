import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig({plugins:[viteSingleFile()],build:{outDir:'../assets/mcp-app',emptyOutDir:true,rollupOptions:{input:'mcp-app.html'}}});
