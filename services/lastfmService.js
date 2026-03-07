const { createSignature } = require('../utils/signature');

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

async function getSession(token){
    const params = {
        method: 'auth.getSession',
        api_key: process.env.LASTFM_API_KEY,
        token: token
    };
    const api_sig = createSignature(params);

    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'XMScrobbler/1.0 (krpbarber@gmail.com)'
        },
        body: new URLSearchParams({
            ...params,
            api_sig,
            format: 'json'
        })
    });

    return response.json();
}

async function scrobbleTrack(userSessionKey, track){
    if(process.env.NODE_ENV === 'test'){
        return { success: true };
    }

    const params = {
        method: 'track.scrobble',
        artist: track.artist,
        track: track.title,
        timestamp: track.timestamp,
        api_key: process.env.LASTFM_API_KEY,
        sk: userSessionKey
    };

    const api_sig = createSignature(params);

    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'XMScrobbler/1.0 (krpbarber@gmail.com)'
        },
        body: new URLSearchParams({
            ...params,
            api_sig,
            format: 'json'
        })
    });

    return response.json();
}

module.exports = { getSession, scrobbleTrack };