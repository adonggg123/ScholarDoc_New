const fs = require('fs');
const JSZip = require('jszip');

async function printBillingDrawings() {
    const data = fs.readFileSync('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    const zip = await JSZip.loadAsync(data);
    console.log('--- drawing1.xml ---');
    console.log(await zip.file('xl/drawings/drawing1.xml').async('string'));
    console.log('--- drawing2.xml ---');
    console.log(await zip.file('xl/drawings/drawing2.xml').async('string'));
}

printBillingDrawings().catch(console.error);
