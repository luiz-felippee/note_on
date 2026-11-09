// NoteOn Chrome Extension - Popup script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const btnCapture = document.getElementById('btnCapture');
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

  // Capture button click
  btnCapture.addEventListener('click', () => {
    btnCapture.disabled = true;
    btnCapture.textContent = 'Capturando...';

    chrome.runtime.sendMessage({ action: 'TRIGGER_CAPTURE' }, (res) => {
      btnCapture.disabled = false;
      btnCapture.innerHTML = '📸 Tirar Print Desta Aba';

      if (res && res.success) {
        toast.style.display = 'block';
        toast.textContent = '✓ Print enviado para o NoteOn!';
        toast.className = 'toast-msg toast-success';
        setTimeout(() => {
          window.close();
        }, 1200);
      } else if (res && res.reason === 'no_noteon_tab') {
        toast.style.display = 'block';
        toast.textContent = 'Salvo na fila! Abra o NoteOn.';
        toast.className = 'toast-msg status-disconnected';
      } else {
        toast.style.display = 'block';
        toast.textContent = 'Erro ao capturar aba.';
        toast.className = 'toast-msg status-disconnected';
      }
    });
  });
});
