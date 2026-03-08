const { activeChannels } = require('./state');

const BASE_URL = 'https://xmplaylist.com/api';

async function fetchChannels(){
    const response = await fetch(`${BASE_URL}/station`, {
        headers: {
            'User-Agent': 'XMScrobbler/1.0 (Node.js)',
            'Accept': 'application/json'
        }
    });
    if(!response.ok){
        throw new Error(`${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    for(const channel of data.results){
        const existing = activeChannels.get(channel.deeplink);
        if(existing){
            existing.channelNumber = channel.number;
            existing.channelName = channel.name;
        }
        else{
            activeChannels.set(channel.deeplink, {
                channelNumber: channel.number,
                channelName: channel.name,
                recentTracks: [],
                activeUsers: new Map()
            });
        }
    }

    // old method
    // return new Map(
    //     data.results.map(channel => [
    //         channel.deeplink,
    //         {
    //             number: channel.number,
    //             name: channel.name
    //         }
    //     ])
    // );
}

// old method
// async function fetchRecentTracks(channelId){
//     const response = await fetch(`${BASE_URL}/station/${channelId}`);
//     if(!response.ok){
//         throw new Error(`${response.status}: ${response.statusText}`);
//     }
//     const data = await response.json();
//     return data.results.slice(0, 5).map(normalizeTrack);
// }

async function fetchRecentTracks(){
    const response = await fetch(`${BASE_URL}/feed`, {
        headers: {
            'User-Agent': 'XMScrobbler/1.0 (Node.js)',
            'Accept': 'application/json'
        }
    });
    if(!response.ok){
        throw new Error(`${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    const tracks = data.results.map(normalizeTrack);

    const grouped = tracks.reduce((map, track) => {
        if(!map.has(track.channelId)){
            map.set(track.channelId, []);
        }
        map.get(track.channelId).push(track);
        return map;
    }, new Map());

    for(const [channelId, channelTracks] of grouped){
        grouped.set(channelId, channelTracks
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-5)
        );
    }

    return grouped;
}

function normalizeTrack(track){
    const unixTimestamp = track?.timestamp
        ? Math.floor(new Date(track.timestamp).getTime() / 1000)
        : null;
    return {
        title: track?.track?.title ?? null,
        artist: track?.track?.artists?.[0] ?? null,
        timestamp: unixTimestamp,
        channelId: track?.channelId
    }
}

module.exports = { fetchChannels, fetchRecentTracks };