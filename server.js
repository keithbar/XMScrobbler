require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const { getSession, scrobbleTrack } = require('./services/lastfmService');

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
    if(req.session?.username){
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
    const data = await getSession(token);

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
    const data = await scrobbleTrack({
        artist,
        track,
        sessionKey: req.session.sessionKey
    });
    res.json(data);
})

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});