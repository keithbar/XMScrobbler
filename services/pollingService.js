const { sleep } = require('../utils/sleep');
const { fetchRecentTracks } = require('./xmplaylistService');
const { scrobbleTrack } = require('./lastfmService');
const { debugLog } = require('../utils/logger');

const RATE_LIMIT_DELAY = 2.1;
const MIN_POLL_INTERVAL = 2 * 60;

const activeChannels = new Map();
// key: channelId
// value: { 
//   recentTracks: [{
//     title,
//     artist,
//     timestamp
//   }],
//   activeUsers: Map()
//     key: userSessionKey,
//     value: {
//       startedAt,
//       stopAt,
//       lastScrobbled
//     }
// }

let lastPolled = 0;

async function pollLoop(){
    while(true){
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

        // debugLog("Active channels:", 
        //     [...activeChannels.entries()].map(([id, channel]) => ({
        //         channelId: id,
        //         listeners: channel.activeUsers.size
        //     }))
        // );
    }
}

async function pollChannel(channelId){
    const channel = activeChannels.get(channelId);
    const tracks = await fetchRecentTracks(channelId);

    channel.recentTracks = tracks;

    const now = Math.floor(Date.now() / 1000);

    for(const [userSessionKey, userState] of channel.activeUsers){
        if(now >= userState.stopAt){
            debugLog(`Auto stopping user ${userSessionKey}`);
            channel.activeUsers.delete(userSessionKey);
            continue;
        }

        const newTracks = tracks.filter(track => 
            track.timestamp > (userState.startedAt - 60) &&
                track.timestamp > userState.lastScrobbled
        );

        newTracks.sort((a, b) => a.timestamp - b.timestamp);

        for(const track of newTracks){
            try{
                await scrobbleTrack(userSessionKey, track);
                debugLog(`Scrobbling track: ${track.title} for ${userSessionKey}`);
                userState.lastScrobbled = track.timestamp;
            }
            catch(err){
                console.error(`Failed to scrobble track.`, err);
            }
            
        }
    }

    if(channel.activeUsers.size === 0){
        activeChannels.delete(channelId);
        //debugLog('Channel removed:', channelId);
    }
}

async function startPolling(){
    debugLog('Begin polling...');
    pollLoop();
}

module.exports = { activeChannels, startPolling };