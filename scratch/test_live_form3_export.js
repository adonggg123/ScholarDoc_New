const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// Load BillingService logic and strip 'export '
let billingServiceCode = fs.readFileSync('admin_web/js/services/billing_service.js', 'utf8');
billingServiceCode = billingServiceCode.replace(/^export\s+/gm, '');

const evalFn = new Function('JSZip', 'DOMParser', 'XMLSerializer', billingServiceCode + '\nreturn BillingService;');
const BillingService = evalFn(JSZip, DOMParser, XMLSerializer);

async function runTest() {
    console.log('Loading template assets/Annex 5-TES New Form 3.xlsx ...');
    const templateBytes = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');

    const students = [
        {
            lastName: 'BIKOY', firstName: 'ERIKA', middleName: '', gender: 'M',
            birthdate: '01/01/2000', course: 'BSIT', year: '1', status: 'Not enrolled',
            remarks: 'Categorized: Not enrolled', studentId: 'N/A', saNumber: 'N/A'
        },
        {
            lastName: 'ABAD', firstName: 'ALTHEA ROSE', middleName: 'M', gender: 'F',
            birthdate: '01/01/2000', course: 'BSIT', year: '1', status: 'Not enrolled',
            remarks: 'Categorized: Not enrolled', studentId: 'N/A', saNumber: 'N/A'
        },
        {
            lastName: 'ALONZO', firstName: 'MARK JOSEPH', middleName: 'T', gender: 'M',
            birthdate: '01/01/2000', course: 'BSIT', year: '1', status: 'Not enrolled',
            remarks: 'Categorized: Not enrolled', studentId: 'N/A', saNumber: 'N/A'
        },
        {
            lastName: 'BALINGIT', firstName: 'PRINCESS MAE', middleName: 'I', gender: 'F',
            birthdate: '01/01/2000', course: 'BSIT', year: '1', status: 'Not enrolled',
            remarks: 'Categorized: Not enrolled', studentId: 'N/A', saNumber: 'N/A'
        },
        {
            lastName: 'CABALLERO', firstName: 'JOHN CARLO', middleName: 'R', gender: 'M',
            birthdate: '01/01/2000', course: 'BSIT', year: '1', status: 'Not enrolled',
            remarks: 'Categorized: Not enrolled', studentId: 'N/A', saNumber: 'N/A'
        },
        {
            lastName: 'DELA CRUZ', firstName: 'JUAN', middleName: 'A', gender: 'M',
            birthdate: '05/12/2001', course: 'BSIT', year: '2', status: 'On Leave of Absence (LOA)',
            remarks: 'On approved Leave of Absence', studentId: '2022-00123', saNumber: 'SA-2022-123'
        },
        {
            lastName: 'SANTOS', firstName: 'MARIA', middleName: 'B', gender: 'F',
            birthdate: '08/23/2002', course: 'BSCS', year: '3', status: 'Dropped',
            remarks: 'Categorized: Dropped', studentId: '2021-00456', saNumber: 'SA-2021-456'
        },
        {
            lastName: 'REYES', firstName: 'CARLOS', middleName: 'C', gender: 'M',
            birthdate: '11/04/2000', course: 'BSIT', year: '4', status: 'Graduated',
            remarks: 'Categorized: Graduated', studentId: '2020-00789', saNumber: 'SA-2020-789'
        }
    ];

    console.log(`Exporting Form 3 with ${students.length} students ...`);
    const zip = await JSZip.loadAsync(templateBytes);
    let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
    sheet1Xml = BillingService._injectForm3Rows(sheet1Xml, students);
    zip.file('xl/worksheets/sheet1.xml', sheet1Xml);

    const outBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const outPath = 'scratch/live_tested_form3.xlsx';
    fs.writeFileSync(outPath, outBuf);
    console.log(`Saved output to ${outPath} (${outBuf.length} bytes).`);
}

runTest().catch(console.error);
