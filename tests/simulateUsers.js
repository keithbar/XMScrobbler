const { sleep } = require('../utils/sleep');

const BASE_URL = 'http://localhost:3000';

const USER_COUNT = 100000;
const ACTION_INTERVAL = 15;
const USER_LOGIN_INTERVAL = 0.025;

let channels = [];

function randomItem(arr){
    return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchChannels(){
    const res = await fetch(`${BASE_URL}/api/channels`);
    const data = await res.json();
    return data;
}

async function startScrobble(userId, channelId){
    await fetch(`${BASE_URL}/api/scrobble/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-test-user': userId
        },
        body: JSON.stringify({
            channelId,
            timeoutHours: 1
        })
    });

    console.log(`User ${userId} started ${channelId}`);
}

async function stopScrobble(userId, channelId){
    await fetch(`${BASE_URL}/api/scrobble/stop`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-test-user': userId
        },
        body: JSON.stringify({
            channelId
        })
    });

    console.log(`User ${userId} stopped ${channelId}`);
}

async function simulateUser(userId){
    let currentChannel = null;
    
    while(true){
        const action = Math.random();

        if(!currentChannel){
            if(action < 0.8){
                const channel = randomItem(channels);
                await startScrobble(userId, channel.deeplink);
                currentChannel = channel.deeplink;
            }
            else{
                console.log(`User ${userId} idle`);
            }
        }
        else{
            if(action < 0.05){
                const channel = randomItem(channels);
                await startScrobble(userId, channel.deeplink);
                currentChannel = channel.deeplink;
            }
            else if(action < 0.1 && currentChannel){
                await stopScrobble(userId, currentChannel);
                currentChannel = null;
            }
            else{
                console.log(`User ${userId} listening to ${currentChannel}`);
            }
        }

        

        await sleep(ACTION_INTERVAL + Math.random() * 5);
    }
}

async function main(){
    console.log('Fetching channels...');
    channels = await fetchChannels();

    console.log(`Loaded ${channels.length} channels`);
    console.log(`Starting ${USER_COUNT} simulated users`);

    for(let i = 0; i < USER_COUNT; i++){
        simulateUser(`testUser${i}`);
        await sleep(USER_LOGIN_INTERVAL);
    }
}

main();