const https = require('https');

const API_KEY = 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';

// Let's test sending a simple 1x1 pixel image or test request to vision.googleapis.com
const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const payload = JSON.stringify({
  requests: [
    {
      image: { content: sampleImageBase64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
    }
  ]
});

const url = new URL(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`);

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Response body:', data);
  });
});

req.on('error', (e) => console.error('Req error:', e));
req.write(payload);
req.end();
