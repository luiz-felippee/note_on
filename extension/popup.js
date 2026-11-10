// NoteOn Chrome Extension - Popup script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const btnRecordAudio = document.getElementById('btnRecordAudio');
  const recordAudioLabel = document.getElementById('recordAudioLabel');
  const btnSnipArea = document.getElementById('btnSnipArea');
  const btnCaptureFull = document.getElementById('btnCaptureFull');
  const toast = document.getElementById('toast');

  const cloudLoggedBox = document.getElementById('cloudLoggedBox');
  const cloudLoginForm = document.getElementById('cloudLoginForm');
  const cloudEmailText = document.getElementById('cloudEmailText');
  const cloudEmailInput = document.getElementById('cloudEmailInput');
  const cloudPassInput = document.getElementById('cloudPassInput');
  const btnCloudLogin = document.getElementById('btnCloudLogin');
  const btnCloudLogout = document.getElementById('btnCloudLogout');

  function updateCloudUI(cloudUser, hasOpenTab) {
    if (cloudUser && cloudUser.email) {
      cloudLoggedBox.style.display = 'block';
      cloudLoginForm.style.display = 'none';
      cloudEmailText.textContent = cloudUser.email;
      statusBadge.textContent = '● Nuvem Conectada';
      statusBadge.className = 'status-badge status-connected';
    } else {
      cloudLoggedBox.style.display = 'none';
      cloudLoginForm.style.display = 'block';
      if (hasOpenTab) {
        statusBadge.textContent = '● Aba Aberta';
        statusBadge.className = 'status-badge status-connected';
      } else {
        statusBadge.textContent = '○ Conecte sua Conta';
        statusBadge.className = 'status-badge status-disconnected';
      }
    }
  }

  // Check if NoteOn is open or Cloud is connected
  chrome.runtime.sendMessage({ action: 'CHECK_NOTEON_STATUS' }, (res) => {
    updateCloudUI(res && res.cloudUser, res && res.hasOpenTab);
  });

  if (btnCloudLogin) {
    btnCloudLogin.addEventListener('click', () => {
      const email = (cloudEmailInput.value || '').trim();
      const password = cloudPassInput.value || '';
      if (!email || !password) {
        toast.style.display = 'block';
        toast.textContent = 'Preencha seu e-mail e senha.';
        return;
      }
      btnCloudLogin.disabled = true;
      btnCloudLogin.textContent = 'Conectando...';
      chrome.runtime.sendMessage(
        { action: 'EXTENSION_CLOUD_LOGIN', email, password },
        (res) => {
          btnCloudLogin.disabled = false;
          btnCloudLogin.textContent = 'Conectar Extensão na Nuvem';
          if (res && res.success) {
            updateCloudUI(res.user, false);
            toast.style.display = 'block';
            toast.textContent = '✓ Extensão conectada na nuvem!';
          } else {
            toast.style.display = 'block';
            toast.textContent = (res && res.error) || 'Erro ao conectar.';
          }
        }
      );
    });
  }

  if (btnCloudLogout) {
    btnCloudLogout.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'EXTENSION_CLOUD_LOGOUT' }, () => {
        updateCloudUI(null, false);
      });
    });
  }

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
