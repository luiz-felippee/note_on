// NoteOn Chrome Extension - Snipper Overlay Script
// Runs on ANY webpage when the user wants to select a region to screenshot

(function () {
  // Prevent duplicate overlays
  if (document.getElementById('noteon-snip-overlay')) {
    document.getElementById('noteon-snip-overlay').remove();
  }

  const dpr = window.devicePixelRatio || 1;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let selectionRect = null;

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'noteon-snip-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '2147483647';
  overlay.style.cursor = 'crosshair';
  overlay.style.userSelect = 'none';
  overlay.style.background = 'rgba(15, 23, 42, 0.45)';
  overlay.style.backdropFilter = 'blur(1px)';

  // Top Helper Banner
  const banner = document.createElement('div');
  banner.style.position = 'absolute';
  banner.style.top = '16px';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.background = '#090d16';
  banner.style.color = '#f8fafc';
  banner.style.padding = '8px 18px';
  banner.style.borderRadius = '999px';
  banner.style.border = '1px solid rgba(129, 140, 248, 0.4)';
  banner.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
  banner.style.fontSize = '12px';
  banner.style.fontWeight = '600';
  banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  banner.style.gap = '12px';
  banner.style.pointerEvents = 'auto';

  banner.innerHTML = `
    <span>📐 <strong>Arraste o mouse</strong> para marcar a área do slide</span>
    <span style="opacity: 0.4">|</span>
    <span style="font-size: 11px; color: #94a3b8;">Esc para cancelar</span>
    <button id="noteon-snip-full-btn" style="background: #4f46e5; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; margin-left: 6px;">Tela Inteira</button>
    <button id="noteon-snip-close-btn" style="background: transparent; color: #94a3b8; border: none; font-size: 16px; cursor: pointer; padding: 0 4px; line-height: 1;">✕</button>
  `;
  overlay.appendChild(banner);

  // Selection Box
  const box = document.createElement('div');
  box.id = 'noteon-snip-box';
  box.style.position = 'absolute';
  box.style.display = 'none';
  box.style.border = '2px solid #818cf8';
  box.style.boxShadow = '0 0 0 99999px rgba(15, 23, 42, 0.55)';
  box.style.borderRadius = '2px';
  box.style.background = 'transparent';
  box.style.pointerEvents = 'none';

  // Tooltip with dimensions
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.bottom = '-24px';
  tooltip.style.right = '0';
  tooltip.style.background = '#1e1b4b';
  tooltip.style.color = '#c7d2fe';
  tooltip.style.padding = '2px 6px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '10px';
  tooltip.style.fontFamily = 'monospace';
  tooltip.style.border = '1px solid rgba(129, 140, 248, 0.4)';
  box.appendChild(tooltip);
  overlay.appendChild(box);

  // Close handlers
  const cleanup = () => {
    window.removeEventListener('keydown', handleKey);
    overlay.remove();
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  window.addEventListener('keydown', handleKey);

  banner.querySelector('#noteon-snip-close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
  });

  banner.querySelector('#noteon-snip-full-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    captureFull();
  });

  // Mouse drag handlers
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === banner || banner.contains(e.target)) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    tooltip.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    selectionRect = { left, top, width, height };
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;

    if (selectionRect && selectionRect.width > 20 && selectionRect.height > 20) {
      cropAndDeliver(selectionRect);
    } else {
      box.style.display = 'none';
    }
  });

  // Capture full screen fallback
  function captureFull() {
    overlay.style.display = 'none';
    chrome.runtime.sendMessage({ action: 'CAPTURE_FULL_NOW' }, (res) => {
      cleanup();
      if (res && res.success) {
        showSuccessNotification();
      }
    });
  }

  // Crop image and send to NoteOn
  function cropAndDeliver(rect) {
    // Hide overlay and floating recorder so they are not captured in the screenshot
    overlay.style.display = 'none';
    const recorder = document.getElementById('noteon-floating-audio-recorder');
    if (recorder) recorder.style.display = 'none';

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'GET_RAW_SCREENSHOT' }, (response) => {
        if (recorder) recorder.style.display = 'flex';

        if (!response || !response.dataUrl) {
          cleanup();
          return;
        }

        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
              img,
              rect.left * dpr,
              rect.top * dpr,
              rect.width * dpr,
              rect.height * dpr,
              0,
              0,
              rect.width * dpr,
              rect.height * dpr
            );

            const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

            chrome.runtime.sendMessage(
              {
                action: 'DELIVER_CROPPED_CAPTURE',
                dataUrl: croppedDataUrl,
                pageTitle: document.title || 'Slide Marcado'
              },
              (res) => {
                cleanup();
                if (res && res.success) {
                  showSuccessNotification();
                }
              }
            );
          } catch (err) {
            console.error('Erro ao recortar imagem:', err);
            cleanup();
          }
        };
        img.src = response.dataUrl;
      });
    }, 100);
  }

  // Visual success feedback on current page
  function showSuccessNotification() {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '2147483647';
    toast.style.background = '#090d16';
    toast.style.color = '#34d399';
    toast.style.padding = '10px 18px';
    toast.style.borderRadius = '14px';
    toast.style.border = '1px solid rgba(16, 185, 129, 0.4)';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)';
    toast.style.fontSize = '12px';
    toast.style.fontWeight = 'bold';
    toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.transition = 'all 0.3s ease';

    toast.innerHTML = `
      <span style="font-size: 14px;">✓</span>
      <span>Área marcada salva no NoteOn!</span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 350);
    }, 2200);
  }

  document.body.appendChild(overlay);
})();

