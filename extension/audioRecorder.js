// NoteOn Chrome Extension - Floating Audio Recorder Script
// Injected into any active webpage (Meet, Zoom, YouTube, Slides, etc.) to record lecture audio with a draggable floating stop button.

(function () {
  // If already recording, toggle or bring to attention
  const existing = document.getElementById('noteon-floating-audio-recorder');
  if (existing) {
    existing.style.transform = 'scale(1.08)';
    setTimeout(() => {
      existing.style.transform = 'scale(1)';
    }, 200);
    return;
  }

  let mediaRecorder = null;
  let audioStream = null;
  let audioChunks = [];
  let startTime = 0;
  let elapsedTime = 0;
  let timerInterval = null;
  let isPaused = false;
  let recognition = null;
  let liveTranscript = '';
  let audioContext = null;
  let analyser = null;
  let animFrame = null;

  // 1. Request microphone access
  navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then((stream) => {
      audioStream = stream;
      startRecording(stream);
    })
    .catch((err) => {
      console.error('Erro ao acessar microfone:', err);
      showPermissionErrorToast(err.message);
    });

  function showPermissionErrorToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '2147483647';
    toast.style.background = '#1e1b4b';
    toast.style.color = '#f8fafc';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '16px';
    toast.style.border = '1px solid rgba(239, 68, 68, 0.5)';
    toast.style.boxShadow = '0 20px 40px rgba(0,0,0,0.6)';
    toast.style.fontSize = '12px';
    toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.innerHTML = `
      <span>⚠️ <strong>Acesso ao microfone bloqueado:</strong> Autorize o microfone no ícone de cadeado do navegador para gravar.</span>
      <button style="background: transparent; color: #94a3b8; border: none; font-size: 16px; cursor: pointer;" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
  }

  function startRecording(stream) {
    startTime = Date.now();
    audioChunks = [];

    // MediaRecorder
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(500); // chunk every 500ms

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
              previewEl.textContent = `"${currentText.slice(-60)}..."`;
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

    // Audio Visualizer Analyser
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
      }
    } catch (_) {}

    // Build Floating Widget
    buildFloatingWidget();

    // Start Timer
    timerInterval = setInterval(() => {
      if (!isPaused) {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay(elapsedTime);
      }
    }, 1000);

    // Audio wave animation
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
    const miniEl = document.getElementById('noteon-mini-timer');
    if (miniEl) miniEl.textContent = formatTime(secs);
  }

  function buildFloatingWidget() {
    // Inject style for pulses and transitions
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
        @keyframes noteon-bar-pulse {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `;
      document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.id = 'noteon-floating-audio-recorder';
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '2147483647';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.background = '#090d16';
    container.style.color = '#f8fafc';
    container.style.borderRadius = '20px';
    container.style.border = '1px solid rgba(99, 102, 241, 0.45)';
    container.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 20px rgba(99, 102, 241, 0.25)';
    container.style.padding = '12px 16px';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.userSelect = 'none';
    container.style.cursor = 'grab';
    container.style.transition = 'transform 0.15s ease, opacity 0.2s ease';
    container.style.maxWidth = '380px';
    container.style.minWidth = '290px';

    container.innerHTML = `
      <!-- Header row with drag handle & controls -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div id="noteon-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; animation: noteon-red-pulse 1.6s infinite;"></div>
          <span style="font-size: 12px; font-weight: 700; color: #f8fafc; letter-spacing: -0.2px;">NoteOn Gravador</span>
          <span id="noteon-record-timer" style="font-size: 13px; font-family: monospace; font-weight: 700; color: #a5b4fc; background: #1e1b4b; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(129,140,248,0.3);">00:00</span>
        </div>

        <!-- Audio visualizer bars -->
        <div style="display: flex; align-items: center; gap: 2px; height: 18px;">
          <div class="noteon-wave-bar" style="width: 3px; height: 6px; background: #818cf8; border-radius: 2px;"></div>
          <div class="noteon-wave-bar" style="width: 3px; height: 12px; background: #818cf8; border-radius: 2px;"></div>
          <div class="noteon-wave-bar" style="width: 3px; height: 16px; background: #818cf8; border-radius: 2px;"></div>
          <div class="noteon-wave-bar" style="width: 3px; height: 8px; background: #818cf8; border-radius: 2px;"></div>
        </div>

        <!-- Header actions -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <button id="noteon-btn-minimize" title="Minimizar (ocultar da tela)" style="background: transparent; color: #94a3b8; border: none; font-size: 13px; cursor: pointer; padding: 2px 6px; border-radius: 4px;">_</button>
          <button id="noteon-btn-cancel" title="Cancelar e descartar áudio" style="background: transparent; color: #94a3b8; border: none; font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 4px;">✕</button>
        </div>
      </div>

      <!-- Live transcript snippet preview -->
      <div id="noteon-transcript-preview" style="display: none; font-size: 10px; color: #94a3b8; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 3px 6px; background: rgba(30, 41, 59, 0.5); border-radius: 6px;"></div>

      <!-- Action buttons row -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 4px;">
        <button id="noteon-btn-snip" title="Marcar e recortar a área exata do slide (Alt + S)" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; border: none; padding: 7px 11px; border-radius: 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); transition: all 0.15s ease;">
          <span>📐</span>
          <span>Marcar Área</span>
        </button>

        <button id="noteon-btn-pause" style="background: #1e293b; color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 7px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
          <span>⏸️</span>
        </button>

        <button id="noteon-btn-stop" style="flex: 1; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; border: none; padding: 7px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4); transition: all 0.15s ease;">
          <span style="font-size: 12px;">⏹️</span>
          <span>Parar e Salvar</span>
        </button>
      </div>

      <!-- Mini Pill Mode (Initially hidden) -->
      <div id="noteon-mini-pill" style="display: none; align-items: center; gap: 6px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: noteon-red-pulse 1.6s infinite;"></div>
        <span id="noteon-mini-timer" style="font-size: 12px; font-family: monospace; font-weight: bold; color: #818cf8;">00:00</span>
        <button id="noteon-btn-snip-mini" title="Marcar área do slide (Alt + S)" style="background: #4f46e5; color: white; border: none; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 3px;">
          <span>📐</span>
          <span>Print</span>
        </button>
        <button id="noteon-btn-stop-mini" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer;">⏹️ Parar</button>
        <button id="noteon-btn-expand" title="Expandir painel" style="background: transparent; color: #94a3b8; border: none; font-size: 12px; cursor: pointer; padding: 2px;">⤢</button>
      </div>
    `;

    document.body.appendChild(container);

    // Event: Stop Recording
    const handleStop = () => {
      finishAndDeliver();
    };

    container.querySelector('#noteon-btn-stop').addEventListener('click', (e) => {
      e.stopPropagation();
      handleStop();
    });

    container.querySelector('#noteon-btn-stop-mini').addEventListener('click', (e) => {
      e.stopPropagation();
      handleStop();
    });

    // Event: Trigger Area Selection Print (Snipper)
    const triggerAreaSnip = () => {
      // Temporarily hide floating recorder during crop selection
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';

      chrome.runtime.sendMessage({ action: 'TRIGGER_SNIP_AREA' }, () => {
        setTimeout(() => {
          container.style.opacity = '1';
          container.style.pointerEvents = 'auto';
        }, 500);
      });
    };

    container.querySelector('#noteon-btn-snip').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAreaSnip();
    });

    container.querySelector('#noteon-btn-snip-mini').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAreaSnip();
    });

    // Event: Pause / Resume
    const pauseBtn = container.querySelector('#noteon-btn-pause');
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isPaused) {
        mediaRecorder.pause();
        isPaused = true;
        pauseBtn.innerHTML = '<span>▶️ Continuar</span>';
        pauseBtn.style.color = '#34d399';
        pauseBtn.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        const dot = container.querySelector('#noteon-dot');
        if (dot) dot.style.animation = 'none';
      } else {
        mediaRecorder.resume();
        isPaused = false;
        pauseBtn.innerHTML = '<span>⏸️ Pausar</span>';
        pauseBtn.style.color = '#fbbf24';
        pauseBtn.style.border = '1px solid rgba(245, 158, 11, 0.35)';
        const dot = container.querySelector('#noteon-dot');
        if (dot) dot.style.animation = 'noteon-red-pulse 1.6s infinite';
      }
    });

    // Event: Minimize / Expand
    const fullContentNodes = Array.from(container.children).slice(0, 3);
    const miniPill = container.querySelector('#noteon-mini-pill');

    const toggleMinimize = (minimize) => {
      if (minimize) {
        fullContentNodes.forEach((n) => (n.style.display = 'none'));
        miniPill.style.display = 'flex';
        container.style.minWidth = 'auto';
        container.style.padding = '8px 14px';
        container.style.borderRadius = '999px';
      } else {
        fullContentNodes.forEach((n) => (n.style.display = ''));
        miniPill.style.display = 'none';
        container.style.minWidth = '290px';
        container.style.padding = '12px 16px';
        container.style.borderRadius = '20px';
      }
    };

    container.querySelector('#noteon-btn-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMinimize(true);
    });

    container.querySelector('#noteon-btn-expand').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMinimize(false);
    });

    // Event: Cancel
    container.querySelector('#noteon-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Deseja realmente cancelar e descartar esta gravação?')) {
        cleanupAll();
      }
    });

    // Draggable functionality
    makeDraggable(container);
  }

  function makeDraggable(el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    el.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
      el.style.top = Math.max(10, Math.min(window.innerHeight - 80, el.offsetTop - pos2)) + 'px';
      el.style.left = Math.max(10, Math.min(window.innerWidth - 300, el.offsetLeft - pos1)) + 'px';
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
        bars[0].style.height = Math.max(4, Math.min(18, (data[2] / 255) * 22)) + 'px';
        bars[1].style.height = Math.max(4, Math.min(18, (data[6] / 255) * 26)) + 'px';
        bars[2].style.height = Math.max(4, Math.min(18, (data[10] / 255) * 24)) + 'px';
        bars[3].style.height = Math.max(4, Math.min(18, (data[14] / 255) * 20)) + 'px';
      }
      animFrame = requestAnimationFrame(update);
    };
    update();
  }

  function finishAndDeliver() {
    const container = document.getElementById('noteon-floating-audio-recorder');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #34d399; font-weight: 700; font-size: 13px;">
          <span>⏳</span>
          <span>Salvando áudio da aula no NoteOn...</span>
        </div>
      `;
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64Audio = reader.result;
          const finalDuration = Math.max(1, Math.round(elapsedTime));

          // Send message to background script for delivery
          chrome.runtime.sendMessage(
            {
              action: 'DELIVER_AUDIO_RECORDING',
              dataUrl: base64Audio,
              duration: finalDuration,
              transcript: liveTranscript.trim(),
              pageTitle: document.title || 'Áudio da Aula (Extensão)',
            },
            (res) => {
              if (container) {
                container.innerHTML = `
                  <div style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 700; font-size: 13px;">
                    <span>✓</span>
                    <span>Áudio salvo com sucesso no NoteOn!</span>
                  </div>
                `;
                setTimeout(() => cleanupAll(), 1800);
              }
            }
          );
        };

        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.stop();
    } else {
      cleanupAll();
    }
  }

  function cleanupAll() {
    if (timerInterval) clearInterval(timerInterval);
    if (animFrame) cancelAnimationFrame(animFrame);
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    const container = document.getElementById('noteon-floating-audio-recorder');
    if (container) container.remove();
  }
})();

