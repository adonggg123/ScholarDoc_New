const fs = require('fs');
const JSZip = require('jszip');

async function extractImages() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const zip = await JSZip.loadAsync(data);

    const img1 = await zip.file('xl/media/image1.png').async('nodebuffer');
    const img2 = await zip.file('xl/media/image2.png').async('nodebuffer');

    fs.writeFileSync('scratch/img1.png', img1);
    fs.writeFileSync('scratch/img2.png', img2);

    console.log('image1.png size:', img1.length);
    console.log('image2.png size:', img2.length);
}

extractImages().catch(console.error);
