const canvas = document.getElementById('sheet'), ctx = canvas.getContext('2d');
let image = null;

function blank() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1200, 1800); }
blank();

function loadFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => { image = im; status.textContent = 'Photo selected ✓'; render(); };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}
camera.onchange = e => loadFile(e.target.files[0]);
gallery.onchange = e => loadFile(e.target.files[0]);
[pw, ph].forEach(x => x.addEventListener('input', render));

function render() {
  blank();
  if (!image) return;
  const w = Math.min(2, Math.max(.5, +pw.value || 2)) * 300,
        h = Math.min(3, Math.max(.5, +ph.value || 2)) * 300,
        ratio = w / h;
  let sw = image.width, sh = image.height, sx = 0, sy = 0;
  if (image.width / image.height > ratio) { sw = image.height * ratio; sx = (image.width - sw) / 2; }
  else { sh = image.width / ratio; sy = (image.height - sh) / 2; }
  const GAP = 24; // px gap between photos (at 300dpi canvas resolution, ~0.08in)
  const x0 = (1200 - (w * 2 + GAP)) / 2, y0 = (1800 - (h * 3 + GAP * 2)) / 2;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++)
      ctx.drawImage(image, sx, sy, sw, sh, x0 + c * (w + GAP), y0 + r * (h + GAP), w, h);
}

function need() {
  if (!image) { alert('Please select a photo first.'); return false; }
  return true;
}

function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 1200);
}

jpg.onclick = () => {
  if (!need()) return;
  render();
  canvas.toBlob(b => downloadBlob(b, 'SnapPrint_4x6_300dpi.jpg'), 'image/jpeg', .98);
};

// --- Minimal, dependency-free PDF writer -----------------------------
// Wraps a single baseline JPEG (as produced by canvas.toDataURL) into a
// valid PDF, repeated across N pages. No external library needed, so
// nothing here violates the extension's default (CSP-safe) script policy.
function jpegDataUrlToBinaryString(dataUrl) {
  return atob(dataUrl.split(',')[1]);
}

function buildPdfBlob(jpegDataUrl, imgWidthPx, imgHeightPx, pageWidthIn, pageHeightIn, numPages) {
  const bin = jpegDataUrlToBinaryString(jpegDataUrl);
  const jpegLen = bin.length;
  const pageW = (pageWidthIn * 72).toFixed(2);
  const pageH = (pageHeightIn * 72).toFixed(2);

  let body = '';
  const offsets = {};
  function writeObj(num, content) {
    offsets[num] = body.length;
    body += num + ' 0 obj\n' + content + 'endobj\n';
  }

  const catalogNum = 1, pagesNum = 2, imgNum = 3, contentNum = 4;
  const pageNums = [];
  for (let i = 0; i < numPages; i++) pageNums.push(5 + i);

  writeObj(catalogNum, '<< /Type /Catalog /Pages ' + pagesNum + ' 0 R >>\n');
  writeObj(pagesNum, '<< /Type /Pages /Kids [' + pageNums.map(n => n + ' 0 R').join(' ') + '] /Count ' + numPages + ' >>\n');
  writeObj(imgNum, '<< /Type /XObject /Subtype /Image /Width ' + imgWidthPx + ' /Height ' + imgHeightPx +
    ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegLen + ' >>\nstream\n' + bin + '\nendstream\n');

  const contentStr = 'q ' + pageW + ' 0 0 ' + pageH + ' 0 0 cm /Im0 Do Q';
  writeObj(contentNum, '<< /Length ' + contentStr.length + ' >>\nstream\n' + contentStr + '\nendstream\n');

  pageNums.forEach(n => {
    writeObj(n, '<< /Type /Page /Parent ' + pagesNum + ' 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH +
      '] /Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> >> /Contents ' + contentNum + ' 0 R >>\n');
  });

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const totalObjs = 4 + numPages;
  let xref = 'xref\n0 ' + (totalObjs + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= totalObjs; i++) {
    xref += String(header.length + offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const xrefOffset = header.length + body.length;
  const trailer = 'trailer\n<< /Size ' + (totalObjs + 1) + ' /Root ' + catalogNum + ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';

  const full = header + body + xref + trailer;
  const bytes = new Uint8Array(full.length);
  for (let i = 0; i < full.length; i++) bytes[i] = full.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}
// -----------------------------------------------------------------------

pdf.onclick = () => {
  if (!need()) return;
  render();
  const dataUrl = canvas.toDataURL('image/jpeg', .98);
  const n = Math.max(1, Math.ceil((+copies.value || 6) / 6));
  const blob = buildPdfBlob(dataUrl, canvas.width, canvas.height, 4, 6, n);
  downloadBlob(blob, 'SnapPrint_4x6.pdf');
};

print.onclick = () => {
  if (!need()) return;
  render();
  const d = canvas.toDataURL('image/jpeg', .98), w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for printing.'); return; }
  w.document.write('<!doctype html><style>@page{size:4in 6in;margin:0}html,body{margin:0;padding:0;width:4in;height:6in}img{width:4in;height:6in}</style><img src="' + d + '"><script>onload=()=>print()<\/script>');
  w.document.close();
};

share.onclick = () => {
  if (!need()) return;
  render();
  canvas.toBlob(async b => {
    const f = new File([b], 'SnapPrint_4x6.jpg', { type: 'image/jpeg' });
    if (navigator.share) {
      try { await navigator.share({ title: 'SnapPrint 4×6', files: [f] }); } catch (e) {}
    } else downloadBlob(b, 'SnapPrint_4x6.jpg');
  }, 'image/jpeg', .98);
};

reset.onclick = () => {
  image = null; camera.value = ''; gallery.value = '';
  status.textContent = 'Select a photo to begin'; blank();
};
