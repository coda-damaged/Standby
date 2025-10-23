const CLIENT_ID = '95611b1c29994911b89c1c209a517c29';
const REDIRECT_URI = 'https://coda-damaged.github.io/Standby';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES =
  'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const RESPONSE_TYPE = 'token';

let accessToken = null;
let isPlaying = false;
let activeDeviceId = null;

function getAccessToken() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('access_token');
  if (token) {
    localStorage.setItem('spotifyAccessToken', token);
    window.location.hash = '';
    return token;
  }
  return localStorage.getItem('spotifyAccessToken');
}

document.getElementById('login-btn').addEventListener('click', () => {
  const authUrl = `${AUTH_ENDPOINT}?response_type=${RESPONSE_TYPE}&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${encodeURIComponent(SCOPES)}`;
  window.location.href = authUrl;
});

function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  document.getElementById('time').textContent = timeString;
}
setInterval(updateTime, 1000);
updateTime();

accessToken = getAccessToken();
if (accessToken) {
  fetchUserProfile(accessToken);
  getActiveDevice(accessToken);
  startTrackPolling(accessToken);
} else {
  console.log('No Spotify token found.');
}

async function fetchUserProfile(token) {
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    // document.getElementById('user-name').textContent = `Welcome, ${data.display_name}`;
    document.getElementById('login-btn').style.display = 'none';
  } catch (err) {
    console.error(err);
  }
}

async function getActiveDevice(token) {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.devices && data.devices.length > 0) {
      activeDeviceId = data.devices.find(d => d.is_active)?.id || data.devices[0].id;
      console.log('Active device:', activeDeviceId);
    } else {
      console.warn('No active Spotify device found.');
    }
  } catch (err) {
    console.error('Device fetch error:', err);
  }
}

async function fetchCurrentlyPlaying(token) {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204 || !res.ok) {
      document.getElementById('title').textContent = 'No song currently playing';
      document.getElementById('cover').src = '';
      document.getElementById('artist').textContent = '';
      updateBackground('');
      return;
    }

    const data = await res.json();
    if (data && data.item) {
      const coverUrl = data.item.album.images[0].url;
      document.getElementById('cover').src = coverUrl;
      document.getElementById('title').textContent = data.item.name;
      let artistName = data.item.artists.map(a => a.name).join(', ');

// If the artist is Ado, show custom title
if (artistName.toLowerCase() === 'ado') {
  artistName = '💙 Queen Ado 💙';
}

document.getElementById('artist').textContent = artistName;

      updateBackground(coverUrl);
      isPlaying = data.is_playing;
      updatePlayPauseButton();
    }
  } catch (err) {
    console.error(err);
  }
}

function startTrackPolling(token) {
  fetchCurrentlyPlaying(token);
  setInterval(() => fetchCurrentlyPlaying(token), 5000);
}

function updateBackground(imageUrl) {
  const bg = document.getElementById('background-blur');
  if (imageUrl) {
    bg.style.backgroundImage = `url(${imageUrl})`;
    bg.style.opacity = 1;
  } else {
    bg.style.opacity = 0;
  }
}

async function controlPlayback(action) {
  if (!activeDeviceId) await getActiveDevice(accessToken);
  if (!activeDeviceId) {
    alert('Open Spotify on one of your devices first!');
    return;
  }

  let endpoint = '';
  let method = 'PUT'; // Spotify expects PUT for play/pause

  switch (action) {
    case 'play':
      endpoint = `https://api.spotify.com/v1/me/player/play?device_id=${activeDeviceId}`;
      break;
    case 'pause':
      endpoint = `https://api.spotify.com/v1/me/player/pause?device_id=${activeDeviceId}`;
      break;
    case 'next':
      endpoint = `https://api.spotify.com/v1/me/player/next?device_id=${activeDeviceId}`;
      method = 'POST';
      break;
    case 'previous':
      endpoint = `https://api.spotify.com/v1/me/player/previous?device_id=${activeDeviceId}`;
      method = 'POST';
      break;
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204) {
      console.log(`${action} success`);
      setTimeout(() => fetchCurrentlyPlaying(accessToken), 1000);
    } else {
      console.warn(`Playback control failed (${res.status})`);
    }
  } catch (err) {
    console.error('Playback control error:', err);
  }
}

document.getElementById('play-pause-btn').addEventListener('click', async () => {
  const action = isPlaying ? 'pause' : 'play';
  await controlPlayback(action);
  isPlaying = !isPlaying;
  updatePlayPauseButton();
});



function updatePlayPauseButton() {
  const btn = document.getElementById('play-pause-btn');
  btn.textContent = isPlaying ? '⏸' : '▶️';
}


document.getElementById('next-btn').addEventListener('click', () => controlPlayback('next'));
document.getElementById('prev-btn').addEventListener('click', () => controlPlayback('previous'));



