// ===== Canvas constants =====
// Canvas size matches the template image (1280×960)
const CANVAS_W = 1280;
const CANVAS_H = 960;
const CREAM = '#FFFDE8';

// Photo slot (left cream panel in template)
const PHOTO = {
  x: 78,
  y: 203,
  w: 508,
  h: 687,
};

// Right panels: text content areas (calibrate with tools/calibrate.html)
// x,y = top-left of text area (below the label tab), w,h = text area size
const PANELS = [
  { key: 'encounter', x: 670, y: 231, w: 540, h: 157 },
  { key: 'feature',   x: 670, y: 482, w: 540, h: 154 },
  { key: 'appeal',    x: 670, y: 741, w: 540, h: 148 },
];

// ===== Font options =====
const FONT_OPTIONS = [
  { id: 'zen',    label: 'まる',      css: '"Zen Maru Gothic", sans-serif' },
  { id: 'hachi',  label: 'ぽわぽわ',  css: '"Hachi Maru Pop", cursive' },
  { id: 'klee',   label: 'てがき',    css: '"Klee One", cursive' },
  { id: 'noto',   label: 'すっきり',  css: '"Noto Sans JP", sans-serif' },
  { id: 'mplus',  label: 'ふんわり',  css: '"M PLUS Rounded 1c", sans-serif' },
  { id: 'stick',  label: 'レトロ',    css: '"Stick", sans-serif' },
  { id: 'reggae', label: 'ポップ',    css: '"Reggae One", cursive' },
];

// ===== State =====
const state = {
  photo: {
    original: null,
    processed: null,
    objectUrl: null,
    transform: { scale: 100, x: 0, y: 0 },
  },
  texts: { encounter: '', feature: '', appeal: '' },
  font: 'zen',
  bgRemoveEnabled: false,
  bgRemover: null,
};

let _bgRemovalInFlight = 0;
let _wanderTimer = null;

function startWander(icon) {
  const ICON = 72;
  function move() {
    const w = uploadSlot.clientWidth - ICON;
    const h = uploadSlot.clientHeight - ICON;
    icon.style.left = Math.random() * w + 'px';
    icon.style.top  = Math.random() * h + 'px';
  }
  move();
  _wanderTimer = setInterval(move, 4000);
}

function stopWander() {
  clearInterval(_wanderTimer);
  _wanderTimer = null;
}

// ===== DOM refs =====
const $ = sel => document.querySelector(sel);
const uploadSlot     = $('#upload-slot');
const fileInput      = $('#file-input');
const btnToCrop      = $('#btn-to-crop');
const btnToEdit      = $('#btn-to-edit');
const btnBackUpload  = $('#btn-back-upload');
const btnBackCrop    = $('#btn-back-crop');
const btnGenerate    = $('#btn-generate');
const btnDownload    = $('#btn-download');
const btnShare       = $('#btn-share');
const btnRestart     = $('#btn-restart');
const bgRemoveToggle = $('#bg-remove-toggle');
const editorWrap     = $('#editor-canvas-wrap');
const progressBar    = $('#bg-progress');
const progressFill   = $('#bg-progress-fill');

// ===== Image cache =====
const _imgCache = new Map();

function revokeSlotUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  _imgCache.delete(url);
}

function loadImg(url) {
  if (_imgCache.has(url)) return Promise.resolve(_imgCache.get(url));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { _imgCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// Preload template
loadImg('./template.png').catch(() => {});

// ===== Canvas helpers =====
function calcLines(ctx, text, maxWidth) {
  const result = [];
  for (const raw of text.split('\n')) {
    if (!raw) { result.push(''); continue; }
    let line = '';
    for (const ch of raw) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        result.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

// ===== Template drawing =====
async function drawTemplate(ctx, scale) {
  await document.fonts.ready;
  const s = v => v * scale;

  // Draw template image as base
  try {
    const tmpl = await loadImg('./template.png');
    ctx.drawImage(tmpl, 0, 0, s(CANVAS_W), s(CANVAS_H));
  } catch {
    ctx.fillStyle = '#4AADAD';
    ctx.fillRect(0, 0, s(CANVAS_W), s(CANVAS_H));
  }

  // Draw user photo
  if (state.photo.objectUrl) {
    await drawPhotoSlot(ctx, scale);
  }

  // Draw text for each panel (auto font size + vertically centered)
  const fontCss = FONT_OPTIONS.find(f => f.id === state.font)?.css ?? '"Zen Maru Gothic", sans-serif';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (const panel of PANELS) {
    const text = state.texts[panel.key];
    if (!text || !text.trim()) continue;
    const padX = s(20);
    const maxW = s(panel.w) - padX * 2;
    const maxH = s(panel.h);

    // Binary search for largest font size that fits within panel height
    let lo = s(11), hi = s(26), bestSize = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      ctx.font = `${mid}px ${fontCss}`;
      const lineH = mid * 1.55;
      const lines = calcLines(ctx, text, maxW);
      if (lines.length * lineH <= maxH) { bestSize = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }

    ctx.font = `${bestSize}px ${fontCss}`;
    const lineH = bestSize * 1.55;
    const lines = calcLines(ctx, text, maxW);
    const totalH = lines.length * lineH;
    const startY = s(panel.y) + (maxH - totalH) / 2;
    const centerX = s(panel.x) + s(panel.w) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, centerX, startY + i * lineH);
    });
  }
}

function drawPhotoSlot(ctx, scale) {
  const s = v => v * scale;
  if (!state.photo.objectUrl) return Promise.resolve();
  return loadImg(state.photo.objectUrl).then(img => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s(PHOTO.x), s(PHOTO.y), s(PHOTO.w), s(PHOTO.h));
    ctx.clip();
    ctx.fillStyle = '#ffffe7';
    ctx.fillRect(s(PHOTO.x), s(PHOTO.y), s(PHOTO.w), s(PHOTO.h));
    const t = state.photo.transform;
    const imgScale = t.scale / 100;
    const sw = s(PHOTO.w), sh = s(PHOTO.h);
    const fitScale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * imgScale;
    const drawH = img.naturalHeight * fitScale * imgScale;
    const dx = s(PHOTO.x) + (sw - drawW) / 2 + t.x * (sw / 300);
    const dy = s(PHOTO.y) + (sh - drawH) / 2 + t.y * (sh / 400);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  }).catch(() => {});
}

// ===== Preview =====
async function renderPreview() {
  const canvas = $('#preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const area = $('#preview-area');
  const areaW = area.clientWidth - 24;
  const scale = areaW / CANVAS_W;
  canvas.width = areaW;
  canvas.height = Math.round(CANVAS_H * scale);
  canvas.style.width = '100%';
  await drawTemplate(ctx, scale);
}


// ===== Background removal =====
async function loadBgRemover() {
  if (state.bgRemover) return state.bgRemover;
  showToast('準備しています…少々お待ちください');
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
    state.bgRemover = mod;
    return mod;
  } catch {
    showToast('⚠️ 背景除去の準備に失敗しました');
    return null;
  }
}

async function processBackgroundRemoval(file) {
  uploadSlot.classList.add('has-image');
  uploadSlot.querySelector('.placeholder').innerHTML =
    '<img src="icon.png" class="wandering-icon" alt=""><span class="removing-label">切り抜き中...</span>';
  uploadSlot.querySelector('.placeholder').style.display = '';
  uploadSlot.classList.add('is-removing');
  startWander(uploadSlot.querySelector('.wandering-icon'));
  progressBar.classList.add('active');
  progressFill.style.width = '0%';
  _bgRemovalInFlight++;

  let succeeded = false;
  try {
    const mod = await loadBgRemover();
    if (!mod) {
      if (state.photo.original === file && state.bgRemoveEnabled) fallbackToOriginal(file);
      return false;
    }
    const blob = await mod.removeBackground(file, {
      model: 'isnet_fp16',
      progress: (key, current, total) => {
        if (total > 0) progressFill.style.width = Math.round((current / total) * 100) + '%';
      },
    });
    if (state.photo.original === file && state.bgRemoveEnabled) {
      revokeSlotUrl(state.photo.objectUrl);
      state.photo.processed = blob;
      state.photo.objectUrl = URL.createObjectURL(blob);
      updatePhotoUI();
      succeeded = true;
    }
  } catch {
    if (state.photo.original === file && state.bgRemoveEnabled) {
      fallbackToOriginal(file);
      showToast('⚠️ 切り抜きできなかったので元の画像を使います');
    }
  } finally {
    _bgRemovalInFlight--;
    if (_bgRemovalInFlight === 0) {
      progressBar.classList.remove('active');
      uploadSlot.classList.remove('is-removing');
      stopWander();
    }
  }
  return succeeded;
}

function fallbackToOriginal(file) {
  revokeSlotUrl(state.photo.objectUrl);
  state.photo.processed = file;
  state.photo.objectUrl = URL.createObjectURL(file);
  updatePhotoUI();
}

// ===== File handling =====
async function handleFileSelect(file) {
  if (!file) return;
  revokeSlotUrl(state.photo.objectUrl);
  state.photo.original = file;
  state.photo.transform = { scale: 100, x: 0, y: 0 };
  if (state.bgRemoveEnabled) {
    const ok = await processBackgroundRemoval(file);
    if (ok) showToast('切り抜き完了！');
  } else {
    state.photo.processed = file;
    state.photo.objectUrl = URL.createObjectURL(file);
    updatePhotoUI();
    showToast('画像を追加しました！');
  }
  btnToCrop.disabled = !state.photo.objectUrl;
}

function removePhoto() {
  stopWander();
  uploadSlot.classList.remove('is-removing');
  progressBar.classList.remove('active');
  revokeSlotUrl(state.photo.objectUrl);
  state.photo.original = null;
  state.photo.processed = null;
  state.photo.objectUrl = null;
  state.photo.transform = { scale: 100, x: 0, y: 0 };
  updatePhotoUI();
  btnToCrop.disabled = true;
}

function updatePhotoUI() {
  const existing = uploadSlot.querySelector(':scope > img');
  if (existing) existing.remove();
  if (state.photo.objectUrl) {
    uploadSlot.classList.add('has-image');
    uploadSlot.querySelector('.placeholder').style.display = 'none';
    const img = document.createElement('img');
    img.src = state.photo.objectUrl;
    uploadSlot.appendChild(img);
  } else {
    uploadSlot.classList.remove('has-image');
    uploadSlot.querySelector('.placeholder').style.display = '';
    uploadSlot.querySelector('.placeholder').innerHTML =
      '<img src="icon.png" class="upload-icon" alt=""><span>タップして写真を追加</span>';
  }
}

// Upload slot events
uploadSlot.addEventListener('click', e => {
  if (e.target.closest('.remove-btn')) return;
  fileInput.click();
});
fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  handleFileSelect(f);
});
uploadSlot.querySelector('.remove-btn').addEventListener('click', e => {
  e.stopPropagation();
  removePhoto();
});

// BG remove toggle
bgRemoveToggle.addEventListener('change', async () => {
  state.bgRemoveEnabled = bgRemoveToggle.checked;
  if (state.bgRemoveEnabled && state.photo.original && state.photo.processed === state.photo.original && _bgRemovalInFlight === 0) {
    await processBackgroundRemoval(state.photo.original);
  } else if (!state.bgRemoveEnabled && state.photo.original && state.photo.processed !== state.photo.original) {
    revokeSlotUrl(state.photo.objectUrl);
    state.photo.processed = state.photo.original;
    state.photo.objectUrl = URL.createObjectURL(state.photo.original);
    updatePhotoUI();
  }
});

// ===== Editor (Step 2) =====
let dragStart = null;

function initEditorUI() {
  const t = state.photo.transform;
  $('#edit-scale').value = t.scale;
  $('#edit-scale-val').textContent = t.scale + '%';
  $('#edit-x').value = t.x;
  $('#edit-y').value = t.y;
  editorWrap.style.aspectRatio = `${PHOTO.w} / ${PHOTO.h}`;
}

function renderEditorCanvas() {
  if (!state.photo.objectUrl) return;
  const canvas = $('#editor-canvas');
  const ctx = canvas.getContext('2d');
  const w = editorWrap.clientWidth;
  const h = editorWrap.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  const nw = Math.round(w * dpr);
  const nh = Math.round(h * dpr);
  if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; }

  loadImg(state.photo.objectUrl).then(img => {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, w, h);
    const t = state.photo.transform;
    const imgScale = t.scale / 100;
    const fitScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * imgScale;
    const drawH = img.naturalHeight * fitScale * imgScale;
    const dx = (w - drawW) / 2 + t.x * (w / 300);
    const dy = (h - drawH) / 2 + t.y * (h / 400);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    drawCropFrame(ctx, w, h);
    ctx.restore();
  }).catch(() => {});
}

function drawCropFrame(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 6;
  ctx.setLineDash([]);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#e84040';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.restore();

  const B = Math.min(22, w * 0.1);
  ctx.save();
  ctx.strokeStyle = '#e84040';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.lineCap = 'square';
  [[0,0,B,0,0,B],[w,0,w-B,0,w,B],[0,h,B,h,0,h-B],[w,h,w-B,h,w,h-B]].forEach(([px,py,ax,ay,bx,by]) => {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  });
  ctx.restore();

  const label = '← この枠内に収まります →';
  const fh = Math.max(10, Math.round(w * 0.04));
  ctx.save();
  ctx.font = `bold ${fh}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(w * .1, h - fh * 2.2, w * .8, fh * 1.8);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, w / 2, h - fh * 0.4);
  ctx.restore();
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

editorWrap.addEventListener('pointerdown', e => {
  const t = state.photo.transform;
  dragStart = { x: e.clientX, y: e.clientY, origX: t.x, origY: t.y, w: editorWrap.clientWidth, h: editorWrap.clientHeight };
  editorWrap.setPointerCapture(e.pointerId);
});
editorWrap.addEventListener('pointermove', e => {
  if (!dragStart) return;
  const t = state.photo.transform;
  t.x = clamp(dragStart.origX + (e.clientX - dragStart.x) * (300 / dragStart.w), -300, 300);
  t.y = clamp(dragStart.origY + (e.clientY - dragStart.y) * (400 / dragStart.h), -300, 300);
  $('#edit-x').value = t.x;
  $('#edit-y').value = t.y;
  renderEditorCanvas();
});
editorWrap.addEventListener('pointerup', () => { dragStart = null; });
editorWrap.addEventListener('pointercancel', () => { dragStart = null; });

$('#edit-scale').addEventListener('input', e => {
  const val = parseInt(e.target.value);
  state.photo.transform.scale = val;
  $('#edit-scale-val').textContent = val + '%';
  renderEditorCanvas();
});
$('#edit-x').addEventListener('input', e => {
  state.photo.transform.x = parseInt(e.target.value);
  renderEditorCanvas();
});
$('#edit-y').addEventListener('input', e => {
  state.photo.transform.y = parseInt(e.target.value);
  renderEditorCanvas();
});


// ===== Font selector =====
(function initFontSelector() {
  const container = document.getElementById('font-chips');
  if (!container) return;
  FONT_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'font-chip' + (opt.id === state.font ? ' active' : '');
    btn.dataset.font = opt.id;
    btn.style.fontFamily = opt.css;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      state.font = opt.id;
      container.querySelectorAll('.font-chip').forEach(b => b.classList.toggle('active', b.dataset.font === opt.id));
      renderPreview();
    });
    container.appendChild(btn);
  });
})();

// ===== Text area sync =====
let _previewTimer;
['encounter', 'feature', 'appeal'].forEach(key => {
  const el = $(`#text-${key}`);
  el.addEventListener('input', () => {
    state.texts[key] = el.value;
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(renderPreview, 500);
  });
});

// ===== Navigation =====
function showStep(n) {
  ['step-upload', 'step-crop', 'step-edit', 'step-result'].forEach((id, i) => {
    $(`#${id}`).classList.toggle('hidden', i + 1 !== n);
  });
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done', i + 1 < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnToCrop.addEventListener('click', () => {
  showStep(2);
  initEditorUI();
  renderEditorCanvas();
});
btnToEdit.addEventListener('click', () => {
  showStep(3);
  renderPreview();
});
btnBackUpload.addEventListener('click', () => showStep(1));
btnBackCrop.addEventListener('click', () => {
  showStep(2);
  initEditorUI();
  renderEditorCanvas();
});
btnRestart.addEventListener('click', () => {
  removePhoto();
  state.texts = { encounter: '', feature: '', appeal: '' };
  ['encounter', 'feature', 'appeal'].forEach(k => { $(`#text-${k}`).value = ''; });
  bgRemoveToggle.checked = false;
  state.bgRemoveEnabled = false;
  showStep(1);
});

// ===== Generate =====
btnGenerate.addEventListener('click', async () => {
  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span> 生成中...';
  try {
    const canvas = $('#result-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    await drawTemplate(ctx, 1);
    showStep(4);
  } catch (err) {
    console.error(err);
    showToast('生成に失敗しました');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '🎉 図鑑カードを生成';
  }
});

// ===== Download =====
btnDownload.addEventListener('click', () => {
  const canvas = $('#result-canvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temanuizukan-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ダウンロードしました！ 📥');
  }, 'image/png');
});

btnShare.addEventListener('click', () => {
  const text = '#てまぬい図鑑 #初星学園ぬいぬい部';
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});

// ===== Resize =====
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (!$('#step-edit').classList.contains('hidden')) renderPreview();
  }, 200);
});

// ===== Toast =====
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
