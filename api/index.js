// Vercel Serverless Function entry point for ScholarDoc unified API
const { server } = require('../server');

module.exports = (req, res) => {
    // If Vercel or intermediate proxy already consumed the stream into req.body:
    if (req.body !== undefined && req.readableEnded) {
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        process.nextTick(() => {
            req.emit('data', Buffer.from(raw));
            req.emit('end');
        });
    }

    server.emit('request', req, res);
};

// Disable Vercel's automatic body parser so that raw streams are piped cleanly to server.js
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
