// NoteOn Chrome Extension - Content Script (runs inside NoteOn web page)

// Announce extension presence to the web page
window.postMessage(
  {
    source: 'NOTEON_EXTENSION',
    type: 'EXTENSION_READY',
    version: '1.0.0'
  },
  '*'
);

// Listen to capture messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NOTEON_EXTENSION_CAPTURE') {
    // Forward image to NoteOn React application via window postMessage
    window.postMessage(
      {
        source: 'NOTEON_EXTENSION',
        type: 'SCREENSHOT_CAPTURED',
        dataUrl: message.dataUrl,
        pageTitle: message.pageTitle,
        capturedAt: message.capturedAt || Date.now()
      },
      '*'
    );
    sendResponse({ delivered: true });
  }
});

// Check for any queued captures made while NoteOn was opening
chrome.storage.local.get(['pendingCaptures'], (result) => {
  const pending = result.pendingCaptures || [];
  if (pending.length > 0) {
    pending.forEach((cap) => {
      window.postMessage(
        {
          source: 'NOTEON_EXTENSION',
          type: 'SCREENSHOT_CAPTURED',
          dataUrl: cap.dataUrl,
          pageTitle: cap.pageTitle,
          capturedAt: cap.capturedAt
        },
        '*'
      );
    });
    chrome.storage.local.set({ pendingCaptures: [] });
  }
});

