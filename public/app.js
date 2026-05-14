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
  let countdownTickId = null;

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
    hideCountdown();
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
      hideCountdown();
      boothCapture.disabled = false;
    }
  }

  function doRetake(){
    hideCountdown();
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
      const rawBlob  = new Blob([imageBuf], { type: 'image/png' });
      const imageBlob = await stampBranding(rawBlob);
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

  // ---------- Branding overlay ----------
  // Stamps a top "Bartenura Rosé" title and a bottom brand strip with
  // BARTENURA ROSÉ + CHÂTEAU ROUBINE wordmarks onto the generated portrait,
  // so the elements are reliable even if the image model omits text.
  function loadImageFromBlob(blob){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

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

      // ---- Top title band: "Bartenura Rosé" ----
      const topBandH = Math.round(H * 0.11);
      const topGrad = ctx.createLinearGradient(0, 0, 0, topBandH);
      topGrad.addColorStop(0, 'rgba(255, 248, 250, 0.92)');
      topGrad.addColorStop(1, 'rgba(255, 248, 250, 0.0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, W, topBandH);

      const titleFontSize = Math.round(H * 0.058);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 italic ${titleFontSize}px "Playfair Display", "Cormorant Garamond", "Didot", "Times New Roman", serif`;
      // soft shadow for legibility
      ctx.shadowColor = 'rgba(120, 40, 70, 0.18)';
      ctx.shadowBlur = Math.round(H * 0.006);
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#7a2a47'; // deep rosé
      ctx.fillText('Bartenura Rosé', W / 2, topBandH * 0.55);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // tiny decorative rule under the title
      const ruleY = Math.round(topBandH * 0.92);
      const ruleW = Math.round(W * 0.22);
      ctx.strokeStyle = 'rgba(122, 42, 71, 0.55)';
      ctx.lineWidth = Math.max(1, Math.round(H * 0.0015));
      ctx.beginPath();
      ctx.moveTo((W - ruleW) / 2, ruleY);
      ctx.lineTo((W + ruleW) / 2, ruleY);
      ctx.stroke();

      // ---- Bottom brand strip ----
      const stripH = Math.round(H * 0.085);
      const stripY = H - stripH;
      // subtle ivory bar with a thin rose-gold rule on top
      ctx.fillStyle = 'rgba(252, 246, 240, 0.94)';
      ctx.fillRect(0, stripY, W, stripH);
      ctx.strokeStyle = 'rgba(180, 130, 110, 0.55)';
      ctx.lineWidth = Math.max(1, Math.round(H * 0.0018));
      ctx.beginPath();
      ctx.moveTo(0, stripY);
      ctx.lineTo(W, stripY);
      ctx.stroke();

      const brandFont = Math.round(H * 0.024);
      const tagFont   = Math.round(H * 0.013);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a1a26';

      // Left wordmark: BARTENURA ROSÉ
      const leftX = Math.round(W * 0.255);
      const midY  = stripY + stripH / 2;
      ctx.textAlign = 'center';
      ctx.font = `700 ${brandFont}px "Trajan Pro", "Cinzel", "Cormorant Garamond", "Times New Roman", serif`;
      ctx.fillText('BARTENURA', leftX, midY - brandFont * 0.5);
      ctx.font = `400 italic ${Math.round(brandFont * 0.9)}px "Playfair Display", "Cormorant Garamond", "Didot", serif`;
      ctx.fillStyle = '#7a2a47';
      ctx.fillText('Rosé', leftX, midY + brandFont * 0.55);

      // Center divider dot
      ctx.fillStyle = 'rgba(58, 26, 38, 0.55)';
      const dotR = Math.max(2, Math.round(H * 0.003));
      ctx.beginPath();
      ctx.arc(W / 2, midY, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Right wordmark: CHÂTEAU ROUBINE
      const rightX = Math.round(W * 0.745);
      ctx.fillStyle = '#3a1a26';
      ctx.font = `700 ${brandFont}px "Trajan Pro", "Cinzel", "Cormorant Garamond", "Times New Roman", serif`;
      ctx.fillText('CHÂTEAU ROUBINE', rightX, midY - brandFont * 0.5);
      ctx.font = `400 ${tagFont}px "Cormorant Garamond", "Times New Roman", serif`;
      ctx.fillStyle = 'rgba(58, 26, 38, 0.75)';
      ctx.fillText('CÔTES DE PROVENCE', rightX, midY + brandFont * 0.6);

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
