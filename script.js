const CLIENT_ID = '95611b1c29994911b89c1c209a517c29';
const REDIRECT_URI = 'http://192.168.4.133:3000/callback.html';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES =
  'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const RESPONSE_TYPE = 'token';

let accessToken = 'BQBRLGaA4hZuksCB1PRsWJR-rsDvB5xO6jysS7JWpBYfzTUqCWeEFQePXDyRkHVy6TDci_GxyvZUFo7_z0ERwzAGz9XH334qGfQ-ncFllGf4MDxMK-ZZOoxfuI-P-AW6xzUkl9KlyG4iuA2LIrUX9R2LdRK7T0eY18vKSwUXs0-L1cyYEQSxz8oIGR1ylN724v7KCbdhi2ZMhIn2t1dlPG5CE7Mn2PGCH0AeQxZGClo96aeODLhGffcwrZmpp_nY8joeXOEjaOmfX6L-0YFLJNe6mb7My7YHRQIZuavt7Q-G0m7zrrhXnmZSqgUfOXDQrSdg1LGCdKPOi_4sXnjW2BpPRCHUl5-2kVK7PrspIi-8hIMcfZpaR2MtA6UyV0hmGshUtQ';
let isPlaying = false;
let activeDeviceId = null;

// Get token from URL fragment or localStorage
function getAccessToken() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('access_token');
  if (token) {
    localStorage.setItem('spotifyAccessToken', token);
    window.location.hash = ''; // remove token from URL
    return token;
  }
  return localStorage.getItem('spotifyAccessToken');
}

// Clock
function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('time').textContent = timeString;
}
setInterval(updateTime, 1000);
updateTime();

// Login button logic (forces same-tab login)
const loginBtn = document.getElementById('login-btn');
loginBtn.style.display = 'inline-block';
loginBtn.addEventListener('click', () => {
  const authUrl = `${AUTH_ENDPOINT}?response_type=${RESPONSE_TYPE}&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${encodeURIComponent(SCOPES)}`;
  // Redirect in same tab (important for iPad)
  window.location.href = authUrl;
});

// Initialize
accessToken = getAccessToken();
if (accessToken) {
  loginBtn.style.display = 'none';
  fetchUserProfile(accessToken);
  getActiveDevice(accessToken);
  startTrackPolling(accessToken);
} else {
  console.log('Waiting for Spotify login...');
}

// Fetch user profile
async function fetchUserProfile(token) {
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await res.json();
    loginBtn.style.display = 'none';
  } catch (err) {
    console.error(err);
  }
}

// Get active Spotify device
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

// Fetch currently playing track
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

      // Artist display with custom "Ado" logic
      let artistName = data.item.artists.map(a => a.name).join(', ');
      if (artistName.trim().toLowerCase() === 'ado') {
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

// Poll track info every 5 seconds
function startTrackPolling(token) {
  fetchCurrentlyPlaying(token);
  setInterval(() => fetchCurrentlyPlaying(token), 5000);
}

// Update blurred background
function updateBackground(imageUrl) {
  const bg = document.getElementById('background-blur');
  if (imageUrl) {
    bg.style.backgroundImage = `url(${imageUrl})`;
    bg.style.opacity = 1;
  } else {
    bg.style.opacity = 0;
  }
}

// Control playback
async function controlPlayback(action) {
  if (!activeDeviceId) await getActiveDevice(accessToken);
  if (!activeDeviceId) {
    alert('Open Spotify on one of your devices first!');
    return;
  }

  let endpoint = '';
  let method = 'PUT';
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

// Playback buttons
document.getElementById('play-pause-btn').addEventListener('click', async () => {
  const action = isPlaying ? 'pause' : 'play';
  await controlPlayback(action);
  isPlaying = !isPlaying;
  updatePlayPauseButton();
});
document.getElementById('next-btn').addEventListener('click', () => controlPlayback('next'));
document.getElementById('prev-btn').addEventListener('click', () => controlPlayback('previous'));

// Update play/pause button icon
function updatePlayPauseButton() {
  const btn = document.getElementById('play-pause-btn');
  btn.textContent = isPlaying ? '⏸' : '▶️';
}
