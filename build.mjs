import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['tszm.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/tszm',
  minify: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node'
  },
  external: [],
});

console.log('Build complete!');
