const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/journal-book.js'), 'utf8');
const list = source.match(/const pageImages = \[([\s\S]*?)\];/);
if (!list) throw new Error('Journal page list not found');

const pages = {};
for (const [, name] of list[1].matchAll(/'([^']+\.png)'/g)) {
  const image = fs.readFileSync(path.join(root, name));
  pages[name] = `data:image/png;base64,${image.toString('base64')}`;
}

fs.writeFileSync(
  path.join(root, 'js/journal-local-pages.js'),
  `window.JOURNAL_LOCAL_PAGES = ${JSON.stringify(pages)};\n`
);
