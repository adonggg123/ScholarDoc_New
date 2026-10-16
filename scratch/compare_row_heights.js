const fs = require('fs');
const JSZip = require('jszip');

async function checkRowHeights() {
    const f2 = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const f3 = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');

    const zip2 = await JSZip.loadAsync(f2);
    const zip3 = await JSZip.loadAsync(f3);

    const sheet2 = await zip2.file('xl/worksheets/sheet1.xml').async('string');
    const sheet3 = await zip3.file('xl/worksheets/sheet1.xml').async('string');

    const getHeights = (sheetXml) => {
        const heights = {};
        const rRegex = /<row\s+r="(\d+)"([^>]*)>/g;
        let m;
        while ((m = rRegex.exec(sheetXml)) !== null) {
            const rNum = parseInt(m[1], 10);
            const htMatch = m[2].match(/ht="([^"]+)"/);
            const custom = m[2].includes('customHeight="1"');
            const thickBot = m[2].includes('thickBot="1"');
            heights[rNum] = {
                ht: htMatch ? htMatch[1] : 'default(14.4)',
                custom,
                thickBot,
                attrs: m[2]
            };
        }
        return heights;
    };

    const h2 = getHeights(sheet2);
    const h3 = getHeights(sheet3);

    console.log('Row | Form 2 Height | Form 3 Height');
    console.log('-----------------------------------');
    for (let r = 1; r <= 35; r++) {
        const str2 = h2[r] ? `${h2[r].ht} (custom=${h2[r].custom}, thickBot=${h2[r].thickBot})` : 'none';
        const str3 = h3[r] ? `${h3[r].ht} (custom=${h3[r].custom}, thickBot=${h3[r].thickBot})` : 'none';
        console.log(`R${String(r).padStart(2, ' ')} | ${str2.padEnd(25, ' ')} | ${str3}`);
    }
}

checkRowHeights().catch(console.error);
