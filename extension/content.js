// NoteOn Chrome Extension - Content Script (runs inside NoteOn web page)

// Announce extension presence to the web page
window.postMessage(
  {
    source: 'NOTEON_EXTENSION',
    type: 'EXTENSION_READY',
    version: '1.2.0',
  },
  '*'
);

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

// Check for any queued captures or audios made while NoteOn was opening
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
