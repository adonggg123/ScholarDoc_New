const fs = require('fs');

const files = ['login.html', 'superadmin_web/login.html', 'admin_web/login.html'];
for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/style\.css(\?v=\d+)?/g, 'style.css?v=15');
    content = content.replace(/src="app\.js(\?v=\d+)?"/g, 'src="app.js?v=2"');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Bumped cache query on ${file}`);
}

