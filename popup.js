const MAX_PHOTOS = 8;
const sheet = document.getElementById("sheet");
const ctx = sheet.getContext("2d");
const camera = document.getElementById("camera");
const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");
const photoCount = document.getElementById("photoCount");
const photoList = document.getElementById("photoList");
const copiesEl = document.getElementById("copies");
const pwEl = document.getElementById("pw");
const phEl = document.getElementById("ph");

let photos = [];

function setStatus(msg){ statusEl.textContent = msg; }

function loadFiles(fileList){
  const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/"));
  if(!files.length) return;

  const remaining = MAX_PHOTOS - photos.length;
  if(remaining <= 0){
    setStatus("Maximum 8 photos already added");
    return;
  }

  const selected = files.slice(0, remaining);
  selected.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photos.push({img, url, name:file.name});
      renderPhotoList();
      drawSheet();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });

  if(files.length > remaining){
    setStatus(`Only ${remaining} photo(s) added. Maximum is 8.`);
  } else {
    setStatus(`${Math.min(files.length, remaining)} photo(s) added`);
  }

  camera.value = "";
  gallery.value = "";
}

camera.addEventListener("change", e => loadFiles(e.target.files));
gallery.addEventListener("change", e => loadFiles(e.target.files));
copiesEl.addEventListener("change", drawSheet);
pwEl.addEventListener("input", drawSheet);
phEl.addEventListener("input", drawSheet);

function renderPhotoList(){
  photoCount.textContent = photos.length ? `${photos.length}/8 different photos added` : "";
  photoList.innerHTML = "";
  photos.forEach((p,i) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `<img src="${p.url}" alt=""><span class="num">${i+1}</span>`;
    photoList.appendChild(div);
  });
}

function drawFitPhoto(ctx, img, x, y, w, h){
  // Fit the complete photo inside the box without cropping.
  // White space is allowed so the top/bottom/left/right of the photo
  // is always preserved.
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawSheet(targetCtx = ctx, targetCanvas = sheet){
  const W = targetCanvas.width, H = targetCanvas.height;
  targetCtx.fillStyle = "#ffffff";
  targetCtx.fillRect(0,0,W,H);

  if(!photos.length){
    targetCtx.fillStyle = "#94a3b8";
    targetCtx.font = "bold 42px Arial";
    targetCtx.textAlign = "center";
    targetCtx.fillText("Select photos", W/2, H/2);
    targetCtx.textAlign = "start";
    return;
  }

  const copies = Math.max(1, parseInt(copiesEl.value,10) || 6);
  // 4x6 inch at 300 DPI = 1200x1800.
  // For 8 different photos, use a clean 2 columns x 4 rows layout.
  // Each photo is approximately 1.85 x 1.35 inches, so all 8 fit on ONE 4x6 sheet.
  const dpi = 300;
  const cols = 2;
  const rows = 4;
  const gap = 8;
  const sideMargin = 6;
  const topBottomMargin = 100;

  const cellW = (W - sideMargin*2 - gap) / cols;
  const cellH = (H - topBottomMargin*2 - gap*(rows-1)) / rows;
  const startX = sideMargin;
  const startY = topBottomMargin;

  // Always show all 8 selected photos on the first sheet.
  // If a quantity greater than 8 is selected, photos repeat sequentially.
  const countToDraw = Math.min(copies, cols*rows);

  for(let i=0;i<countToDraw;i++){
    const p = photos[i % photos.length];
    const col = i % cols;
    const row = Math.floor(i/cols);
    const x = startX + col*(cellW+gap);
    const y = startY + row*(cellH+gap);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(x,y,cellW,cellH);
    targetCtx.clip();
    drawFitPhoto(targetCtx,p.img,x,y,cellW,cellH);
    targetCtx.restore();
  }
}

function canvasBlob(){
  return new Promise(resolve => sheet.toBlob(resolve,"image/jpeg",0.95));
}

document.getElementById("jpg").addEventListener("click", async ()=>{
  if(!photos.length){ setStatus("Please select at least one photo"); return; }
  const blob = await canvasBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="SnapPrint_4x6.jpg";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  setStatus("JPG saved");
});

document.getElementById("pdf").addEventListener("click", ()=>{
  if(!photos.length){ setStatus("Please select at least one photo"); return; }
  // Uses the browser print engine to create a true 4x6 PDF.
  printSheet(true);
});

document.getElementById("print").addEventListener("click", ()=>{
  if(!photos.length){ setStatus("Please select at least one photo"); return; }
  printSheet(false);
});

function printSheet(saveAsPdf){
  const data = sheet.toDataURL("image/jpeg",0.98);
  const win = window.open("", "_blank");
  if(!win){
    setStatus("Please allow pop-ups for SnapPrint");
    return;
  }

  win.document.open();
  win.document.write(`<!doctype html>
<html><head><title>SnapPrint 4x6</title>
<style>
@page{size:4in 6in;margin:0}
html,body{margin:0;padding:0;width:4in;height:6in;background:#fff}
img{display:block;width:4in;height:6in;object-fit:contain}
@media print{html,body{width:4in;height:6in}img{width:4in;height:6in}}
</style></head><body>
<img src="${data}">
<script>
window.onload=function(){
  setTimeout(function(){ window.print(); },250);
};
<\/script>
</body></html>`);
  win.document.close();
  setStatus(saveAsPdf ? "PDF print dialog opened — choose Save as PDF" : "Print dialog opened");
}

document.getElementById("share").addEventListener("click", async ()=>{
  if(!photos.length){ setStatus("Please select at least one photo"); return; }
  const blob = await canvasBlob();
  const file = new File([blob],"SnapPrint_4x6.jpg",{type:"image/jpeg"});
  if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({title:"SnapPrint 4x6",files:[file]});
      setStatus("Shared successfully");
    }catch(e){
      if(e.name !== "AbortError") setStatus("Share cancelled");
    }
  }else{
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="SnapPrint_4x6.jpg";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus("Share not supported — JPG saved instead");
  }
});

document.getElementById("reset").addEventListener("click",()=>{
  photos.forEach(p=>URL.revokeObjectURL(p.url));
  photos=[];
  camera.value="";
  gallery.value="";
  renderPhotoList();
  drawSheet();
  setStatus("Select up to 8 different photos");
});

drawSheet();