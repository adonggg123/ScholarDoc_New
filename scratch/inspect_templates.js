const fs = require('fs');
const JSZip = require('jszip');

async function inspectDetail(filePath) {
    console.log('\n==================================================');
    console.log('=== Inspecting:', filePath);
    console.log('==================================================');
    if (!fs.existsSync(filePath)) return;

    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    let sharedStrings = [];
    if (zip.file('xl/sharedStrings.xml')) {
        const sst = await zip.file('xl/sharedStrings.xml').async('string');
        const siMatches = sst.match(/<si>(.*?)<\/si>/gs) || [];
        sharedStrings = siMatches.map(si => {
            const tMatches = si.match(/<t[^>]*>(.*?)<\/t>/gs) || [];
            return tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
        });
    }

    const wbXml = await zip.file('xl/workbook.xml').async('string');
    const sheetTags = wbXml.match(/<sheet\s+[^>]+>/g) || [];
    console.log('Sheets:', sheetTags);

    // Read all sheets
    for (const sTag of sheetTags) {
        const nameMatch = sTag.match(/name="([^"]+)"/);
        const rIdMatch = sTag.match(/r:id="([^"]+)"/);
        const sName = nameMatch ? nameMatch[1] : '';
        const rId = rIdMatch ? rIdMatch[1] : '';

        // find target xml in xl/_rels/workbook.xml.rels
        const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
        const relMatch = new RegExp(`Id="${rId}"[^>]+Target="([^"]+)"`).exec(relsXml);
        const targetPath = relMatch ? ('xl/' + relMatch[1]).replace('xl/xl/', 'xl/') : '';
        
        console.log(`\nSheet: "${sName}" -> ${targetPath}`);
        if (!zip.file(targetPath)) continue;

        const sheetXml = await zip.file(targetPath).async('string');
        const mergeMatches = sheetXml.match(/<mergeCell\s+ref="([^"]+)"\/>/g) || [];
        console.log('MergeCells in top 20 rows:');
        mergeMatches.filter(m => {
            const ref = m.match(/ref="([^"]+)"/)[1];
            const rows = ref.match(/\d+/g) || [];
            return rows.some(r => parseInt(r, 10) <= 20);
        }).forEach(m => console.log('  ', m));

        const rowRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
        let match;
        console.log('\nRows 1 to 15:');
        while ((match = rowRegex.exec(sheetXml)) !== null) {
            const rNum = parseInt(match[1], 10);
            if (rNum <= 15) {
                const rowAttrs = match[2];
                const rowContent = match[3];
                const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
                let cMatch;
                const cells = [];
                while ((cMatch = cRegex.exec(rowContent)) !== null) {
                    const cellRef = cMatch[1];
                    const s = cMatch[2];
                    const type = cMatch[3];
                    let val = cMatch[4];
                    if (type === 's' && val !== undefined) {
                        val = `"${sharedStrings[parseInt(val, 10)] || ''}"`;
                    }
                    cells.push(`${cellRef}(s=${s}):${val}`);
                }
                console.log(`  Row ${rNum} (attrs: ${rowAttrs}):\n    ${cells.join(', ')}`);
            }
        }
    }
}

async function main() {
    await inspectDetail('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    await inspectDetail('assets/Annex 5-TES New Form 2.xlsx');
    await inspectDetail('assets/Annex 5-TES New Form 3.xlsx');
}
main().catch(console.error);
