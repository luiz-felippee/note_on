// NoteOn Chrome Extension - Popup script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const btnRecordAudio = document.getElementById('btnRecordAudio');
  const recordAudioLabel = document.getElementById('recordAudioLabel');
  const btnSnipArea = document.getElementById('btnSnipArea');
  const btnCaptureFull = document.getElementById('btnCaptureFull');
  const toast = document.getElementById('toast');

  // Check if NoteOn is open
  chrome.runtime.sendMessage({ action: 'CHECK_NOTEON_STATUS' }, (res) => {
    if (res && res.isConnected) {
      statusBadge.textContent = '● NoteOn Conectado';
      statusBadge.className = 'status-badge status-connected';
    } else {
      statusBadge.textContent = '○ NoteOn Fechado';
      statusBadge.className = 'status-badge status-disconnected';
    }
  });

  // Check if Audio Recording is active
  chrome.runtime.sendMessage({ action: 'CHECK_AUDIO_RECORDING_STATUS' }, (res) => {
    if (res && res.isRecording) {
      btnRecordAudio.className = 'btn-audio btn-audio-active';
      recordAudioLabel.textContent = '🔴 Gravando (Clique p/ Parar)';
    }
  });

  // 1. Gravar Áudio com Botão Flutuante
  btnRecordAudio.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'TRIGGER_RECORD_AUDIO' }, (res) => {
      window.close();
    });
  });

  // 2. Snip Area
  btnSnipArea.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'TRIGGER_SNIP_AREA' }, () => {
      window.close();
    });
  });

  // 3. Full Screen Capture
  btnCaptureFull.addEventListener('click', () => {
    btnCaptureFull.disabled = true;
    chrome.runtime.sendMessage({ action: 'CAPTURE_FULL_NOW' }, (res) => {
      btnCaptureFull.disabled = false;
      if (res && res.success) {
        toast.style.display = 'block';
        toast.textContent = '✓ Print enviado para o NoteOn!';
        toast.className = 'toast-msg toast-success';
        setTimeout(() => window.close(), 1000);
      } else {
        toast.style.display = 'block';
        toast.textContent = 'Salvo na fila! Abra o NoteOn.';
        toast.className = 'toast-msg status-disconnected';
      }
    });
  });
});
