import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    // Tailnet access: MagicDNS name + *.ts.net (hostnames only — IP hosts are always allowed)
    allowedHosts: ['omarchy', '.ts.net']
  },
  build: {
    target: 'es2020'
  }
});