// Vercel Catch-All Serverless Route for all /api/* requests
const handler = require('./index');

module.exports = (req, res) => {
    if (req.url && !req.url.startsWith('/api')) {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    return handler(req, res);
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
