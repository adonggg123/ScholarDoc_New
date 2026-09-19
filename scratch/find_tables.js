const fs = require('fs');
const path = require('path');

const tables = new Set();
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.dart_tool', 'build', '.idea', '.vscode'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (/\.(js|dart|sql|ts)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const regex = /\.from\(['"]([a-zA-Z0-9_\-]+)['"]\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        tables.add(match[1]);
      }
    }
  }
}
scan('.');
console.log('Tables found:', JSON.stringify(Array.from(tables).sort(), null, 2));
