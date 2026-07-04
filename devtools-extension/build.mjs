import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const outdir = 'dist';
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    injected: 'src/injected.ts',
    content: 'src/content.ts',
    devtools: 'src/devtools.ts',
    background: 'src/background.ts',
    panel: 'src/panel/panel.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir,
});

// Static assets
cpSync('manifest.json', `${outdir}/manifest.json`);
cpSync('src/panel/panel.html', `${outdir}/panel.html`);
cpSync('src/panel/panel.css', `${outdir}/panel.css`);
cpSync('src/devtools.html', `${outdir}/devtools.html`);

console.log('Built extension to', outdir);
