const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');

esbuild.build({
  entryPoints: [path.join(root, 'js/installation-scene.js')],
  outfile: path.join(root, 'js/installation-embed.bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
  metafile: true,
  plugins: [{
    name: 'local-three',
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({
        path: path.join(root, 'vendor/three-0.160.0/three.module.js')
      }));
      build.onResolve({ filter: /^three\/addons\/controls\/PointerLockControls\.js$/ }, () => ({
        path: path.join(root, 'vendor/three-0.160.0/controls/PointerLockControls.js')
      }));
    }
  }]
}).then(result => {
  const output = Object.values(result.metafile.outputs).find(item => item.entryPoint);
  if (!output || output.imports.length) throw new Error('Installation embed bundle still has external imports.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
