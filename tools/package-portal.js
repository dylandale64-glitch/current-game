/* Builds the exact zip a web portal wants: index.html at the root of the
   archive, relative paths only, nothing else in the bundle. */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
execSync('node ' + path.join(root, 'tools', 'build.js'), { stdio: 'inherit' });
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, 'current-web.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execSync('cd "' + root + '" && zip -q -j "' + zip + '" index.html');
const bytes = fs.statSync(zip).size;
const html = fs.statSync(path.join(root, 'index.html')).size;
console.log('current-web.zip  ' + (bytes/1024).toFixed(1) + ' KB  (index.html ' + (html/1024).toFixed(1) + ' KB)');
console.log('files in archive:');
console.log(execSync('unzip -l "' + zip + '"').toString().split('\n').slice(2, -4).join('\n'));
