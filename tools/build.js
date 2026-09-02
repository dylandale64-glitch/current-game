// src/game.html is the canonical source. It is written in Artifact format:
// no <!doctype>, <html>, <head> or <body> of its own, because the Artifact
// host supplies that skeleton at publish time.
// This wraps it into a standalone document for local play and GitHub Pages.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const body = fs.readFileSync(path.join(root, 'src', 'game.html'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0A0C0D">
<style>html,body{margin:0;background:#0A0C0D}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('built index.html  (' + html.length + ' bytes)');
