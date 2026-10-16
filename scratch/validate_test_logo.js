const fs = require('fs');
const JSZip = require('jszip');

async function validateZip() {
    const zip = await JSZip.loadAsync(fs.readFileSync('scratch/test_logo_form3.xlsx'));
    console.log('--- Entries in test_logo_form3.xlsx ---');
    for (const name of Object.keys(zip.files)) {
        console.log(name);
    }
    
    // Check [Content_Types].xml
    const ct = await zip.file('[Content_Types].xml').async('string');
    console.log('\n--- [Content_Types].xml ---');
    console.log(ct);
    
    // Check sheet1.xml.rels
    const s1rels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
    console.log('\n--- sheet1.xml.rels ---');
    console.log(s1rels);

    // Check drawing1.xml.rels
    const d1rels = await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
    console.log('\n--- drawing1.xml.rels ---');
    console.log(d1rels);

    // Check drawing1.xml
    const d1 = await zip.file('xl/drawings/drawing1.xml').async('string');
    console.log('\n--- drawing1.xml ---');
    console.log(d1.slice(0, 300));
}

validateZip().catch(console.error);
