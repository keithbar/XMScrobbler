const { sleep } = require('../utils/sleep');
const { fetchRecentTracks } = require('./xmplaylistService');
const { scrobbleTrack } = require('./lastfmService');
const { debugLog } = require('../utils/logger');
const { activeChannels } = require('./state');

//const RATE_LIMIT_DELAY = 2.1;
//const MIN_POLL_INTERVAL = 2 * 60;
const POLL_INTERVAL = 2 * 60;
const RETRY_INTERVAL = 0.5 * 60;

let lastPolled = 0;

async function pollLoop(){
    while(true){
        const now = Date.now() / 1000;
        if(now < lastPolled + POLL_INTERVAL){
            await sleep(lastPolled + POLL_INTERVAL - now);
            continue;
        }

        try{
            const newTracks = await fetchRecentTracks();
            for(const [channelId, channel] of activeChannels){
                channel.recentTracks = newTracks.get(channelId) ?? [];
            }
        }
        catch(err){
            console.error('Failed to fetch new tracks:', err);
            await sleep(RETRY_INTERVAL);
            continue;
        }

        for(const [channelId, channel] of activeChannels){
            for(const [userSessionKey, userState] of channel.activeUsers){
                if(now >= userState.stopAt){
                    //debugLog(`Auto stopping user ${userSessionKey}`);
                    channel.activeUsers.delete(userSessionKey);
                    continue;
                }
                
                for(const track of channel.recentTracks){
                    if(track.timestamp <= (userState.startedAt - 60)) continue;
                    if(track.timestamp <= userState.lastScrobbled) continue;
                    
                    try{
                        await scrobbleTrack(userSessionKey, track);
                        //debugLog(`Scrobbling track: ${track.title} for ${userSessionKey}`);
                        userState.lastScrobbled = track.timestamp;
                    }
                    catch(err){
                        console.error(`Failed to scrobble track.`, err);
                    }
                    
                }
            }
        }

        lastPolled = now;
    }
}

// async function pollLoop(){
//     while(true){
//         const now = Date.now() / 1000;
//         if(activeChannels.size === 0 ||
//                 now < lastPolled + MIN_POLL_INTERVAL){
//             await sleep(RATE_LIMIT_DELAY);
//             continue;
//         }

//         for(const [channelId, state] of activeChannels){
//             try{
//                 await pollChannel(channelId);
//             }
//             catch(err){
//                 console.error(`Polling failed for channel ${channelId}`, err);
//             }
            
//             await sleep(RATE_LIMIT_DELAY);
//         }

//         lastPolled = now;
//     }
// }

// async function pollChannel(channelId){
//     const channel = activeChannels.get(channelId);
//     const tracks = await fetchRecentTracks(channelId);

//     channel.recentTracks = tracks;

//     const now = Math.floor(Date.now() / 1000);

//     tracks.sort((a, b) => a.timestamp - b.timestamp);

//     for(const [userSessionKey, userState] of channel.activeUsers){
//         if(now >= userState.stopAt){
//             //debugLog(`Auto stopping user ${userSessionKey}`);
//             channel.activeUsers.delete(userSessionKey);
//             continue;
//         }
        
//         for(const track of tracks){
//             if(track.timestamp <= (userState.startedAt - 60)) continue;
//             if(track.timestamp <= userState.lastScrobbled) continue;
            
//             try{
//                 await scrobbleTrack(userSessionKey, track);
//                 //debugLog(`Scrobbling track: ${track.title} for ${userSessionKey}`);
//                 userState.lastScrobbled = track.timestamp;
//             }
//             catch(err){
//                 console.error(`Failed to scrobble track.`, err);
//             }
            
//         }
//     }

//     if(channel.activeUsers.size === 0){
//         activeChannels.delete(channelId);
//         //debugLog('Channel removed:', channelId);
//     }
// }

async function startPolling(){
    debugLog('Begin polling...');
    pollLoop();
}

module.exports = { activeChannels, startPolling };