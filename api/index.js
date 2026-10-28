// Vercel Serverless Function entry point for ScholarDoc unified API
const { server } = require('../server');

module.exports = (req, res) => {
    return new Promise((resolve) => {
        // Ensure Vercel serverless runtime waits for the response to finish
        res.on('finish', resolve);
        res.on('close', resolve);
        res.on('error', (err) => {
            console.error('[Vercel Response Error]:', err);
            resolve();
        });

        // If Vercel or intermediate proxy already consumed the stream into req.body:
        if (req.body !== undefined && req.readableEnded) {
            const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            process.nextTick(() => {
                req.emit('data', Buffer.from(raw));
                req.emit('end');
            });
        }

        try {
            server.emit('request', req, res);
        } catch (err) {
            console.error('[Vercel Server Dispatch Error]:', err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            resolve();
        }
    });
};

// Disable Vercel's automatic body parser so that raw streams are piped cleanly to server.js
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
