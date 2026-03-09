require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const { getSession, scrobbleTrack } = require('./services/lastfmService');
const { fetchChannels } = require('./services/xmplaylistService');
const { startPolling } = require('./services/pollingService');
const { activeChannels, getTotalUsers } = require('./services/state');
const { debugLog } = require('./utils/logger');
const { sleep } = require('./utils/sleep');

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
    if(process.env.NODE_ENV === 'test' && req.headers['x-test-user']){
        req.username = req.headers['x-test-user'];
        return next();
    }

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
    res.json(
        [...activeChannels.entries()].map(([deeplink, info]) => ({
            deeplink,
            number: info.channelNumber,
            name: info.channelName
        }))
    );
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
    const username = req.username ?? req.session.username;

    if(!channelId){
        return res.status(400).json({ error: 'channelId required' });
    }

    if(!activeChannels.has(channelId)){
        return res.status(400).json({ error: 'Invalid channelId' });
    }

    for(const [id, channel] of activeChannels){
        if(channel.activeUsers.has(username)){
            channel.activeUsers.delete(username);
        }
    }

    const allowedHours = [1, 2, 4, 8, 12];
    const timeoutHours = allowedHours.includes(Number(req.body.timeoutHours))
        ? Number(req.body.timeoutHours)
        : 1;

    const now = Math.floor(Date.now() / 1000);
    const stopAt = now + (timeoutHours * 3600);

    let channel = activeChannels.get(channelId);

    channel.activeUsers.set(username, {
        startedAt: now,
        stopAt: stopAt,
        lastScrobbled: 0,
        sessionKey: sessionKey
    })

    //debugLog("Channel started:", channelId);

    res.json({ 
        success: true,
        stopAt
    });
});

// Route: /api/scrobble/stop
// Stop scrobbling a specified station for a user
app.post('/api/scrobble/stop', requireAuth, (req, res) => {
    const { channelId } = req.body;
    
    const username = req.username ?? req.session.username;

    if(!channelId){
        return res.status(400).json({ error: 'channelId required' });
    }

    if(!activeChannels.has(channelId)){
        return res.status(400).json({ error: 'Invalid channelId' });
    }

    const channel = activeChannels.get(channelId);

    channel.activeUsers.delete(username);

    res.json({ success: true });
})

// Route: /api/scrobble/status
// Return the current user's scrobbling status to the frontend.
app.get('/api/scrobble/status', requireAuth, (req, res) => {
    const username = req.username ?? req.session.username;
    
    for(const [channelId, channel] of activeChannels){
        const userState = channel.activeUsers.get(username);
        if(userState){
            return res.json({
                active: true,
                channelId: channelId,
                stopAt: userState.stopAt
            });
        }
    }

    res.json({ active: false });
})

// Route: /auth/login
// Redirect to Last.fm for user authentication
app.get('/auth/login', (req, res) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/auth/callback`;
    console.log(callbackUrl);
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
    try{
        const data = await getSession(token);

        if(data.session){
            req.session.username = data.session.name;
            req.session.sessionKey = data.session.key;
        }
    }
    catch(err){
        debugLog('error', 'Failed to authenticate with Last.fm.', err);
    }

    res.redirect('/');
})

// Route: /debug/state
// Sends information about server state for debugging purposes
app.get('/debug/state', (req, res) => {
    if(
        process.env.NODE_ENV != 'test' &&
        process.env.NODE_ENV != 'dev'
    ){
        return res.status(404).end();
    }

    const snapshot = {};

    for(const [channelId, channel] of activeChannels){
        snapshot[channelId] = {
            channelId: channelId,
            listenerCount: channel.activeUsers.size,
            lastTrack: channel.recentTracks[0],
            listeners: Array.from(channel.activeUsers.entries()).map(
                ([username, user]) => ({
                    username,
                    ...user
                })
            )
        };
    }

    const sortedSnapshot = Object.fromEntries(
        Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b))
    );

    res.json(sortedSnapshot);
})

////
//// Startup
////

// Application entry point
// Runs startup logic, then begins listening for requests
async function startServer(){
    let delay = 10;
    const maxDelay = 5 * 60;

    while(true){
        try{
            await fetchChannels();
            debugLog('state', `Loaded ${activeChannels.size} channels`);

            setInterval(async () => {
                try{
                    await fetchChannels();
                    debugLog('state',
                        `Channel list refreshed, loaded ${activeChannels.size} channels`
                    );
                }
                catch(err){
                    debugLog('error', 'Failed to refresh channels:', err);
                }
            }, 60 * 60 * 1000);

            // memory monitor
            setInterval(() => {
                const m = process.memoryUsage();

                debugLog('memory',
                    `Users: ${getTotalUsers()} ` +
                    `[MEM] heapUsed=${Math.round(m.heapUsed/1024/1024)}MB ` +
                    `heapTotal=${Math.round(m.heapTotal/1024/1024)}MB ` +
                    `rss=${Math.round(m.rss/1024/1024)}MB`
                );
            }, 60 * 1000);

            return app.listen(3000, () => {
                debugLog('state', `Server running on port 3000`);
                startPolling();
            });

        }
        catch(err){
            debugLog('error', `Startup failed, retrying in ${delay} seconds:`, err);
            await sleep(delay);
            delay = Math.min(delay * 2, maxDelay);
        }
    }
}

startServer();