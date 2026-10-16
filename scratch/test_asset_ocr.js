const fs = require('fs');
const https = require('https');
const path = require('path');

const imgPath = path.join(__dirname, '../assets/610fa119-da65-4d5d-bd6e-ed56bbcd1dc7.jpg');
const base64Image = fs.readFileSync(imgPath).toString('base64');
const GOOGLE_API_KEY = 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';

function callOcrSpace(base64Image) {
    return new Promise((resolve) => {
        const postData = 'apikey=helloworld&language=eng&isOverlayRequired=false&OCREngine=2&base64Image=' + encodeURIComponent('data:image/jpeg;base64,' + base64Image);
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
                console.log('OCR.space status:', res.statusCode);
                try {
                    const json = JSON.parse(data);
                    console.log('OCR.space json:', json);
                    const text = json.ParsedResults?.[0]?.ParsedText || '';
                    resolve(text);
                } catch (e) {
                    console.log('OCR parse err:', e, data);
                    resolve('');
                }
            });
        });
        req.on('error', (e) => { console.log('req err:', e); resolve(''); });
        req.setTimeout(12000, () => {
            req.destroy();
            resolve('');
        });
        req.write(postData);
        req.end();
    });
}

(async () => {
    const text = await callOcrSpace(base64Image);
    console.log('OCR.space extracted text:\n', text);
})();
