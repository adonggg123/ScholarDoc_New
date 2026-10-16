const fs = require('fs');
const JSZip = require('jszip');

async function checkForm2LogoPositions() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const zip = await JSZip.loadAsync(data);
    const drawing1 = await zip.file('xl/drawings/drawing1.xml').async('string');
    const rels = await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');

    console.log('--- drawing1.xml.rels ---');
    console.log(rels);

    console.log('--- drawing1.xml anchors ---');
    const anchors = drawing1.match(/<xdr:oneCellAnchor>.*?<\/xdr:oneCellAnchor>/gs) || [];
    anchors.forEach((a, i) => {
        const fromCol = (a.match(/<xdr:col>(\d+)<\/xdr:col>/) || [])[1];
        const fromRow = (a.match(/<xdr:row>(\d+)<\/xdr:row>/) || [])[1];
        const colOff = (a.match(/<xdr:colOff>(\d+)<\/xdr:colOff>/) || [])[1];
        const rowOff = (a.match(/<xdr:rowOff>(\d+)<\/xdr:rowOff>/) || [])[1];
        const ext = a.match(/<xdr:ext\s+cx="([^"]+)"\s+cy="([^"]+)"/);
        const pic = a.match(/<xdr:cNvPr[^>]*name="([^"]+)"/);
        const embed = a.match(/r:embed="([^"]+)"/);
        console.log(`Image ${i + 1}: name="${pic ? pic[1] : ''}", embed="${embed ? embed[1] : ''}"`);
        console.log(`  from: col=${fromCol} (0-indexed, so col 0=A, 1=B, 2=C, 3=D, 4=E, 5=F, 11=L), row=${fromRow} (0-indexed, so row 2=row 3), colOff=${colOff}, rowOff=${rowOff}`);
        console.log(`  size: cx=${ext ? ext[1] : ''}, cy=${ext ? ext[2] : ''}`);
    });
}

checkForm2LogoPositions().catch(console.error);
