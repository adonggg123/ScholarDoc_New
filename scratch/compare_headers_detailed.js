const fs = require('fs');
const JSZip = require('jszip');

async function getSheetInfo(filePath) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const sstXml = await zip.file('xl/sharedStrings.xml').async('string');
    const str = (sstXml.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
    const stylesXml = await zip.file('xl/styles.xml').async('string');

    const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
    const xfs = [];
    const re = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g;
    let m;
    while ((m = re.exec(cellXfsMatch[1])) !== null) {
        xfs.push({ attrs: m[1], inner: m[2] || '' });
    }

    const fonts = [];
    const fre = /<font\b[\s\S]*?<\/font>/g;
    while ((m = fre.exec(stylesXml)) !== null) {
        fonts.push(m[0]);
    }

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const mergeCells = (sheetXml.match(/<mergeCell\s+ref="([^"]+)"\/>/g) || []).map(mc => mc.match(/ref="([^"]+)"/)[1]);

    const rows = {};
    const rRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    while ((m = rRegex.exec(sheetXml)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum <= 20) {
            const cells = [];
            const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?(?:<is><t>([^<]*)<\/t><\/is>)?<\/c>/g;
            let cm;
            while ((cm = cRegex.exec(m[3])) !== null) {
                let val = cm[4];
                if (cm[3] === 's') val = str[parseInt(val, 10)];
                else if (cm[5]) val = cm[5];

                const sIdx = parseInt(cm[2] || '0', 10);
                const xf = xfs[sIdx] || { attrs: '', inner: '' };
                const fId = (xf.attrs.match(/fontId="([^"]+)"/) || [])[1];
                const font = fonts[fId] || '';
                const sz = (font.match(/<sz\s+val="([^"]+)"\/>/) || [])[1];
                const bold = font.includes('<b/>');
                const alignMatch = xf.inner.match(/<alignment\s+([^>]*)\/>/);
                const align = alignMatch ? alignMatch[1] : '';

                if (val !== undefined) {
                    cells.push({
                        r: cm[1],
                        val,
                        sz,
                        bold,
                        align
                    });
                }
            }
            rows[rNum] = {
                attrs: m[2],
                cells
            };
        }
    }

    return { rows, mergeCells };
}

async function run() {
    const f2 = await getSheetInfo('assets/Annex 5-TES New Form 2.xlsx');
    const f3 = await getSheetInfo('assets/Annex 5-TES New Form 3.xlsx');

    console.log('=== FORM 2 HEADER (Rows 1-15) ===');
    for (let r = 1; r <= 15; r++) {
        const row = f2.rows[r];
        const mc = f2.mergeCells.filter(m => {
            const [s, e] = m.split(':');
            const rStart = parseInt(s.replace(/\D/g, ''), 10);
            const rEnd = parseInt(e.replace(/\D/g, ''), 10);
            return r >= rStart && r <= rEnd;
        });
        console.log(`Row ${r} (${row ? row.attrs : 'empty'}) [Merges: ${mc.join(', ')}]:`);
        if (row && row.cells.length > 0) {
            row.cells.forEach(c => console.log(`   ${c.r}: "${c.val}" (sz=${c.sz}, bold=${c.bold}, align=[${c.align}])`));
        }
    }

    console.log('\n=== FORM 3 HEADER (Rows 1-15) ===');
    for (let r = 1; r <= 15; r++) {
        const row = f3.rows[r];
        const mc = f3.mergeCells.filter(m => {
            const [s, e] = m.split(':');
            const rStart = parseInt(s.replace(/\D/g, ''), 10);
            const rEnd = parseInt(e.replace(/\D/g, ''), 10);
            return r >= rStart && r <= rEnd;
        });
        console.log(`Row ${r} (${row ? row.attrs : 'empty'}) [Merges: ${mc.join(', ')}]:`);
        if (row && row.cells.length > 0) {
            row.cells.forEach(c => console.log(`   ${c.r}: "${c.val}" (sz=${c.sz}, bold=${c.bold}, align=[${c.align}])`));
        }
    }
}

run().catch(console.error);
