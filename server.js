require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const { getSession, scrobbleTrack } = require('./services/lastfmService');
const { fetchChannels } = require('./services/xmplaylistService');
const { activeChannels, activeUsers, startPolling } = require('./services/pollingService');

let channels = [];

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

function requireAuth(req, res, next){
    if(!req.session || !req.session.username){
        return res.status(401).json({ error: 'Not authenticated' });
    }

    next();
}

////
//// Server Routes
////

// Route: /api/channels
// Response contains the currently available XM stations
app.get('/api/channels', (req, res) => {
    res.json(channels);
});

// Route: /api/auth-status
// Check to see if user is currently logged in to Last.fm
// Response contains auth status and username if logged in
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

// Route: /api/scrobble/start
// Begin scrobbling a specific station for a user
app.post('/api/scrobble/start', requireAuth, (req, res) => {
    const { channelId } = req.body;
    const sessionKey = req.session.sessionKey;

    const allowedHours = [1, 2, 4, 8, 12];
    const timeoutHours = allowedHours.includes(Number(req.body.timeoutHours))
        ? Number(req.body.timeoutHours)
        : 1;

    if(!channelId){
        return res.status(400).json({ error: 'channelId required' });
    }

    const now = Math.floor(Date.now() / 1000);
    const stopAt = now + (timeoutHours * 3600);

    let channel = activeChannels.get(channelId);

    if(!channel){
        channel = {
            listeners: 0,
            lastPolled: 0,
            recentTracks: []
        };

        activeChannels.set(channelId, channel);
        activeUsers.set(sessionKey, {
            channelId: channelId,
            startedAt: Date.now() / 1000,
            stopAt: stopAt,
            lastScrobbled: 0
        })
    }

    channel.listeners += 1;

    console.log("Channel started:", channelId);
    console.log("Active channels:", [...activeChannels.keys()]);

    res.json({ 
        success: true,
        stopAt
    });
});

// Route: /api/scrobble/stop
// Stop scrobbling a specified station for a user
app.post('/api/scrobble/stop', requireAuth, (req, res) => {
    const { channelId } = req.body;
    const sessionKey = req.session.sessionKey;

    const channel = activeChannels.get(channelId);

    if(!channel){
        return res.json({ success: true });
    }

    channel.listeners -= 1;

    if(channel.listeners <= 0){
        activeChannels.delete(channelId);
        console.log('Channel removed:', channelId);
    }

    activeUsers.delete(sessionKey);

    res.json({ success: true });
})

// Route: /api/scrobble/status
// Return the current user's scrobbling status to the frontend.
app.get('/api/scrobble/status', requireAuth, (req, res) => {
    const sessionKey = req.session.sessionKey;
    const userState = activeUsers.get(sessionKey);

    if(!userState){
        return res.json({ active: false });
    }

    res.json({
        active: true,
        channelId: userState.channelId,
        stopAt: userState.stopAt
    })
})

// Route: /auth/login
// Redirect to Last.fm for user authentication
app.get('/auth/login', (req, res) => {
    const callbackUrl = 'http://localhost:3000/auth/callback';
    const authUrl = 
        `https://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&cb=${callbackUrl}`;
    res.redirect(authUrl);
})

// Route: /auth/logout
// End Last.fm session
app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if(err){
            return res.status(500).json({ error: 'Failed to log out' });
        }

        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
})

// Route: /auth/callback
// Callback URL used by Last.fm after authentication
app.get('/auth/callback', async (req, res) => {
    const { token } = req.query;
    const data = await getSession(token);

    if(data.session){
        req.session.username = data.session.name;
        req.session.sessionKey = data.session.key;
    }

    res.redirect('/');
})

// Route: /scrobble
// Sends track data to Last.fm for scrobbling
app.post('/scrobble', requireAuth, async (req, res) => {
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

////
//// Startup
////

// Application entry point
// Runs startup logic, then begins listening for requests
async function startServer(){
    try{
        channels = await fetchChannels();
        console.log(`Loaded ${channels.length} channels`);

        app.listen(3000, () => {
            console.log('Server running at http://localhost:3000');
            startPolling();
        });
    }
    catch(err){
        console.error('Startup failed:', err);
        process.exit(1);
    }
}

startServer();