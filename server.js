require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');

function createSignature(params){
    const sortedKeys = Object.keys(params).sort();

    const signatureBase = sortedKeys
        .map(key => key + params[key])
        .join('') + process.env.LASTFM_API_SECRET;

    return crypto.createHash('md5').update(signatureBase).digest('hex');
}

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.get('/api/auth-status', (req, res) => {
    if(req.session && req.session.username){
        res.json({ 
            loggedIn: true, 
            username: req.session.username 
        });
    }
    else{
        res.json({ loggedIn: false })
    }
});

app.get('/auth/login', (req, res) => {
    const callbackUrl = 'http://localhost:3000/auth/callback';
    const authUrl = 
        `https://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&cb=${callbackUrl}`;
    res.redirect(authUrl);
})

app.get('/auth/callback', async (req, res) => {
    const { token } = req.query;
    const params = {
        method: 'auth.getSession',
        api_key: process.env.LASTFM_API_KEY,
        token: token
    };
    const api_sig = createSignature(params);
    const url = 'https://ws.audioscrobbler.com/2.0/';

    const response = await fetch(url, {
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

    const data = await response.json();
    if(data.session){
        req.session.username = data.session.name;
        req.session.sessionKey = data.session.key;
    }

    res.redirect('/');
})

app.post('/scrobble', async (req, res) => {
    if(!req.session.sessionKey){
        return res.status(401).json({ error: 'Not logged in' });
    }

    const { artist, track } = req.body;
    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
        method: 'track.scrobble',
        artist,
        track,
        timestamp,
        api_key: process.env.LASTFM_API_KEY,
        sk: req.session.sessionKey
    };

    const api_sig = createSignature(params);

    const response = await fetch('https://ws.audioscrobbler.com/2.0/', {
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

    const data = await response.json();
    res.json(data);
})

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});