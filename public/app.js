/* ================================================================
 *  Bartenura Rosé Soirée · Watercolor Portrait Kiosk
 *  Portrait-mobile · Instagram-first · Optional email delivery
 * ================================================================ */

(function(){
  'use strict';

  // ===============================================================
  // EVENT HASHTAG — placeholder; update once Kelly-Ann confirms.
  // Change the value here only; it's auto-rendered everywhere
  // (`[data-hashtag]` in DOM, plus the stamped portrait overlay).
  // ===============================================================
  const EVENT_HASHTAG = '#BartenuraRose';
  const EVENT_HANDLE  = '@Bartenurablue';
  const LOGO_URL      = '/assets/bartenura-logo-white.png';

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------- Elements ----------
  const heroPanel       = $('#heroPanel');
  const boothPanel      = $('#boothPanel');
  const heroStart       = $('#heroStart');

  const boothCam        = $('#boothCam');
  const boothPreview    = $('#boothPreview');
  const boothCanvas     = $('#boothCanvas');
  const boothCountdown  = $('#boothCountdown');
  const boothFlash      = $('#boothFlash');
  const boothCapture    = $('#boothCapture');
  const boothRetake     = $('#boothRetake');
  const boothGenerate   = $('#boothGenerate');
  const boothErr        = $('#boothErr');
  const boothQueue      = $('#boothQueue');
  const boothBack       = $('#boothBack');

  const boothWait       = $('#boothWait');
  const boothWaitCopy   = $('#boothWaitCopy');

  const emailModal      = $('#emailModal');
  const emailModalInput = $('#emailModalInput');
  const emailModalErr   = $('#emailModalErr');
  const emailModalOk    = $('#emailModalOk');
  const emailModalCancel= $('#emailModalCancel');

  const genPill         = $('#genPill');
  const resModal        = $('#resModal');
  const resModalImg     = $('#resModalImg');
  const resModalStatus  = $('#resModalStatus');
  const resModalEmailBtn= $('#resModalEmailBtn');
  const resModalDone    = $('#resModalDone');
  const resModalTimer   = $('#resModalTimer');
  const toaster         = $('#toaster');

  // ---------- State ----------
  let stream = null;
  let capturedBlob = null;
  let activeJobs = 0;
  let resModalTimerId = null;
  let countdownTickId = null;
  let lastResultBlob = null;     // for optional email-after-the-fact

  // Cached logo image for stamping
  let cachedLogo = null;

  // ---------- Helpers ----------
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

  function showError(msg){
    boothErr.textContent = msg || '';
  }

  function toast(html, ms){
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    toaster.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 260);
    }, ms || 5500);
  }

  function updateQueueIndicator(){
    if (activeJobs > 0){
      const word = activeJobs === 1 ? 'portrait' : 'portraits';
      boothQueue.textContent = `✦ ${activeJobs} ${word} painting in the background — next guest can step up`;
      boothQueue.classList.add('is-active');
    } else {
      boothQueue.classList.remove('is-active');
      boothQueue.textContent = '';
    }
  }

  // Inject the configured hashtag everywhere it's referenced in markup
  function applyHashtagToDom(){
    $$('[data-hashtag]').forEach(el => { el.textContent = EVENT_HASHTAG; });
  }

  // ---------- Panel switching ----------
  function showHero(){
    hideCountdown();
    hideWaitVideo();
    boothPanel.setAttribute('hidden', '');
    heroPanel.removeAttribute('hidden');
    stopCamera();
  }
  function showBooth(){
    heroPanel.setAttribute('hidden', '');
    boothPanel.removeAttribute('hidden');
    startCamera();
  }

  // ---------- Camera ----------
  async function startCamera(){
    showError('');
    if (stream) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9/16 },
        },
        audio: false,
      });
      boothCam.srcObject = stream;
      boothCam.hidden = false;
      boothPreview.hidden = true;
      boothPreview.src = '';
      capturedBlob = null;
      boothCapture.hidden = false;
      boothRetake.hidden = true;
      boothGenerate.hidden = true;
    } catch (e){
      console.error('camera error', e);
      showError("Camera access blocked. Please enable camera permissions.");
    }
  }

  function stopCamera(){
    if (!stream) return;
    try { stream.getTracks().forEach(t => t.stop()); } catch (_){}
    stream = null;
    boothCam.srcObject = null;
  }

  // ---------- Wait video ----------
  // While the wait video is visible we also force the live camera + captured
  // preview off-screen so nothing can sit on top of the rose loop.
  function showWaitVideo(){
    if (!boothWait) return;
    boothCam.hidden = true;
    boothPreview.hidden = true;
    boothWait.hidden = false;
    boothWaitCopy.hidden = false;
    try {
      boothWait.currentTime = 0;
      const p = boothWait.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay failed (rare with muted+playsinline). The poster copy
          // overlay remains visible so guests still see the wait state.
        });
      }
    } catch (_) {}
  }
  function hideWaitVideo(){
    if (!boothWait) return;
    try { boothWait.pause(); } catch (_) {}
    boothWait.hidden = true;
    boothWaitCopy.hidden = true;
    // Restore the live camera viewfinder + capture button so the next guest
    // can step up immediately. Only do this if we aren't currently showing a
    // captured still (preview attribute present means user is mid-flow).
    const previewSrc = boothPreview.getAttribute('src');
    if (!previewSrc){
      boothCam.hidden = false;
      boothCapture.hidden = false;
      boothRetake.hidden = true;
      boothGenerate.hidden = true;
    }
  }

  // ---------- Capture flow ----------
  function hideCountdown(){
    if (countdownTickId !== null){
      clearInterval(countdownTickId);
      countdownTickId = null;
    }
    boothCountdown.hidden = true;
    boothCountdown.textContent = '';
  }

  function runCountdown(seconds){
    return new Promise(resolve => {
      hideCountdown();
      let n = seconds;
      boothCountdown.hidden = false;
      boothCountdown.textContent = String(n);
      countdownTickId = setInterval(() => {
        n -= 1;
        if (n <= 0){
          hideCountdown();
          resolve();
        } else {
          boothCountdown.textContent = String(n);
        }
      }, 1000);
    });
  }

  function flash(){
    boothFlash.classList.add('is-flash');
    setTimeout(() => boothFlash.classList.remove('is-flash'), 200);
  }

  async function captureFrame(){
    const v = boothCam;
    if (!v.videoWidth || !v.videoHeight) throw new Error('Camera not ready');

    const srcW = v.videoWidth, srcH = v.videoHeight;
    const targetAspect = 9 / 16;
    let cropW, cropH;
    if (srcW / srcH > targetAspect){
      cropH = srcH;
      cropW = Math.round(srcH * targetAspect);
    } else {
      cropW = srcW;
      cropH = Math.round(srcW / targetAspect);
    }
    const sx = Math.round((srcW - cropW) / 2);
    const sy = Math.round((srcH - cropH) / 2);

    const outW = Math.min(1080, cropW);
    const outH = Math.round(outW * 16 / 9);

    boothCanvas.width  = outW;
    boothCanvas.height = outH;
    const ctx = boothCanvas.getContext('2d');
    ctx.save();
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, cropW, cropH, 0, 0, outW, outH);
    ctx.restore();

    const blob = await new Promise(res => boothCanvas.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Could not encode frame');
    return blob;
  }

  async function doCapture(){
    showError('');
    boothCapture.disabled = true;
    try {
      await runCountdown(5);
      flash();
      capturedBlob = await captureFrame();
      const url = URL.createObjectURL(capturedBlob);
      boothPreview.src = url;
      boothPreview.hidden = false;
      boothCam.hidden = true;
      boothCapture.hidden = true;
      boothRetake.hidden = false;
      boothGenerate.hidden = false;
    } catch (e){
      console.error('capture error', e);
      showError('Capture failed — please try again.');
    } finally {
      hideCountdown();
      boothCapture.disabled = false;
    }
  }

  function doRetake(){
    hideCountdown();
    hideWaitVideo();
    if (boothPreview.src) URL.revokeObjectURL(boothPreview.src);
    boothPreview.src = '';
    boothPreview.hidden = true;
    boothCam.hidden = false;
    capturedBlob = null;
    boothCapture.hidden = false;
    boothRetake.hidden = true;
    boothGenerate.hidden = true;
    showError('');
  }

  // ---------- Email modal (optional, post-result) ----------
  function openEmailModal(){
    hideCountdown();
    emailModalErr.textContent = '';
    emailModal.classList.add('is-open');
    emailModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => emailModalInput.focus(), 80);
  }
  function closeEmailModal(){
    emailModal.classList.remove('is-open');
    emailModal.setAttribute('aria-hidden', 'true');
  }

  // ---------- Result modal ----------
  function openResultModal(imageUrl){
    resModalImg.src = imageUrl;
    resModal.classList.add('is-open');
    resModal.setAttribute('aria-hidden', 'false');
    resModalStatus.hidden = true;

    let remaining = 30; // longer so guests have time to scan
    resModalTimer.textContent = String(remaining);
    clearInterval(resModalTimerId);
    resModalTimerId = setInterval(() => {
      remaining -= 1;
      resModalTimer.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) closeResultModal();
    }, 1000);
  }
  function closeResultModal(){
    resModal.classList.remove('is-open');
    resModal.setAttribute('aria-hidden', 'true');
    clearInterval(resModalTimerId);
    resModalTimerId = null;
    if (resModalImg.src && resModalImg.src.startsWith('blob:')){
      URL.revokeObjectURL(resModalImg.src);
    }
    resModalImg.src = '';
    lastResultBlob = null;
  }

  // ---------- Generation job ----------
  async function runGenerationJob(blob){
    activeJobs += 1;
    updateQueueIndicator();
    genPill.classList.add('is-active');
    genPill.setAttribute('aria-hidden', 'false');
    showWaitVideo();

    try {
      const fd = new FormData();
      fd.append('image', blob, 'capture.jpg');
      // email is intentionally optional now; pass empty so server is happy
      fd.append('email', '');

      const res = await fetch('/api/banana', { method: 'POST', body: fd });
      if (!res.ok){
        const text = await res.text().catch(() => '');
        throw new Error(text || `Painter error (${res.status})`);
      }
      const imageBuf = await res.arrayBuffer();
      const rawBlob  = new Blob([imageBuf], { type: 'image/png' });
      const imageBlob = await stampBranding(rawBlob);
      const imageUrl  = URL.createObjectURL(imageBlob);

      lastResultBlob = imageBlob;
      openResultModal(imageUrl);
      toast(
        `✦ Portrait painted — scan & tag ${EVENT_HASHTAG} on Instagram`,
        6500
      );
    } catch (e){
      console.error('generation error', e);
      toast(`Painter error: ${escapeHtml(String(e.message || e))}`, 7000);
    } finally {
      activeJobs -= 1;
      if (activeJobs < 0) activeJobs = 0;
      updateQueueIndicator();
      if (activeJobs === 0){
        genPill.classList.remove('is-active');
        genPill.setAttribute('aria-hidden', 'true');
        hideWaitVideo();
      }
    }
  }

  async function sendPortraitEmail(email, imageBlob){
    const b64 = await blobToBase64(imageBlob);
    const sendRes = await fetch('/api/send-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        filename: 'bartenura-rose-portrait.png',
        mimeType: 'image/png',
        imageBase64: b64,
      }),
    });
    return sendRes.ok;
  }

  // ---------- Branding overlay on generated image ----------
  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function loadImageFromBlob(blob){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function getLogo(){
    if (cachedLogo) return cachedLogo;
    try {
      cachedLogo = await loadImage(LOGO_URL);
      return cachedLogo;
    } catch (_) {
      return null;
    }
  }

  // The generated artwork already contains the BARTENURA ROSÉ headline and the
  // Bartenura / Château Roubine bottom wordmarks (per the reference scene), so
  // we only add a small, unobtrusive corner pill with the IG handle + hashtag
  // — no top-band logo, no full-width bottom strip — to avoid covering or
  // duplicating the painted typography and the two bottles in the foreground.
  async function stampBranding(blob){
    try {
      const img = await loadImageFromBlob(blob);
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);

      // Small pill in the lower-right corner: @handle + #hashtag
      const pad = Math.round(H * 0.012);
      const fontMain = Math.round(H * 0.016);
      const fontSub  = Math.round(H * 0.013);

      ctx.font = `700 ${fontMain}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      const handleText = EVENT_HANDLE;
      const tagText    = EVENT_HASHTAG;
      const handleW = ctx.measureText(handleText).width;
      ctx.font = `600 ${fontSub}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      const tagW = ctx.measureText(tagText).width;

      const pillW = Math.round(Math.max(handleW, tagW) + pad * 2.6);
      const pillH = Math.round(fontMain + fontSub + pad * 2.2);
      const pillX = W - pillW - Math.round(W * 0.035);
      const pillY = H - pillH - Math.round(H * 0.028);
      const r = Math.round(pillH * 0.32);

      ctx.save();
      ctx.fillStyle = 'rgba(10, 6, 8, 0.62)';
      ctx.strokeStyle = 'rgba(240, 166, 192, 0.55)';
      ctx.lineWidth = Math.max(1, Math.round(H * 0.0012));
      ctx.beginPath();
      ctx.moveTo(pillX + r, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
      ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = pillX + pillW / 2;
      ctx.font = `700 ${fontMain}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = '#f6e9dc';
      ctx.fillText(handleText, cx, pillY + pad + fontMain * 0.55);
      ctx.font = `600 ${fontSub}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = '#ff9ec1';
      ctx.fillText(tagText, cx, pillY + pad + fontMain + fontSub * 0.65);

      const stamped = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return stamped || blob;
    } catch (e){
      console.error('stampBranding error', e);
      return blob;
    }
  }

  function blobToBase64(blob){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        const comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Wire up ----------
  heroStart.addEventListener('click', showBooth);
  boothBack.addEventListener('click', showHero);

  boothCapture.addEventListener('click', doCapture);
  boothRetake .addEventListener('click', doRetake);
  boothGenerate.addEventListener('click', () => {
    if (!capturedBlob){ showError('Please take a photo first.'); return; }
    // Instagram-first: skip the email gate, kick off generation immediately.
    const blob = capturedBlob;
    capturedBlob = null;
    // Reset capture-related UI WITHOUT hiding the wait video or flipping the
    // camera back on. showWaitVideo() (called inside runGenerationJob) is what
    // governs visibility of cam/preview/wait while a job is in flight.
    if (boothPreview.src) URL.revokeObjectURL(boothPreview.src);
    boothPreview.src = '';
    boothCapture.hidden = true;
    boothRetake.hidden = true;
    boothGenerate.hidden = true;
    showError('');
    runGenerationJob(blob);
  });

  // Email-after-the-fact, opened from the result modal
  resModalEmailBtn.addEventListener('click', () => {
    if (!lastResultBlob){ toast('Portrait not ready yet — try again in a moment.'); return; }
    openEmailModal();
  });
  resModalDone.addEventListener('click', closeResultModal);

  emailModalCancel.addEventListener('click', closeEmailModal);
  emailModalOk.addEventListener('click', async () => {
    const email = (emailModalInput.value || '').trim();
    if (!isEmail(email)){
      emailModalErr.textContent = 'Please enter a valid email address.';
      return;
    }
    emailModalErr.textContent = '';
    emailModalOk.disabled = true;
    try {
      const ok = await sendPortraitEmail(email, lastResultBlob);
      closeEmailModal();
      if (ok){
        resModalStatus.hidden = false;
        resModalStatus.textContent = `✓ Sent to ${email}`;
        toast(`✦ Portrait sent to <strong>${escapeHtml(email)}</strong>`, 5500);
      } else {
        toast(`Email send failed — please try again.`, 6000);
      }
    } catch (e){
      console.error('email error', e);
      toast(`Email error: ${escapeHtml(String(e.message || e))}`, 6000);
    } finally {
      emailModalOk.disabled = false;
      emailModalInput.value = '';
    }
  });
  emailModalInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') emailModalOk.click();
  });

  // Pause camera when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCamera();
      try { if (boothWait) boothWait.pause(); } catch (_) {}
    } else if (!boothPanel.hasAttribute('hidden')) {
      startCamera();
      if (boothWait && !boothWait.hidden) { try { boothWait.play(); } catch (_) {} }
    }
  });

  // ---------- Init ----------
  applyHashtagToDom();
  // Preload logo for stamping
  getLogo().catch(()=>{});
  showHero();
})();
