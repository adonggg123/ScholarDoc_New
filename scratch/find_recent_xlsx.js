const fs = require('fs');
const path = require('path');

function findRecentXlsx(dir) {
    try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
            if (f.includes('AutoFilled') || f.includes('Annex 5') || f.includes('Form 3') || f.includes('Form_3')) {
                const fullPath = path.join(dir, f);
                try {
                    const stat = fs.statSync(fullPath);
                    console.log(`${fullPath} -> modified: ${stat.mtime}`);
                } catch(e) {}
            }
        }
    } catch (e) {}
}

findRecentXlsx('c:\\Users\\judej\\ScholarDoc\\scratch');
findRecentXlsx('c:\\Users\\judej\\Downloads');
