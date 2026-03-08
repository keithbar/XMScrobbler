const BASE_URL = 'https://xmplaylist.com/api/';

async function fetchChannels(){
    const response = await fetch(`${BASE_URL}station`, {
        headers: {
            'User-Agent': 'XMScrobbler/1.0 (Node.js)',
            'Accept': 'application/json'
        }
    });
    if(!response.ok){
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    return new Map(
        data.results.map(channel => [
            channel.deeplink,
            {
                number: channel.number,
                name: channel.name
            }
        ])
    );
}

async function fetchRecentTracks(channelId){
    const response = await fetch(`${BASE_URL}station/${channelId}`);
    if(!response.ok){
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
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