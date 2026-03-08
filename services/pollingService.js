const { sleep } = require('../utils/sleep');
const { fetchRecentTracks } = require('./xmplaylistService');
const { scrobbleTrack } = require('./lastfmService');
const { debugLog } = require('../utils/logger');
const { activeChannels, getTotalUsers } = require('./state');

//const RATE_LIMIT_DELAY = 2.1;
//const MIN_POLL_INTERVAL = 2 * 60;
const POLL_INTERVAL = 2 * 60;
const RETRY_INTERVAL = 0.5 * 60;

let lastPolled = 0;

async function pollLoop(){
    while(true){
        if(getTotalUsers() === 0){
            await sleep(10);
            continue;
        }

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
            debugLog('error', 'Failed to fetch new tracks:', err);
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
                        debugLog('scrobble', 
                            `Scrobbling track: ${track.title} (${channelId}) for ${userSessionKey}`
                        );
                        userState.lastScrobbled = track.timestamp;
                    }
                    catch(err){
                        debugLog('error', `Failed to scrobble track.`, err);
                    }
                    
                }
            }
        }

        lastPolled = now;
    }
}

async function startPolling(){
    debugLog('state', 'Begin polling...');
    pollLoop();
}

module.exports = { activeChannels, startPolling };