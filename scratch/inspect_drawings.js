const fs = require('fs');
const JSZip = require('jszip');

async function inspectDrawings(filePath) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    console.log(`\n========================================`);
    console.log(`Inspecting drawings in: ${filePath}`);

    for (const name of Object.keys(zip.files)) {
        if (name.includes('drawing') && name.endsWith('.xml')) {
            console.log(`--- ${name} ---`);
            const content = await zip.file(name).async('string');
            console.log(content.slice(0, 1000));
        }
        if (name.includes('drawing') && name.endsWith('.rels')) {
            console.log(`--- ${name} ---`);
            const content = await zip.file(name).async('string');
            console.log(content);
        }
        if (name.startsWith('xl/worksheets/_rels/')) {
            console.log(`--- ${name} ---`);
            const content = await zip.file(name).async('string');
            console.log(content);
        }
    }
}

(async () => {
    await inspectDrawings('assets/Annex 5-TES New Form 2.xlsx');
    await inspectDrawings('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
})();
