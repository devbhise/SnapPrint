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

function drawCoverCrop(ctx, img, x, y, w, h){
  const scale = Math.max(w/img.naturalWidth, h/img.naturalHeight);
  const sw = w/scale, sh = h/scale;
  const sx = (img.naturalWidth-sw)/2;
  const sy = (img.naturalHeight-sh)/2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
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
  const photoWIn = Math.max(.5, Math.min(2, parseFloat(pwEl.value)||2));
  const photoHIn = Math.max(.5, Math.min(3, parseFloat(phEl.value)||2));

  // 4x6 inch at 300 DPI = 1200x1800
  const dpi = 300;
  const margin = 30;
  const gap = 20;
  const cols = Math.max(1, Math.floor((4-photoWIn)/(photoWIn+0.001))+1);
  const rows = Math.max(1, Math.floor((6-photoHIn)/(photoHIn+0.001))+1);

  const cellW = photoWIn*dpi;
  const cellH = photoHIn*dpi;
  const maxCols = Math.min(2, Math.max(1, cols));
  const maxRows = Math.min(3, Math.max(1, rows));

  const totalW = maxCols*cellW + (maxCols-1)*gap;
  const totalH = maxRows*cellH + (maxRows-1)*gap;
  const startX = (W-totalW)/2;
  const startY = (H-totalH)/2;

  for(let i=0;i<Math.min(copies,maxCols*maxRows);i++){
    const p = photos[i % photos.length];
    const col = i % maxCols;
    const row = Math.floor(i/maxCols);
    const x = startX + col*(cellW+gap);
    const y = startY + row*(cellH+gap);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(x,y,cellW,cellH);
    targetCtx.clip();
    drawCoverCrop(targetCtx,p.img,x,y,cellW,cellH);
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