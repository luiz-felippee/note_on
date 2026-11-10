// NoteOn Chrome Extension - Background Service Worker

// Helper to find an active NoteOn tab
async function findNoteOnTabs() {
  const allTabs = await chrome.tabs.query({});
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    return (
      url.includes('localhost') ||
      url.includes('127.0.0.1') ||
      url.includes('pages.dev') ||
      url.includes('cloudflare') ||
      url.includes('vercel.app') ||
      url.includes('noteon') ||
      url.includes('note_on') ||
      title.includes('noteon') ||
      title.includes('note on')
    );
  });
}

const DEFAULT_CLOUD_API_BASE = 'https://note-on.pages.dev';

// Upload print or audio directly to NoteOn Cloud D1 API (works across different computers even with NoteOn tab closed!)
async function uploadDirectToCloud(payload) {
  try {
    const stored = await chrome.storage.local.get(['cloudToken', 'cloudApiBase']);
    const token = stored.cloudToken;
    if (!token) return false;

    const apiBase = stored.cloudApiBase || DEFAULT_CLOUD_API_BASE;
    const res = await fetch(`${apiBase}/api/sync?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'extension_upload',
        ...payload,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.success);
  } catch (err) {
    console.warn('Erro ao enviar diretamente para NoteOn Cloud:', err);
    return false;
  }
}

// Forward screenshot dataUrl to NoteOn
async function forwardToNoteOn(dataUrl, pageTitle) {
  const noteOnTabs = await findNoteOnTabs();
  let deliveredDirectly = false;

  const capturePayload = {
    dataUrl,
    pageTitle: pageTitle || 'Slide da Aula',
    capturedAt: Date.now(),
  };

  if (noteOnTabs.length > 0) {
    for (const tab of noteOnTabs) {
      try {
        const response = await new Promise((resolve) => {
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'NOTEON_EXTENSION_CAPTURE',
              ...capturePayload,
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            }
          );
        });

        if (response && response.delivered) {
          deliveredDirectly = true;
          break;
        }
      } catch (_) {}
    }
  }

  // Se a aba do NoteOn não estiver aberta neste computador, sobe direto para a Nuvem (para aparecer nos outros PCs e celular!)
  let uploadedToCloud = false;
  if (!deliveredDirectly) {
    uploadedToCloud = await uploadDirectToCloud({
      captureType: 'photo',
      dataUrl,
      pageTitle: capturePayload.pageTitle,
    });
  }

  if (!deliveredDirectly && !uploadedToCloud) {
    const existingQueue = (await chrome.storage.local.get(['pendingCaptures'])).pendingCaptures || [];
    existingQueue.push(capturePayload);
    await chrome.storage.local.set({ pendingCaptures: existingQueue });

    chrome.action.setBadgeText({ text: '📸✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 4000);

    return { success: true, queued: true };
  } else {
    chrome.action.setBadgeText({ text: '📸✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2500);

    return { success: true, deliveredDirectly: true, uploadedToCloud };
  }
}

// Forward recorded audio to NoteOn
async function forwardAudioToNoteOn(dataUrl, duration, transcript, pageTitle) {
  const noteOnTabs = await findNoteOnTabs();
  let deliveredDirectly = false;

  const audioPayload = {
    dataUrl,
    duration,
    transcript,
    pageTitle: pageTitle || 'Áudio da Aula (Extensão)',
    recordedAt: Date.now(),
  };

  if (noteOnTabs.length > 0) {
    for (const tab of noteOnTabs) {
      try {
        const response = await new Promise((resolve) => {
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'NOTEON_EXTENSION_AUDIO',
              ...audioPayload,
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            }
          );
        });

        if (response && response.delivered) {
          deliveredDirectly = true;
          break;
        }
      } catch (_) {}
    }
  }

  // Se a aba do NoteOn não estiver aberta neste computador, sobe o áudio direto para a Nuvem!
  let uploadedToCloud = false;
  if (!deliveredDirectly) {
    uploadedToCloud = await uploadDirectToCloud({
      captureType: 'audio',
      dataUrl,
      duration,
      transcript,
      pageTitle: audioPayload.pageTitle,
    });
  }

  if (!deliveredDirectly && !uploadedToCloud) {
    const existingQueue = (await chrome.storage.local.get(['pendingAudios'])).pendingAudios || [];
    existingQueue.push(audioPayload);
    await chrome.storage.local.set({ pendingAudios: existingQueue });

    chrome.action.setBadgeText({ text: '🎙️✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 4500);

    return { success: true, queued: true };
  } else {
    chrome.action.setBadgeText({ text: '🎙️✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3500);

    return { success: true, deliveredDirectly: true, uploadedToCloud };
  }
}

// Inject snipper.js overlay on any active webpage
async function triggerSnipperOnActiveTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['snipper.js'],
    });
    return { success: true };
  } catch (err) {
    console.error('Erro ao injetar snipper:', err);
    return captureFullActiveTab();
  }
}

// Inject audioRecorder.js floating widget on active webpage
async function triggerAudioRecorderOnActiveTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['audioRecorder.js'],
    });
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    return { success: true };
  } catch (err) {
    console.error('Erro ao injetar gravador de áudio:', err);
    return { success: false, error: err.message };
  }
}

// Full Tab Capture
async function captureFullActiveTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const pageTitle = activeTab?.title || 'Slide da Aula';
    return await forwardToNoteOn(dataUrl, pageTitle);
  } catch (err) {
    console.error('Erro na captura total:', err);
    return { success: false, error: err.message };
  }
}

// Hotkey listener
chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) return;

  if (command === 'record-audio') {
    await triggerAudioRecorderOnActiveTab(activeTab.id);
  } else if (command === 'capture-area') {
    await triggerSnipperOnActiveTab(activeTab.id);
  } else if (command === 'capture-full') {
    await captureFullActiveTab();
  }
});

// Message listener from popup, snipper.js, and audioRecorder.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TRIGGER_RECORD_AUDIO') {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        const res = await triggerAudioRecorderOnActiveTab(activeTab.id);
        sendResponse(res);
      } else {
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  if (request.action === 'DELIVER_AUDIO_RECORDING') {
    (async () => {
      chrome.action.setBadgeText({ text: '' });
      const res = await forwardAudioToNoteOn(
        request.dataUrl,
        request.duration,
        request.transcript,
        request.pageTitle
      );
      sendResponse(res);
    })();
    return true;
  }

  if (request.action === 'TRIGGER_SNIP_AREA') {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        const res = await triggerSnipperOnActiveTab(activeTab.id);
        sendResponse(res);
      } else {
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  if (request.action === 'CAPTURE_FULL_NOW') {
    (async () => {
      const res = await captureFullActiveTab();
      sendResponse(res);
    })();
    return true;
  }

  if (request.action === 'GET_RAW_SCREENSHOT') {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'DELIVER_CROPPED_CAPTURE') {
    (async () => {
      const res = await forwardToNoteOn(request.dataUrl, request.pageTitle);
      sendResponse(res);
    })();
    return true;
  }

  if (request.action === 'CHECK_NOTEON_STATUS') {
    (async () => {
      const tabs = await findNoteOnTabs();
      const stored = await chrome.storage.local.get(['cloudUser', 'cloudToken']);
      sendResponse({
        isConnected: tabs.length > 0 || Boolean(stored.cloudToken),
        hasOpenTab: tabs.length > 0,
        cloudUser: stored.cloudUser || null,
        count: tabs.length,
      });
    })();
    return true;
  }

  if (request.action === 'EXTENSION_CLOUD_LOGIN') {
    (async () => {
      try {
        const res = await fetch(`${DEFAULT_CLOUD_API_BASE}/api/auth?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            email: request.email,
            password: request.password,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.token) {
          sendResponse({ success: false, error: data.error || 'Falha no login.' });
          return;
        }
        await chrome.storage.local.set({
          cloudToken: data.token,
          cloudUser: data.user,
          cloudApiBase: DEFAULT_CLOUD_API_BASE,
        });
        sendResponse({ success: true, user: data.user });
      } catch (err) {
        sendResponse({ success: false, error: 'Erro de conexão com a nuvem.' });
      }
    })();
    return true;
  }

  if (request.action === 'EXTENSION_CLOUD_LOGOUT') {
    (async () => {
      await chrome.storage.local.remove(['cloudToken', 'cloudUser']);
      sendResponse({ success: true });
    })();
    return true;
  }
});
