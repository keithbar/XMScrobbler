const { sleep } = require('../utils/sleep');
const { fetchRecentTracks } = require('./xmplaylistService');
const { scrobbleTrack } = require('./lastfmService');

const RATE_LIMIT_DELAY = 2.1;
const MIN_POLL_INTERVAL = 0.5 * 60;

const activeChannels = new Map();
// key: channelId
// value: { 
//   lastPolled,
//   recentTracks: [{
//     title,
//     artist,
//     timestamp
//   }],
//   activeUsers: [{
//     startedAt,
//     stopAt,
//     lastScrobbled
//   }]
// }

let lastPolled = 0;

async function pollLoop(){
    while(true){
        //console.log(`Polling ${activeChannels.size} channels...`);

        const now = Date.now() / 1000;
        if(activeChannels.size === 0 ||
                now < lastPolled + MIN_POLL_INTERVAL){
            await sleep(RATE_LIMIT_DELAY);
            continue;
        }

        for(const [channelId, state] of activeChannels){
            try{
                await pollChannel(channelId);
            }
            catch(err){
                console.error(`Polling failed for channel ${channelId}`, err);
            }
            
            await sleep(RATE_LIMIT_DELAY);
        }

        lastPolled = now;
    }
}

async function pollChannel(channelId){
    //console.log(`Polling channel: ${channelId}`);
    
    const channel = activeChannels.get(channelId);
    const tracks = await fetchRecentTracks(channelId);

    channel.recentTracks = tracks;

    const now = Math.floor(Date.now() / 1000);

    for(const [userSessionKey, userState] of channel.activeUsers){
        if(now >= userState.stopAt){
            console.log(`Auto stopping user ${userSessionKey}`);
            channel.activeUsers.delete(userSessionKey);
            continue;
        }

        const newTracks = tracks.filter(track => 
            track.timestamp > (userState.startedAt - 60) &&
                track.timestamp > userState.lastScrobbled
        ); //console.log(`Retrieved ${Object.keys(newTracks).length} new tracks`);

        newTracks.sort((a, b) => a.timestamp - b.timestamp);

        for(const track of newTracks){
            try{
                await scrobbleTrack(userSessionKey, track);
                console.log(`Scrobbling track: ${track.title}`);
                userState.lastScrobbled = track.timestamp;
            }
            catch(err){
                console.error(`Failed to scrobble track.`, err);
            }
            
        }
    }

    if(channel.activeUsers.size === 0){
        activeChannels.delete(channelId);
        console.log('Channel removed:', channelId);
    }
}

async function startPolling(){
    console.log('Begin polling...');
    pollLoop();
}

module.exports = { activeChannels, startPolling };