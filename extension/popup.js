// NoteOn Chrome Extension - Popup script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
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

  // Snip Area
  btnSnipArea.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'TRIGGER_SNIP_AREA' }, () => {
      window.close();
    });
  });

  // Full Screen Capture
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
