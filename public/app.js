// State
let isScrobbling = false;
let countdownTimer = null;

// Elements
const authStatus = document.getElementById('authStatus');
const loginBtn = document.getElementById('loginBtn');
const channelControls = document.getElementById('channelControls');
const channelSelect = document.getElementById('channelSelect');
const channelTimeout = document.getElementById('channelTimeout');
const channelBtn = document.getElementById('channelBtn');
const countdown = document.getElementById('countdown');

// Init
init();

// Functions
async function init(){
    await checkAuth();

    channelBtn.addEventListener('click', async () => {
    const channelId = channelSelect.value;
    const timeoutHours = channelTimeout.value;

    if(!channelId){
        alert('Select a channel first');
        return;
    }

    if(!isScrobbling){
        const response = await fetch('/api/scrobble/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, timeoutHours })
        });

        const data = await response.json();

        setScrobblingState(true);
        startCountdown(data.stopAt);
    }
    else{
        await fetch('/api/scrobble/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
        });

        setScrobblingState(false);
        clearInterval(countdownTimer);
        document.getElementById('countdown').textContent = '';
    }

    });
}

function setScrobblingState(state){
    isScrobbling = state;
    channelBtn.textContent = state ? 'Stop Scrobbling' : 'Start Scrobbling';
    channelBtn.className = state ? 'stopping' : 'starting';
    channelSelect.disabled = state;
    channelTimeout.disabled = state;
}

async function loadScrobbleStatus(){
    const response = await fetch('/api/scrobble/status');
    const data = await response.json();

    if(!data.active) return;

    setScrobblingState(true);
    channelSelect.value = data.channelId;
    if(data.stopAt){
        startCountdown(data.stopAt);
    }
}

async function loadChannels(){
    const response = await fetch('/api/channels');
    const channels = await response.json();

    channelSelect.innerHTML = '';

    channels.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.deeplink;
    option.textContent = `${channel.number} - ${channel.name}`;
    channelSelect.appendChild(option);
    });
}

function handleLogin(){
    window.location.href = '/auth/login';
}

async function handleLogout(){
    await fetch('/auth/logout', { method: 'POST' });
    setScrobblingState(false);
    await checkAuth();
}

async function checkAuth(){
    const response = await fetch('/api/auth-status');
    const data = await response.json();

    if(data.loggedIn){
        authStatus.textContent = `Logged in as ${data.username}`;
        authStatus.classList.add('logged-in');
        loginBtn.textContent = 'Logout';
        loginBtn.onclick = handleLogout;
        channelControls.style.display = 'block';

        await loadChannels();
        await loadScrobbleStatus();
    }
    else{
        authStatus.textContent = 'Not logged in.';
        authStatus.classList.remove('logged-in');
        loginBtn.textContent = 'Login with Last.fm';
        loginBtn.onclick = handleLogin;
        channelControls.style.display = 'none';
    }
}

function startCountdown(stopAt){
    countdownTimer = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = stopAt - now;

    if(remaining <= 0){
        clearInterval(countdownTimer);
        countdown.textContent = 'Session ended.';
        setScrobblingState(false);
        return;
    }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    countdown.textContent =
        `Auto stopping in ${hh}:${mm}:${ss}`;
    }, 1000);
}