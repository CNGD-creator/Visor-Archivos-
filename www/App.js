const $ = s => document.querySelector(s);
const view = $('#view'), nameEl = $('#name'), empty = $('#empty');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ext = n => (n.split('.').pop() || '').toLowerCase();

function show(html) { view.innerHTML = html; view.scrollTop = 0; }
const msg = t => show(`<p class="msg">${t}</p>`);

async function openFile(file) {
  nameEl.textContent = file.name;
  msg('Abriendo…');
  const e = ext(file.name);
  try {
    if (e === 'docx') await docx(file);
    else if (['xlsx', 'xls', 'xlsm', 'ods', 'csv'].includes(e)) await sheet(file);
    else if (e === 'pdf') await pdf(file);
    else if (e === 'pptx') await pptx(file);
    else if (e === 'zip') await zip(file);
    else if (['html', 'htm'].includes(e)) frame(file);
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(e)) media(file, 'img');
    else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(e)) media(file, 'audio');
    else if (['mp4', 'webm', 'mkv', '3gp', 'mov'].includes(e)) media(file, 'video');
    else if (['doc', 'ppt'].includes(e)) msg('Los formatos antiguos .' + e + ' no se pueden abrir. Guárdalo como .' + e + 'x e inténtalo de nuevo.');
    else await text(file, e);
  } catch (err) { msg('No se pudo abrir: ' + esc(err.message)); }
}

async function docx(f) {
  const r = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
  show('<article class="doc">' + r.value + '</article>');
}

async function sheet(f) {
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
  const tabs = wb.SheetNames.map((n, i) => `<button class="tab${i ? '' : ' on'}" data-i="${i}">${esc(n)}</button>`).join('');
  show(`<div class="tabs">${tabs}</div><div id="sheet" class="scroll"></div>`);
  const draw = i => $('#sheet').innerHTML = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[i]]);
  draw(0);
  view.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    view.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); draw(+b.dataset.i);
  });
}

async function pdf(f) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
  const doc = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
  show('<div class="pages"></div>');
  const box = view.firstChild, w = view.clientWidth - 16;
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: (w / p.getViewport({ scale: 1 }).width) * 2 });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    box.appendChild(c);
    await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}

async function pptx(f) {
  const z = await JSZip.loadAsync(await f.arrayBuffer());
  const names = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  let html = '';
  for (let i = 0; i < names.length; i++) {
    const xml = new DOMParser().parseFromString(await z.file(names[i]).async('string'), 'text/xml');
    const paras = [...xml.getElementsByTagName('a:p')]
      .map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join(''))
      .filter(Boolean);
    html += `<section class="slide"><h3>Diapositiva ${i + 1}</h3>${paras.map(p => `<p>${esc(p)}</p>`).join('') || '<p>(sin texto)</p>'}</section>`;
  }
  show(html || '<p class="msg">Sin diapositivas</p>');
}

async function zip(f) {
  const z = await JSZip.loadAsync(await f.arrayBuffer());
  show('<ul class="files">' + Object.keys(z.files).map(n => `<li>${esc(n)}</li>`).join('') + '</ul>');
}

function frame(f) {
  f.text().then(t => {
    show('<iframe sandbox></iframe>');
    view.firstChild.srcdoc = t;
  });
}

function media(f, tag) {
  const u = URL.createObjectURL(f);
  show(tag === 'img' ? `<img class="full" src="${u}">` : `<${tag} src="${u}" controls></${tag}>`);
}

async function text(f, e) {
  let t = await f.text();
  if (e === 'json') { try { t = JSON.stringify(JSON.parse(t), null, 2); } catch {} }
  show('<pre>' + esc(t) + '</pre>');
}

$('#pick').onchange = e => { if (e.target.files[0]) openFile(e.target.files[0]); };

// La app de Android llama a esta función al tocar un archivo (ej. desde WhatsApp)
window.openFromAndroid = (name, mime, b64) => {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  openFile(new File([u], name, { type: mime }));
};
