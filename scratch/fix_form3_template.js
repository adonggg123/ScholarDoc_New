const fs = require('fs');
const JSZip = require('jszip');

async function fixForm3Template() {
    const templatePath = 'assets/Annex 5-TES New Form 3.xlsx';
    const data = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(data);

    // 1. Update styles.xml
    let stylesXml = await zip.file('xl/styles.xml').async('string');

    // Ensure style 36 (Title B8 & J2) has horizontal="center" vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="8"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center"/>'
    );

    // Ensure style 35 (Subtitle B9) has horizontal="center" vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="7"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center"/>'
    );

    // Ensure style 39 (Republic of the Philippines) has horizontal="center" vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="2"[^>]*fillId="2"[^>]*borderId="0"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center"/>'
    );

    // Ensure style 38 (HEI Name) has horizontal="center" vertical="center" wrapText="1"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="10"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center" wrapText="1"/>'
    );

    // Ensure style 37 (Address) has horizontal="center" vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="9"[^>]*fillId="2"[^>]*borderId="0"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center"/>'
    );

    // Ensure style 34 (Date) has horizontal="right" vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="6"[^>]*borderId="2"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="right" vertical="center"/>'
    );

    // Ensure style 14 (Status) has horizontal="center" vertical="center" wrapText="1"
    stylesXml = stylesXml.replace(
        /(<xf\b[^>]*fontId="1"[^>]*fillId="0"[^>]*borderId="1"[^>]*>)\s*<alignment[^>]*\/>/g,
        '$1<alignment horizontal="center" vertical="center" wrapText="1"/>'
    );

    // Ensure style 9 (Student cells left-aligned) has vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1")\/>/,
        '$1 applyAlignment="1"><alignment vertical="center"/></xf>'
    );

    // Ensure style 7 (Instructions B12) has vertical="center"
    stylesXml = stylesXml.replace(
        /(<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1")\/>/,
        '$1 applyAlignment="1"><alignment vertical="center"/></xf>'
    );

    zip.file('xl/styles.xml', stylesXml);

    // 2. Update sheet1.xml
    let sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');

    // Replace <cols>...</cols> with clean, full column widths
    const newCols = `<cols>` +
        `<col min="1" max="1" width="3" customWidth="1"/>` +
        `<col min="2" max="2" width="11" customWidth="1"/>` +
        `<col min="3" max="3" width="14" customWidth="1"/>` +
        `<col min="4" max="4" width="16" customWidth="1"/>` +
        `<col min="5" max="5" width="22" customWidth="1"/>` +
        `<col min="6" max="6" width="32" customWidth="1"/>` +
        `<col min="7" max="7" width="10" customWidth="1"/>` +
        `<col min="8" max="8" width="10" customWidth="1"/>` +
        `<col min="9" max="9" width="13" customWidth="1"/>` +
        `<col min="10" max="10" width="28.5" customWidth="1"/>` +
        `<col min="11" max="11" width="10" customWidth="1"/>` +
        `<col min="12" max="12" width="22.5" customWidth="1"/>` +
        `<col min="13" max="13" width="28" customWidth="1"/>` +
        `</cols>`;
    if (sheetXml.includes('<cols>')) {
        sheetXml = sheetXml.replace(/<cols>.*?<\/cols>/s, newCols);
    } else {
        sheetXml = sheetXml.replace('<sheetData>', `${newCols}<sheetData>`);
    }

    // Helper to update row attributes
    function updateRowAttr(xml, rowNum, newAttrs) {
        const re = new RegExp(`<row\\s+r="${rowNum}"([^>]*)>`, 'g');
        return xml.replace(re, (match, oldAttrs) => {
            // retain spans if present
            const spansMatch = oldAttrs.match(/spans="[^"]*"/);
            const spans = spansMatch ? ` ${spansMatch[0]}` : ' spans="1:27"';
            return `<row r="${rowNum}"${spans} ${newAttrs}>`;
        });
    }

    // Header row heights:
    sheetXml = updateRowAttr(sheetXml, 1, 'ht="25.2" customHeight="1" thickBot="1"');
    sheetXml = updateRowAttr(sheetXml, 2, 'ht="20" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 3, 'ht="20" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 4, 'ht="15" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 5, 'ht="15" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 6, 'ht="15" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 7, 'ht="15.6" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 8, 'ht="48" customHeight="1"'); // The critical header fix: 48pt height!
    sheetXml = updateRowAttr(sheetXml, 9, 'ht="18" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 10, 'ht="15.6" customHeight="1"');
    sheetXml = updateRowAttr(sheetXml, 11, 'ht="16.2" customHeight="1" thickBot="1"');
    sheetXml = updateRowAttr(sheetXml, 12, 'ht="15" customHeight="1"');

    // Uniform student row heights in template (rows 34-39)
    for (let r = 34; r <= 39; r++) {
        sheetXml = updateRowAttr(sheetXml, r, 'ht="15.75" customHeight="1" thickBot="1"');
    }

    zip.file('xl/worksheets/sheet1.xml', sheetXml);

    const outBuf = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(templatePath, outBuf);
    console.log('Successfully updated assets/Annex 5-TES New Form 3.xlsx!');
}

fixForm3Template().catch(console.error);
