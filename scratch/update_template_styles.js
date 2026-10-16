const fs = require('fs');
const JSZip = require('jszip');

async function testFixAndInspect() {
    const templatePath = 'assets/Annex 5-TES New Form 3.xlsx';
    const data = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(data);

    let stylesXml = await zip.file('xl/styles.xml').async('string');

    // Make sure Style 5 has vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1")\/>/g,
        '$1 applyAlignment="1"><alignment vertical="center"/></xf>'
    );

    // Make sure Style 16 has horizontal="center" vertical="center" wrapText="1"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="2"[^>]*fillId="2"[^>]*borderId="1"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center" wrapText="1"/>'
    );

    // Make sure Style 14 has horizontal="center" vertical="center" wrapText="1"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="1"[^>]*fillId="0"[^>]*borderId="1"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center" wrapText="1"/>'
    );

    // Make sure Style 9 has vertical="center"
    if (!stylesXml.includes('<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>')) {
        stylesXml = stylesXml.replace(
            /(<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1")(\/>| applyAlignment="1"><alignment[^>]*\/><\/xf>)/,
            '$1 applyAlignment="1"><alignment vertical="center"/></xf>'
        );
    }

    zip.file('xl/styles.xml', stylesXml);

    const outBuf = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(templatePath, outBuf);
    console.log('Template styles verified and updated.');
}

testFixAndInspect().catch(console.error);
