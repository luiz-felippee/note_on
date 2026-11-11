// NoteOn Chrome Extension - Background Service Worker (Multi-Computer Cloud Sync v1.4.0)

const DEFAULT_CLOUD_API_BASE = 'https://note-on.pages.dev';

// Helper to find an active NoteOn tab
async function findNoteOnTabs() {
  const allTabs = await chrome.tabs.query({});
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    return (
      url.includes('note-on.pages.dev') ||
      url.includes('noteon') ||
      url.includes('note_on') ||
      url.includes('localhost:5173') ||
      url.includes('127.0.0.1:5173') ||
      title.includes('noteon')
    );
  });
}

// Automatically pull cloud token from any open NoteOn tab if not yet stored in extension
async function ensureCloudToken() {
  const stored = await chrome.storage.local.get(['cloudToken', 'cloudUser', 'cloudApiBase']);
  if (stored.cloudToken) {
    return {
      token: stored.cloudToken,
      user: stored.cloudUser || null,
      apiBase: stored.cloudApiBase || DEFAULT_CLOUD_API_BASE,
    };
  }

  const tabs = await findNoteOnTabs();
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            return {
              token: localStorage.getItem('noteon_cloud_jwt_v1'),
              userRaw: localStorage.getItem('noteon_cloud_user_v1'),
              origin: window.location.origin,
            };
          } catch (_) {
            return null;
          }
        },
      });
      const res = results && results[0] && results[0].result;
      if (res && res.token && res.userRaw) {
        const user = JSON.parse(res.userRaw);
        const apiBase =
          res.origin && !res.origin.includes('localhost')
            ? res.origin
            : DEFAULT_CLOUD_API_BASE;
        await chrome.storage.local.set({
          cloudToken: res.token,
          cloudUser: user,
          cloudApiBase: apiBase,
        });
        return { token: res.token, user, apiBase };
      }
    } catch (_) {}
  }

  return { token: null, user: null, apiBase: DEFAULT_CLOUD_API_BASE };
}

// Upload print or audio directly to NoteOn Cloud D1 API (works across different computers even with NoteOn tab closed!)
async function uploadDirectToCloud(payload) {
  try {
    const { token, apiBase } = await ensureCloudToken();
    if (!token) return false;

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

// Flush any queued captures or audios to the cloud once logged in
async function flushPendingToCloud() {
  const { token } = await ensureCloudToken();
  if (!token) return { uploadedCount: 0 };

  const stored = await chrome.storage.local.get(['pendingCaptures', 'pendingAudios']);
  const pendingCaptures = stored.pendingCaptures || [];
  const pendingAudios = stored.pendingAudios || [];
  let uploadedCount = 0;

  const remainingCaptures = [];
  for (const cap of pendingCaptures) {
    const ok = await uploadDirectToCloud({
      itemId: cap.itemId || `print-${cap.capturedAt || Date.now()}`,
      captureType: 'photo',
      dataUrl: cap.dataUrl,
      pageTitle: cap.pageTitle || 'Slide da Aula',
    });
    if (ok) uploadedCount++;
    else remainingCaptures.push(cap);
  }

  const remainingAudios = [];
  for (const aud of pendingAudios) {
    const ok = await uploadDirectToCloud({
      itemId: aud.itemId || `rec-${aud.recordedAt || Date.now()}`,
      captureType: 'audio',
      dataUrl: aud.dataUrl,
      duration: aud.duration,
      transcript: aud.transcript,
      pageTitle: aud.pageTitle || 'Áudio da Aula (Extensão)',
    });
    if (ok) uploadedCount++;
    else remainingAudios.push(aud);
  }

  await chrome.storage.local.set({
    pendingCaptures: remainingCaptures,
    pendingAudios: remainingAudios,
  });

  return { uploadedCount };
}

// Forward screenshot dataUrl to NoteOn (Both Cloud D1 + Open Tab)
async function forwardToNoteOn(dataUrl, pageTitle) {
  const now = Date.now();
  const sharedItemId = `print-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const capturePayload = {
    itemId: sharedItemId,
    dataUrl,
    pageTitle: pageTitle || 'Slide da Aula',
    capturedAt: now,
  };

  // 1. Sobe SEMPRE direto para a Nuvem se estiver logado (garante aparecer em outros computadores na hora!)
  const uploadedToCloud = await uploadDirectToCloud({
    itemId: sharedItemId,
    captureType: 'photo',
    dataUrl,
    pageTitle: capturePayload.pageTitle,
  });

  // 2. Também entrega instantaneamente caso haja aba do NoteOn aberta neste computador
  const noteOnTabs = await findNoteOnTabs();
  let deliveredDirectly = false;

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

  if (!deliveredDirectly && !uploadedToCloud) {
    const existingQueue = (await chrome.storage.local.get(['pendingCaptures'])).pendingCaptures || [];
    existingQueue.push(capturePayload);
    await chrome.storage.local.set({ pendingCaptures: existingQueue });

    chrome.action.setBadgeText({ text: '📸!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 4000);

    return {
      success: true,
      queued: true,
      uploadedToCloud: false,
      deliveredDirectly: false,
      needsCloudLogin: true,
    };
  } else {
    chrome.action.setBadgeText({ text: '📸✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2500);

    return {
      success: true,
      deliveredDirectly,
      uploadedToCloud,
      needsCloudLogin: false,
    };
  }
}

// Forward recorded audio to NoteOn (Both Cloud D1 + Open Tab)
async function forwardAudioToNoteOn(dataUrl, duration, transcript, pageTitle) {
  const now = Date.now();
  const sharedItemId = `rec-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const audioPayload = {
    itemId: sharedItemId,
    dataUrl,
    duration,
    transcript,
    pageTitle: pageTitle || 'Áudio da Aula (Extensão)',
    recordedAt: now,
  };

  // 1. Sobe SEMPRE direto para a Nuvem se estiver logado (garante aparecer em outros computadores na hora!)
  const uploadedToCloud = await uploadDirectToCloud({
    itemId: sharedItemId,
    captureType: 'audio',
    dataUrl,
    duration,
    transcript,
    pageTitle: audioPayload.pageTitle,
  });

  // 2. Também entrega instantaneamente caso haja aba do NoteOn aberta neste computador
  const noteOnTabs = await findNoteOnTabs();
  let deliveredDirectly = false;

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

  if (!deliveredDirectly && !uploadedToCloud) {
    const existingQueue = (await chrome.storage.local.get(['pendingAudios'])).pendingAudios || [];
    existingQueue.push(audioPayload);
    await chrome.storage.local.set({ pendingAudios: existingQueue });

    chrome.action.setBadgeText({ text: '🎙️!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 4500);

    return {
      success: true,
      queued: true,
      uploadedToCloud: false,
      deliveredDirectly: false,
      needsCloudLogin: true,
    };
  } else {
    chrome.action.setBadgeText({ text: '🎙️✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3500);

    return {
      success: true,
      deliveredDirectly,
      uploadedToCloud,
      needsCloudLogin: false,
    };
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

  if (request.action === 'CHECK_AUDIO_RECORDING_STATUS') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          sendResponse({ isRecording: false });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => Boolean(document.getElementById('noteon-floating-audio-recorder')),
        });
        const isRec = Boolean(results && results[0] && results[0].result);
        sendResponse({ isRecording: isRec });
      } catch (_) {
        sendResponse({ isRecording: false });
      }
    })();
    return true;
  }

  if (request.action === 'CLEAR_AUDIO_BADGE') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
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
      const { token, user } = await ensureCloudToken();
      if (token) {
        await flushPendingToCloud();
      }
      const stored = await chrome.storage.local.get(['pendingCaptures', 'pendingAudios']);
      const pendingCount =
        (stored.pendingCaptures ? stored.pendingCaptures.length : 0) +
        (stored.pendingAudios ? stored.pendingAudios.length : 0);

      sendResponse({
        isConnected: tabs.length > 0 || Boolean(token),
        hasOpenTab: tabs.length > 0,
        cloudUser: user || null,
        pendingCount,
        count: tabs.length,
      });
    })();
    return true;
  }

  if (request.action === 'FLUSH_PENDING_TO_CLOUD') {
    (async () => {
      const res = await flushPendingToCloud();
      sendResponse(res);
    })();
    return true;
  }

  if (request.action === 'EXTENSION_CLOUD_LOGIN') {
    (async () => {
      try {
        const authAction = request.authAction || 'login';
        const res = await fetch(`${DEFAULT_CLOUD_API_BASE}/api/auth?action=${authAction}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: authAction,
            email: request.email,
            password: request.password,
            newPassword: request.password,
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
        const flushed = await flushPendingToCloud();
        sendResponse({
          success: true,
          user: data.user,
          uploadedCount: flushed.uploadedCount || 0,
        });
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
