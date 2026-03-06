const { sleep } = require('../utils/sleep');
const { fetchRecentTracks } = require('./xmplaylistService');
const { scrobbleTrack } = require('./lastfmService');

const RATE_LIMIT_DELAY = 2.1;
const MIN_POLL_INTERVAL = 2 * 60;

const activeChannels = new Map();
// key: channelId
// value: { 
//   listeners,
//   lastPolled,
//   recentTracks: [{
//     title,
//     artist,
//     timestamp
//   }]
// }

// TODO: rework this so that users are part of activeChannels
// Otherwise iterating over activeUsers becomes very expensive
// as number of users gets very large

const activeUsers = new Map();
// key: userSessionKey
// value: {
//   channelId,
//   startedAt,
//   stopAt,
//   lastScrobbled,
// }

let lastPolled = 0;

async function pollLoop(){
    // TODO: add some error handling so entire app doesn't crash
    // if API call fails
    while(true){
        //console.log(`Polling ${activeChannels.size} channels...`);

        const now = Date.now() / 1000;
        if(activeChannels.size === 0 ||
                now < lastPolled + MIN_POLL_INTERVAL){
            await sleep(RATE_LIMIT_DELAY);
            continue;
        }

        for(const [channelId, state] of activeChannels){
            await pollChannel(channelId);
            await sleep(RATE_LIMIT_DELAY);
        }

        lastPolled = now;
    }
}

async function pollChannel(channelId){
    //console.log(`Polling channel: ${channelId}`);
    
    const tracks = await fetchRecentTracks(channelId);
    activeChannels.get(channelId).recentTracks = tracks;

    const now = Math.floor(Date.now() / 1000);

    for(const [userSessionKey, userState] of activeUsers){
        if(userState.channelId !== channelId) continue;

        if(now >= userState.stopAt){
            console.log(`Auto stopping user ${userSessionKey}`);
            activeUsers.delete(userSessionKey);
            const channel = activeChannels.get(channelId);
            channel.listeners -= 1;
            if(channel.listeners <= 0){
                activeChannels.delete(channelId);
                console.log('Channel removed:', channelId);
            }
            continue;
        }

        const newTracks = tracks.filter(track => 
            track.timestamp >= (userState.startedAt - 60) &&
                track.timestamp > (userState.lastScrobbled ?? 0)
        ); //console.log(`Retrieved ${Object.keys(newTracks).length} new tracks`);

        newTracks.sort((a, b) => a.timestamp - b.timestamp);

        for(const track of newTracks){
            await scrobbleTrack(userSessionKey, track);
            console.log(`Scrobbling track: ${track.title}`);
            userState.lastScrobbled = track.timestamp;
        }
    }
}

async function startPolling(){
    console.log('Begin polling...');
    pollLoop();
}

module.exports = { activeChannels, activeUsers, startPolling };