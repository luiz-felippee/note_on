// NoteOn Chrome Extension - Background Service Worker

// Allowed match patterns for NoteOn tabs
const NOTEON_URL_PATTERNS = [
  'http://localhost/*',
  'http://127.0.0.1/*',
  'https://*.vercel.app/*',
  'https://*.noteon.app/*'
];

// Helper to find an active NoteOn tab
async function findNoteOnTabs() {
  const allTabs = await chrome.tabs.query({});
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    return (
      tab.url.includes('localhost') ||
      tab.url.includes('127.0.0.1') ||
      tab.url.includes('vercel.app') ||
      tab.url.includes('noteon')
    );
  });
}

// Capture current screen and send to NoteOn
async function captureAndSendToNoteOn(activeTab) {
  try {
    // 1. Capture current visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const pageTitle = (activeTab && activeTab.title) ? activeTab.title : 'Slide da Aula';

    // 2. Find NoteOn tabs
    const noteOnTabs = await findNoteOnTabs();

    if (noteOnTabs.length > 0) {
      // Send to the first active or recent NoteOn tab
      const targetTab = noteOnTabs[0];

      chrome.tabs.sendMessage(
        targetTab.id,
        {
          type: 'NOTEON_EXTENSION_CAPTURE',
          dataUrl,
          pageTitle,
          capturedAt: Date.now()
        },
        () => {
          if (chrome.runtime.lastError) {
            console.log('Tentativa de envio via sendMessage:', chrome.runtime.lastError.message);
          }
        }
      );

      // Show OK badge on icon
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2500);

      return { success: true, targetTabId: targetTab.id };
    } else {
      // Store in offline queue
      const existingQueue = (await chrome.storage.local.get(['pendingCaptures'])).pendingCaptures || [];
      existingQueue.push({
        dataUrl,
        pageTitle,
        capturedAt: Date.now()
      });
      await chrome.storage.local.set({ pendingCaptures: existingQueue });

      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 4000);

      return { success: false, reason: 'no_noteon_tab' };
    }
  } catch (err) {
    console.error('Erro ao capturar tela no NoteOn Extension:', err);
    return { success: false, error: err.message };
  }
}

// Hotkey listener (Alt + S)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-slide') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await captureAndSendToNoteOn(activeTab);
  }
});

// Message listener from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TRIGGER_CAPTURE') {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await captureAndSendToNoteOn(activeTab);
      sendResponse(res);
    })();
    return true; // Keep sendResponse async
  }

  if (request.action === 'CHECK_NOTEON_STATUS') {
    (async () => {
      const tabs = await findNoteOnTabs();
      sendResponse({ isConnected: tabs.length > 0, count: tabs.length });
    })();
    return true;
  }
});
