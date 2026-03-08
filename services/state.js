const { debugLog } = require('../utils/logger');

const activeChannels = new Map();
// key: channelId
// value: { 
//   channelNumber,
//   channelName,
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

function getTotalUsers(){
    let total = 0;
    for(const channel of activeChannels.values()){
        total += channel.activeUsers.size;
    }
    return total;
}

let xmpApiCalls = 0;

function logXmpApiCall(endpoint){
    xmpApiCalls += 1;
    debugLog('api',
        `XMPlaylist API (${endpoint}) called; ` + 
        `${xmpApiCalls} API calls total.`
    );
}

let lastfmApiCalls = 0;

function logLastfmApiCall(){
    lastfmApiCalls += 1;
    debugLog('api',
        `LastFM API called; ` + 
        `${lastfmApiCalls} API calls total.`
    );
}

module.exports = { activeChannels, getTotalUsers, logXmpApiCall, logLastfmApiCall };