const fs = require('fs');
const JSZip = require('jszip');

async function checkCHEDCols() {
    const data = fs.readFileSync('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    const zip = await JSZip.loadAsync(data);
    const sheet3Xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const cols = sheet3Xml.match(/<cols>.*?<\/cols>/s);
    console.log('CHED Sheet 3 cols:', cols ? cols[0] : 'None');
}

checkCHEDCols().catch(console.error);
