// NoteOn Chrome Extension - Floating Audio Recorder Script (v1.5.0)
// Records lecture audio (from microphone and/or tab video/audio) and syncs directly to NoteOn Cloud & Open Tab.

(function () {
  // If already recording on this page, pressing Alt+R or clicking the popup button again stops & saves!
  const existing = document.getElementById('noteon-floating-audio-recorder');
  if (existing) {
    const stopBtn = existing.querySelector('#noteon-btn-stop');
    if (stopBtn) {
      stopBtn.click();
    } else {
      existing.remove();
    }
    return;
  }

  let mediaRecorder = null;
  let micStream = null;
  let combinedStream = null;
  let audioChunks = [];
  let accumulatedSeconds = 0;
  let lastResumeTime = 0;
  let timerInterval = null;
  let isPaused = false;
  let recognition = null;
  let liveTranscript = '';
  let audioContext = null;
  let analyser = null;
  let animFrame = null;

  // Try to capture audio from any active <video> or <audio> element on the page
  function getPageMediaAudioTracks() {
    const tracks = [];
    try {
      const mediaElements = document.querySelectorAll('video, audio');
      mediaElements.forEach((el) => {
        try {
          const stream =
            typeof el.captureStream === 'function'
              ? el.captureStream()
              : typeof el.mozCaptureStream === 'function'
                ? el.mozCaptureStream()
                : null;
          if (stream) {
            stream.getAudioTracks().forEach((t) => {
              if (t.readyState === 'live') tracks.push(t);
            });
          }
        } catch (_) {}
      });
    } catch (_) {}
    return tracks;
  }

  async function initAudioCapture() {
    let userMicStream = null;

    // 1. Request microphone with echoCancellation=false and noiseSuppression=false
    // so it captures lectures playing from another computer or speakers without muting them
    try {
      userMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
    } catch (_) {
      try {
        userMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn('Microfone indisponível, tentando áudio da aba:', err);
      }
    }

    micStream = userMicStream;
    const pageTracks = getPageMediaAudioTracks();

    if (!userMicStream && pageTracks.length === 0) {
      showPermissionErrorToast();
      return;
    }

    // Mix microphone + page media if both exist, or use whichever is available
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const dest = audioContext.createMediaStreamDestination();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;

        if (userMicStream && userMicStream.getAudioTracks().length > 0) {
          const micSource = audioContext.createMediaStreamSource(userMicStream);
          micSource.connect(analyser);
          micSource.connect(dest);
        }

        if (pageTracks.length > 0) {
          const pageStream = new MediaStream(pageTracks);
          const pageSource = audioContext.createMediaStreamSource(pageStream);
          pageSource.connect(analyser);
          pageSource.connect(dest);
        }

        if (dest.stream.getAudioTracks().length > 0) {
          combinedStream = dest.stream;
        }
      }
    } catch (_) {}

    if (!combinedStream) {
      combinedStream = userMicStream || new MediaStream(pageTracks);
    }

    startRecording(combinedStream);
  }

  function showPermissionErrorToast() {
    try {
      chrome.runtime.sendMessage({ action: 'CLEAR_AUDIO_BADGE' });
    } catch (_) {}

    const toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1e1b4b;color:#f8fafc;padding:12px 20px;border-radius:16px;border:1px solid rgba(239,68,68,0.5);box-shadow:0 20px 40px rgba(0,0,0,0.6);font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;gap:10px;';
    toast.innerHTML = `
      <span>⚠️ <strong>Microfone bloqueado:</strong> Autorize o microfone no ícone de cadeado ao lado da URL do navegador para gravar o áudio.</span>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'background:transparent;color:#94a3b8;border:none;font-size:16px;cursor:pointer;';
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6500);
  }

  function getElapsedSeconds() {
    if (isPaused) return accumulatedSeconds;
    return accumulatedSeconds + Math.floor((Date.now() - lastResumeTime) / 1000);
  }

  function startRecording(stream) {
    accumulatedSeconds = 0;
    lastResumeTime = Date.now();
    audioChunks = [];

    let recorderOptions = { audioBitsPerSecond: 32000 };
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        recorderOptions = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        recorderOptions = { mimeType: 'audio/webm', audioBitsPerSecond: 32000 };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        recorderOptions = { mimeType: 'audio/mp4', audioBitsPerSecond: 32000 };
      }
    }

    try {
      mediaRecorder = new MediaRecorder(stream, recorderOptions);
    } catch (_) {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(400);

    // Web Speech API for real-time transcription
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              liveTranscript += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const previewEl = document.getElementById('noteon-transcript-preview');
          if (previewEl) {
            const currentText = (liveTranscript + interim).trim();
            if (currentText) {
              previewEl.style.display = 'block';
              previewEl.textContent = `"${currentText.slice(-55)}..."`;
            }
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
              recognition.start();
            } catch (_) {}
          }
        };

        recognition.start();
      } catch (_) {}
    }

    buildFloatingWidget();

    timerInterval = setInterval(() => {
      if (!isPaused) {
        updateTimerDisplay(getElapsedSeconds());
      }
    }, 500);

    animateBars();
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplay(secs) {
    const el = document.getElementById('noteon-record-timer');
    if (el) el.textContent = formatTime(secs);
  }

  function buildFloatingWidget() {
    const styleId = 'noteon-recorder-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes noteon-red-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.id = 'noteon-floating-audio-recorder';
    container.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;background:#090d16;color:#f8fafc;border-radius:16px;border:1px solid rgba(99,102,241,0.45);box-shadow:0 16px 36px rgba(0,0,0,0.75);padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;cursor:grab;max-width:340px;';

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 7px;">
          <div id="noteon-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #ef4444; animation: noteon-red-pulse 1.6s infinite;"></div>
          <span id="noteon-record-timer" style="font-size: 13px; font-family: monospace; font-weight: 700; color: #a5b4fc; background: #1e1b4b; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(129,140,248,0.3);">00:00</span>
          <div style="display: flex; align-items: center; gap: 2px; height: 16px;">
            <div class="noteon-wave-bar" style="width: 3px; height: 6px; background: #34d399; border-radius: 2px;"></div>
            <div class="noteon-wave-bar" style="width: 3px; height: 12px; background: #34d399; border-radius: 2px;"></div>
            <div class="noteon-wave-bar" style="width: 3px; height: 15px; background: #34d399; border-radius: 2px;"></div>
            <div class="noteon-wave-bar" style="width: 3px; height: 8px; background: #34d399; border-radius: 2px;"></div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" id="noteon-btn-pause" title="Pausar / Retomar" style="background: #1e293b; color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 5px 9px; border-radius: 10px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center;">
            ⏸️
          </button>

          <button type="button" id="noteon-btn-stop" title="Parar e Salvar no NoteOn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
            ⏹️ Salvar Áudio
          </button>

          <button type="button" id="noteon-btn-cancel" title="Fechar e descartar gravação" style="background: transparent; color: #94a3b8; border: none; font-size: 14px; cursor: pointer; padding: 2px 5px; border-radius: 4px;">
            ✕
          </button>
        </div>
      </div>

      <div id="noteon-transcript-preview" style="display: none; font-size: 10px; color: #94a3b8; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 6px; background: rgba(30, 41, 59, 0.5); border-radius: 6px;"></div>
    `;

    document.body.appendChild(container);

    const stopBtn = container.querySelector('#noteon-btn-stop');
    const pauseBtn = container.querySelector('#noteon-btn-pause');
    const cancelBtn = container.querySelector('#noteon-btn-cancel');

    stopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      finishAndDeliver();
    });

    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!mediaRecorder) return;
      if (!isPaused && mediaRecorder.state === 'recording') {
        accumulatedSeconds = getElapsedSeconds();
        mediaRecorder.pause();
        isPaused = true;
        pauseBtn.textContent = '▶️';
        pauseBtn.style.color = '#34d399';
        const dot = container.querySelector('#noteon-dot');
        if (dot) dot.style.animation = 'none';
      } else if (isPaused && mediaRecorder.state === 'paused') {
        lastResumeTime = Date.now();
        mediaRecorder.resume();
        isPaused = false;
        pauseBtn.textContent = '⏸️';
        pauseBtn.style.color = '#fbbf24';
        const dot = container.querySelector('#noteon-dot');
        if (dot) dot.style.animation = 'noteon-red-pulse 1.6s infinite';
      }
    });

    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({ action: 'CLEAR_AUDIO_BADGE' });
      } catch (_) {}
      cleanupAll();
    });

    makeDraggable(container);
  }

  function makeDraggable(el) {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    el.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      // Never hijack clicks on buttons or elements inside buttons!
      if (e.target && e.target.closest && e.target.closest('button, input, a')) {
        return;
      }
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.cursor = 'grabbing';
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.bottom = 'auto';
      el.style.right = 'auto';
      el.style.top = Math.max(10, Math.min(window.innerHeight - 70, el.offsetTop - pos2)) + 'px';
      el.style.left = Math.max(10, Math.min(window.innerWidth - 280, el.offsetLeft - pos1)) + 'px';
    }

    function closeDragElement() {
      el.style.cursor = 'grab';
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function animateBars() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
      analyser.getByteFrequencyData(data);
      const bars = document.querySelectorAll('.noteon-wave-bar');
      if (bars.length >= 4) {
        bars[0].style.height = Math.max(4, Math.min(16, (data[2] / 255) * 20)) + 'px';
        bars[1].style.height = Math.max(4, Math.min(16, (data[5] / 255) * 24)) + 'px';
        bars[2].style.height = Math.max(4, Math.min(16, (data[8] / 255) * 22)) + 'px';
        bars[3].style.height = Math.max(4, Math.min(16, (data[12] / 255) * 18)) + 'px';
      }
      animFrame = requestAnimationFrame(update);
    };
    update();
  }

  function finishAndDeliver() {
    const finalDuration = Math.max(1, getElapsedSeconds());
    const container = document.getElementById('noteon-floating-audio-recorder');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #34d399; font-weight: 700; font-size: 12px;">
          <span>⏳</span>
          <span>Sincronizando áudio com sua conta NoteOn...</span>
        </div>
      `;
    }

    // Guaranteed cleanup timer so the widget NEVER stays stuck on screen
    const forceCleanupTimer = setTimeout(() => {
      cleanupAll();
    }, 4500);

    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }
      } catch (_) {}

      mediaRecorder.onstop = () => {
        try {
          const cleanMime =
            mediaRecorder.mimeType && mediaRecorder.mimeType.includes('mp4')
              ? 'audio/mp4'
              : 'audio/webm';
          const audioBlob = new Blob(audioChunks, { type: cleanMime });
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64Audio = reader.result;
            try {
              chrome.runtime.sendMessage(
                {
                  action: 'DELIVER_AUDIO_RECORDING',
                  dataUrl: base64Audio,
                  duration: finalDuration,
                  transcript: liveTranscript.trim(),
                  pageTitle: document.title || 'Áudio da Aula (Extensão)',
                },
                (res) => {
                  if (chrome.runtime.lastError) {
                    clearTimeout(forceCleanupTimer);
                    cleanupAll();
                    return;
                  }
                  const activeContainer = document.getElementById('noteon-floating-audio-recorder');
                  if (activeContainer) {
                    if (res && res.needsCloudLogin && !res.deliveredDirectly) {
                      activeContainer.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24; font-weight: 700; font-size: 11px;">
                          <span>⚠️</span>
                          <span>Áudio na fila! Abra o ícone da extensão NoteOn e faça login.</span>
                        </div>
                      `;
                      clearTimeout(forceCleanupTimer);
                      setTimeout(() => cleanupAll(), 3500);
                    } else {
                      activeContainer.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 700; font-size: 12px;">
                          <span>☁️✓</span>
                          <span>Áudio salvo e enviado para o NoteOn!</span>
                        </div>
                      `;
                      clearTimeout(forceCleanupTimer);
                      setTimeout(() => cleanupAll(), 1600);
                    }
                  } else {
                    clearTimeout(forceCleanupTimer);
                    cleanupAll();
                  }
                }
              );
            } catch (_) {
              clearTimeout(forceCleanupTimer);
              cleanupAll();
            }
          };

          reader.onerror = () => {
            clearTimeout(forceCleanupTimer);
            cleanupAll();
          };

          reader.readAsDataURL(audioBlob);
        } catch (_) {
          clearTimeout(forceCleanupTimer);
          cleanupAll();
        }
      };

      try {
        mediaRecorder.stop();
      } catch (_) {
        clearTimeout(forceCleanupTimer);
        cleanupAll();
      }
    } else {
      clearTimeout(forceCleanupTimer);
      cleanupAll();
    }
  }

  function cleanupAll() {
    if (timerInterval) clearInterval(timerInterval);
    if (animFrame) cancelAnimationFrame(animFrame);
    if (micStream) {
      try {
        micStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
    }
    if (combinedStream) {
      try {
        combinedStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
    }
    if (audioContext) {
      try {
        audioContext.close().catch(() => {});
      } catch (_) {}
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    const container = document.getElementById('noteon-floating-audio-recorder');
    if (container) container.remove();
  }

  initAudioCapture();
})();
