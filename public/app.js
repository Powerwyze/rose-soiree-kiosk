/* ================================================================
 *  Dan's Rosé Soirée · Watercolor Portrait Kiosk
 *  Portrait-mobile · Photo Booth + Email Delivery + Job Queue
 * ================================================================ */

(function(){
  'use strict';

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

  const emailModal      = $('#emailModal');
  const emailModalInput = $('#emailModalInput');
  const emailModalErr   = $('#emailModalErr');
  const emailModalOk    = $('#emailModalOk');
  const emailModalCancel= $('#emailModalCancel');

  const genPill         = $('#genPill');
  const resModal        = $('#resModal');
  const resModalImg     = $('#resModalImg');
  const resModalTimer   = $('#resModalTimer');
  const toaster         = $('#toaster');

  // ---------- State ----------
  let stream = null;
  let capturedBlob = null;
  let activeJobs = 0;
  let resModalTimerId = null;

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

  // ---------- Panel switching ----------
  function showHero(){
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

  // ---------- Capture flow ----------
  function runCountdown(seconds){
    return new Promise(resolve => {
      let n = seconds;
      boothCountdown.hidden = false;
      boothCountdown.textContent = String(n);
      const tick = setInterval(() => {
        n -= 1;
        if (n <= 0){
          clearInterval(tick);
          boothCountdown.hidden = true;
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

    // Target 9:16 crop centered on the video frame
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

    // Output up to 1080x1920 (downscale only)
    const outW = Math.min(1080, cropW);
    const outH = Math.round(outW * 16 / 9);

    boothCanvas.width  = outW;
    boothCanvas.height = outH;
    const ctx = boothCanvas.getContext('2d');
    // Mirror to match the preview
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
      // Show preview
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
      boothCapture.disabled = false;
    }
  }

  function doRetake(){
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

  // ---------- Email modal ----------
  function openEmailModal(){
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

    let remaining = 15;
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
  }
  resModal.addEventListener('click', closeResultModal);

  // ---------- Generation job ----------
  async function runGenerationJob(blob, email){
    activeJobs += 1;
    updateQueueIndicator();
    genPill.classList.add('is-active');
    genPill.setAttribute('aria-hidden', 'false');

    try {
      const fd = new FormData();
      fd.append('image', blob, 'capture.jpg');
      fd.append('email', email);

      const res = await fetch('/api/banana', { method: 'POST', body: fd });
      if (!res.ok){
        const text = await res.text().catch(() => '');
        throw new Error(text || `Painter error (${res.status})`);
      }
      const imageBuf = await res.arrayBuffer();
      const imageBlob = new Blob([imageBuf], { type: 'image/png' });
      const imageUrl  = URL.createObjectURL(imageBlob);

      // Send to email
      const b64 = await blobToBase64(imageBlob);
      const sendRes = await fetch('/api/send-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          filename: 'rose-soiree-portrait.png',
          mimeType: 'image/png',
          imageBase64: b64,
        }),
      });

      const sentOk = sendRes.ok;
      if (!sentOk){
        const errText = await sendRes.text().catch(() => '');
        console.error('send-photo error', sendRes.status, errText);
      }

      openResultModal(imageUrl);
      toast(
        sentOk
          ? `✦ Portrait sent to <strong>${escapeHtml(email)}</strong>`
          : `Portrait painted — but email send to <strong>${escapeHtml(email)}</strong> failed. Try again.`,
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
      }
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
    openEmailModal();
  });

  emailModalCancel.addEventListener('click', closeEmailModal);
  emailModalOk.addEventListener('click', () => {
    const email = (emailModalInput.value || '').trim();
    if (!isEmail(email)){
      emailModalErr.textContent = 'Please enter a valid email address.';
      return;
    }
    emailModalErr.textContent = '';
    closeEmailModal();

    // Kick off background job
    const blob = capturedBlob;
    capturedBlob = null;
    runGenerationJob(blob, email);

    // Reset booth so the next guest can shoot
    doRetake();
  });
  emailModalInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') emailModalOk.click();
  });

  // Pause camera when tab is hidden to save power
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
    else if (!heroPanel.hasAttribute('hidden')) {} else startCamera();
  });

  // ---------- Init ----------
  showHero();
})();
