import * as esbuild from 'esbuild';
import { chmodSync } from 'fs';

const outfile = 'dist/tszm';

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

chmodSync(outfile, 0o755); // equivalent to `chmod +x dist/tszm`
console.log(`Build complete: ${outfile} is now executable.`);
