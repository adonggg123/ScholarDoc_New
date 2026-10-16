const fs = require('fs');
const JSZip = require('jszip');

async function testLogo() {
    const zip = await JSZip.loadAsync(fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx'));
    
    // 1. Add images
    const img1 = fs.readFileSync('scratch/img1.png');
    const img2 = fs.readFileSync('scratch/img2.png');
    zip.file('xl/media/image1.png', img1);
    zip.file('xl/media/image2.png', img2);

    // 2. Add drawing1.xml.rels
    const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>
</Relationships>`;
    zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);

    // 3. Add drawing1.xml
    const drawing1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>5</xdr:col>
      <xdr:colOff>363220</xdr:colOff>
      <xdr:row>2</xdr:row>
      <xdr:rowOff>165735</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="714375" cy="742950"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="image1.png" title="Image"/>
        <xdr:cNvPicPr preferRelativeResize="0"/>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1" cstate="print"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="4978400" y="737235"/>
          <a:ext cx="714375" cy="742950"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:noFill/>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData fLocksWithSheet="0"/>
  </xdr:oneCellAnchor>
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>9</xdr:col>
      <xdr:colOff>693420</xdr:colOff>
      <xdr:row>2</xdr:row>
      <xdr:rowOff>165735</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="723900" cy="742950"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="3" name="image2.png" title="Image"/>
        <xdr:cNvPicPr preferRelativeResize="0"/>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId2" cstate="print"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="9589770" y="737235"/>
          <a:ext cx="723900" cy="742950"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:noFill/>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData fLocksWithSheet="0"/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;
    zip.file('xl/drawings/drawing1.xml', drawing1);

    // 4. Update xl/worksheets/_rels/sheet1.xml.rels
    let sheetRels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
    if (!sheetRels.includes('Target="../drawings/drawing1.xml"')) {
        sheetRels = sheetRels.replace('</Relationships>', '  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>\n</Relationships>');
        zip.file('xl/worksheets/_rels/sheet1.xml.rels', sheetRels);
    }

    // 5. Update xl/worksheets/sheet1.xml
    let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    if (!sheet1Xml.includes('<drawing r:id="rId3"/>')) {
        sheet1Xml = sheet1Xml.replace('<legacyDrawing r:id="rId1"/>', '<drawing r:id="rId3"/><legacyDrawing r:id="rId1"/>');
        zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
    }

    // 6. Update [Content_Types].xml
    let ct = await zip.file('[Content_Types].xml').async('string');
    if (!ct.includes('Extension="png"')) {
        ct = ct.replace('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/>');
    }
    if (!ct.includes('PartName="/xl/drawings/drawing1.xml"')) {
        ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    }
    zip.file('[Content_Types].xml', ct);

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync('scratch/test_logo_form3.xlsx', buf);
    console.log('Saved scratch/test_logo_form3.xlsx successfully!');
}

testLogo().catch(console.error);
