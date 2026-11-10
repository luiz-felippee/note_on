// NoteOn Chrome Extension - Content Script (runs inside NoteOn web page)

function isNoteOnPage() {
  try {
    const host = window.location.hostname || '';
    const title = (document.title || '').toLowerCase();
    const href = (window.location.href || '').toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('pages.dev') ||
      host.includes('cloudflare') ||
      host.endsWith('vercel.app') ||
      host.includes('noteon') ||
      href.includes('note_on') ||
      title.includes('noteon') ||
      title.includes('note on') ||
      !!document.getElementById('root')
    );
  } catch (_) {
    return false;
  }
}

if (isNoteOnPage()) {
  initNoteOnBridge();
}

function initNoteOnBridge() {
  // Announce extension presence to the web page
  const announceReady = () => {
    window.postMessage(
      {
        source: 'NOTEON_EXTENSION',
        type: 'EXTENSION_READY',
        version: '1.2.0',
      },
      '*'
    );
  };

  announceReady();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', announceReady, { once: true });
  }

  // Listen to messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Screenshots & Cropped Slides
    if (message.type === 'NOTEON_EXTENSION_CAPTURE') {
      window.postMessage(
        {
          source: 'NOTEON_EXTENSION',
          type: 'SCREENSHOT_CAPTURED',
          dataUrl: message.dataUrl,
          pageTitle: message.pageTitle,
          capturedAt: message.capturedAt || Date.now(),
        },
        '*'
      );
      sendResponse({ delivered: true });
      return true;
    }

    // 2. Audio Recordings from Floating Recorder
    if (message.type === 'NOTEON_EXTENSION_AUDIO') {
      window.postMessage(
        {
          source: 'NOTEON_EXTENSION',
          type: 'AUDIO_RECORDED',
          dataUrl: message.dataUrl,
          duration: message.duration,
          transcript: message.transcript,
          pageTitle: message.pageTitle,
          recordedAt: message.recordedAt || Date.now(),
        },
        '*'
      );
      sendResponse({ delivered: true });
      return true;
    }
  });

  // Check and dispatch any queued captures or audios
  function checkAndDeliverPending() {
    chrome.storage.local.get(['pendingCaptures', 'pendingAudios'], (result) => {
      // Pending screenshots
      const pendingCaptures = result.pendingCaptures || [];
      if (pendingCaptures.length > 0) {
        pendingCaptures.forEach((cap) => {
          window.postMessage(
            {
              source: 'NOTEON_EXTENSION',
              type: 'SCREENSHOT_CAPTURED',
              dataUrl: cap.dataUrl,
              pageTitle: cap.pageTitle,
              capturedAt: cap.capturedAt,
            },
            '*'
          );
        });
        chrome.storage.local.set({ pendingCaptures: [] });
      }

      // Pending audios
      const pendingAudios = result.pendingAudios || [];
      if (pendingAudios.length > 0) {
        pendingAudios.forEach((audio) => {
          window.postMessage(
            {
              source: 'NOTEON_EXTENSION',
              type: 'AUDIO_RECORDED',
              dataUrl: audio.dataUrl,
              duration: audio.duration,
              transcript: audio.transcript,
              pageTitle: audio.pageTitle,
              recordedAt: audio.recordedAt,
            },
            '*'
          );
        });
        chrome.storage.local.set({ pendingAudios: [] });
      }
    });
  }

  // Automatically copy Cloud Session from NoteOn Web App into Extension Storage
  function syncCloudSessionFromWebApp() {
    try {
      const token = localStorage.getItem('noteon_cloud_jwt_v1');
      const userRaw = localStorage.getItem('noteon_cloud_user_v1');
      if (token && userRaw) {
        const user = JSON.parse(userRaw);
        chrome.storage.local.set({
          cloudToken: token,
          cloudUser: user,
          cloudApiBase: window.location.origin.includes('localhost')
            ? 'https://note-on.pages.dev'
            : window.location.origin,
        });
      }
    } catch (_) {}
  }

  // 1. Check immediately
  syncCloudSessionFromWebApp();
  checkAndDeliverPending();

  // 2. Check when user switches to NoteOn tab
  window.addEventListener('focus', () => {
    syncCloudSessionFromWebApp();
    checkAndDeliverPending();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncCloudSessionFromWebApp();
      checkAndDeliverPending();
    }
  });

  // 3. Periodic check every 2 seconds
  setInterval(() => {
    syncCloudSessionFromWebApp();
    checkAndDeliverPending();
  }, 2000);
}
