const fs = require('fs');
const JSZip = require('jszip');

async function checkRows(filePath, sheetName) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    let sharedStrings = [];
    if (zip.file('xl/sharedStrings.xml')) {
        const sstXml = await zip.file('xl/sharedStrings.xml').async('string');
        sharedStrings = (sstXml.match(/<si>(.*?)<\/si>/gs) || []).map(si => {
            return (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
        });
    }

    let targetXml = 'xl/worksheets/sheet1.xml';
    if (sheetName) {
        const wbXml = await zip.file('xl/workbook.xml').async('string');
        const sTag = wbXml.match(new RegExp('<sheet[^>]+name="' + sheetName + '"[^>]*>'));
        const rId = sTag[0].match(/r:id="([^"]+)"/)[1];
        const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
        const relMatch = new RegExp('Id="' + rId + '"[^>]+Target="([^"]+)"').exec(relsXml);
        targetXml = ('xl/' + relMatch[1]).replace('xl/xl/', 'xl/');
    }

    const sheetXml = await zip.file(targetXml).async('string');
    console.log(`\n=== ${filePath} (${targetXml}) ===`);
    const rowMatches = sheetXml.match(/<row\s+r="([1-9]|1[0-5])"[^>]*>.*?<\/row>/gs) || [];
    for (const r of rowMatches) {
        // replace shared strings
        const decoded = r.replace(/<c\s+r="([^"]+)"(?:\s+s="([^"]*)")?(?:\s+t="s")?>\s*<v>(\d+)<\/v>\s*<\/c>/g, (m, cr, s, idx) => {
            return `<c r="${cr}" s="${s}" t="s"><v>${sharedStrings[parseInt(idx, 10)]}</v></c>`;
        });
        console.log(decoded);
    }
}

async function run() {
    await checkRows('assets/0_Annex_5_TES_New_Billing_Form.xlsx', 'Annex 5-TES New Form 2');
    await checkRows('assets/0_Annex_5_TES_New_Billing_Form.xlsx', 'Annex 5-TES New Form 3');
    await checkRows('assets/Annex 5-TES New Form 2.xlsx');
    await checkRows('assets/Annex 5-TES New Form 3.xlsx');
}
run().catch(console.error);
