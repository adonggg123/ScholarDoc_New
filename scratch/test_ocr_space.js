const https = require('https');
const fs = require('fs');

async function testHelloworld() {
  const sampleImagePath = 'assets/610fa119-da65-4d5d-bd6e-ed56bbcd1dc7.jpg';
  const base64Image = fs.readFileSync(sampleImagePath).toString('base64');
  
  const postData = new URLSearchParams({
    apikey: 'helloworld',
    language: 'eng',
    isOverlayRequired: 'false',
    OCREngine: '2', // OCR Engine 2 is especially optimized for numbers, receipts, and small font text
    base64Image: 'data:image/jpeg;base64,' + base64Image
  }).toString();

  const req = https.request({
    hostname: 'api.ocr.space',
    path: '/parse/image',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Engine 2 parsed text:');
        console.log(json.ParsedResults?.[0]?.ParsedText);
      } catch (e) {
        console.log('Error:', data);
      }
    });
  });

  req.on('error', (err) => console.error('Error:', err.message));
  req.write(postData);
  req.end();
}

testHelloworld();
