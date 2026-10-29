// Compila la extensión con esbuild -> dist/ (cargable en chrome://extensions)
import { build, context } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const options = {
  entryPoints: { sidepanel: 'src/sidepanel/main.tsx', background: 'src/background.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'chrome114',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Observando cambios… (recarga la extensión en chrome://extensions)');
} else {
  await build(options);
}
