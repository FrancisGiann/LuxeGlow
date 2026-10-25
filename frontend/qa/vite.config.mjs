import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('./fixture.js', import.meta.url));
const api = fileURLToPath(new URL('./api.js', import.meta.url));
export default defineConfig({
  plugins: [{name:'synthetic-only-modules',enforce:'pre',resolveId(source){
    const path=source.replace(/\.(jsx?|tsx?)$/,'');
    if(['/api/admin','/api/endpoints'].some((suffix)=>path.endsWith(suffix)))return api;
    if(['/context/AuthContext','/context/DashboardContext','/hooks/useStaffNotifications','/lib/supabase'].some((suffix)=>path.endsWith(suffix)))return fixture;
  }},react(),tailwindcss()],
  server:{host:'127.0.0.1',port:5189,strictPort:true,ws:false,hmr:false,watch:null},
});
