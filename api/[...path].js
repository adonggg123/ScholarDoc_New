// Vercel Catch-All Serverless Route for all /api/* requests
const handler = require('./index');

module.exports = handler;

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
