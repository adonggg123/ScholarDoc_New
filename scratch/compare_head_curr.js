const fs = require('fs');
const { execSync } = require('child_process');
const JSZip = require('jszip');

async function checkGitHead() {
    const headBuf = execSync('git show HEAD:"assets/Annex 5-TES New Form 3.xlsx"', { maxBuffer: 10 * 1024 * 1024 });
    const currBuf = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');

    const zipHead = await JSZip.loadAsync(headBuf);
    const zipCurr = await JSZip.loadAsync(currBuf);

    const sheetHead = await zipHead.file('xl/worksheets/sheet1.xml').async('string');
    const sheetCurr = await zipCurr.file('xl/worksheets/sheet1.xml').async('string');

    console.log('HEAD Row 8:', (sheetHead.match(/<row r="8"[^>]*>.*?<\/row>/s) || [])[0]);
    console.log('CURR Row 8:', (sheetCurr.match(/<row r="8"[^>]*>.*?<\/row>/s) || [])[0]);

    console.log('\nHEAD Row 9:', (sheetHead.match(/<row r="9"[^>]*>.*?<\/row>/s) || [])[0]);
    console.log('CURR Row 9:', (sheetCurr.match(/<row r="9"[^>]*>.*?<\/row>/s) || [])[0]);

    console.log('\nDifferences in sheet1.xml:');
    if (sheetHead === sheetCurr) {
        console.log('sheet1.xml is IDENTICAL between HEAD and working tree!');
    } else {
        console.log('sheet1.xml is DIFFERENT!');
        console.log('Length HEAD:', sheetHead.length, 'Length CURR:', sheetCurr.length);
    }
}

checkGitHead().catch(console.error);
