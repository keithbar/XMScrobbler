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

const activeUsers = new Map();
// key: userSessionKey
// value: {
//   channelId,
//   startedAt,
//   lastScrobbled
// }

let lastPolled = 0;

async function pollLoop(){
    while(true){
        console.log(`Polling ${activeChannels.size} channels...`);

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

        lastPolled = now / 1000;
    }
}

async function pollChannel(channelId){
    console.log(`Polling channel: ${channelId}`);
    
    const tracks = await fetchRecentTracks(channelId);
    activeChannels.get(channelId).recentTracks = tracks;

    for(const [userSessionKey, userState] of activeUsers){
        if(userState.channelId !== channelId) continue;
        
        const newTracks = tracks.filter(track => 
            track.timestamp >= (userState.startedAt - 60) &&
                track.timestamp > (userState.lastScrobbled ?? 0)
        ); console.log(`Retrieved ${Object.keys(newTracks).length} new tracks`);

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