const crypto = require('crypto');

function createSignature(params){
    const sortedKeys = Object.keys(params).sort();

    const signatureBase = sortedKeys
        .map(key => key + params[key])
        .join('') + process.env.LASTFM_API_SECRET;

    return crypto.createHash('md5').update(signatureBase).digest('hex');
}

module.exports = { createSignature };