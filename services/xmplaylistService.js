const BASE_URL = 'https://xmplaylist.com/api/';

async function fetchChannels(){
    const response = await fetch(`${BASE_URL}station`);
    const data = await response.json();
    return data.results;
}

async function fetchRecentTracks(channelId){
    const response = await fetch(`${BASE_URL}station/${channelId}`);
    const data = await response.json();
    return data.results.slice(0, 5).map(normalizeTrack);
}

function normalizeTrack(track){
    const unixTimestamp = track?.timestamp
        ? Math.floor(new Date(track.timestamp).getTime() / 1000)
        : null;
    return {
        title: track?.track?.title ?? null,
        artist: track?.track?.artists?.[0] ?? null,
        timestamp: unixTimestamp
    }
}

module.exports = { fetchChannels, fetchRecentTracks };