const fs = require('fs');
const JSZip = require('jszip');

async function checkFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log('File not found:', filePath);
        return;
    }
    console.log('\n=======================================');
    console.log('Inspecting:', filePath);
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    let sharedStrings = [];
    if (zip.file('xl/sharedStrings.xml')) {
        const sst = await zip.file('xl/sharedStrings.xml').async('string');
        sharedStrings = (sst.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
    }

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const rRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    let m;
    while ((m = rRegex.exec(sheetXml)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum <= 15) {
            console.log(`Row ${rNum} attrs: ${m[2]}`);
        }
    }
}

async function run() {
    await checkFile('scratch/live_tested_form3.xlsx');
    await checkFile('scratch/test_filled_form3.xlsx');
}
run().catch(console.error);
