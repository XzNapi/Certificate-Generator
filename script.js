// --- INIT WORKERS ---
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

// --- VARIABEL GLOBAL ---
const canvas = document.getElementById('sertifikat-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let backgroundImage = null;
let textFields = [];
let imageElements = []; // Untuk logo/ttd
let selectedTextId = null;
let selectedElementId = null;
let nextTextId = 0;
let nextElementId = 0;
let dataList = [];
let dataHeaders = [];

// Drag state
let isDragging = false;
let dragType = null; // 'text' atau 'image'
let dragStartOffset = { x: 0, y: 0 };

// --- NAVIGASI SIDEBAR ---
const menuBtns = document.querySelectorAll('.menu-btn');
const panels = document.querySelectorAll('.panel');
menuBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        menuBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// --- RENDER CANVAS ---
function redrawCanvas() {
    if (!backgroundImage) return;
    
    // 1. Gambar Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    // 2. Gambar Elemen Tambahan (Logo/TTD)
    imageElements.forEach(imgObj => {
        const w = imgObj.img.width * imgObj.scale;
        const h = imgObj.img.height * imgObj.scale;
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, w, h);
        
        if (imgObj.id === selectedElementId) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(imgObj.x, imgObj.y, w, h);
            ctx.setLineDash([]);
        }
    });

    // 3. Gambar Teks
    textFields.forEach(field => {
        let style = "";
        if (field.isItalic) style += "italic ";
        if (field.isBold) style += "bold ";
        ctx.font = `${style}${field.size}px "${field.family}"`;
        ctx.fillStyle = field.color;
        ctx.textAlign = field.align;
        ctx.textBaseline = 'middle';

        let textToDraw = field.dataLink ? `[${field.dataLink}]` : field.text;
        
        // Ukur Bounding Box
        const metrics = ctx.measureText(textToDraw);
        const height = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
        field.boundingBox = {
            width: metrics.width + 20,
            height: height + 20,
            y: field.y - (height / 2) - 10,
            x: field.align === 'center' ? field.x - (metrics.width / 2) - 10 : (field.align === 'left' ? field.x - 10 : field.x - metrics.width - 10)
        };

        ctx.fillText(textToDraw, field.x, field.y);

        if (field.id === selectedTextId) {
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(field.boundingBox.x, field.boundingBox.y, field.boundingBox.width, field.boundingBox.height);
            ctx.setLineDash([]);
        }
    });
}

// --- FUNGSI MOUSE (DRAG & DROP) ---
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

canvas.addEventListener('mousedown', (e) => {
    if (!backgroundImage) return;
    const pos = getMousePos(e);
    
    // Cek klik teks dulu (Prioritas atas)
    let clickedText = textFields.slice().reverse().find(f => 
        pos.x >= f.boundingBox.x && pos.x <= f.boundingBox.x + f.boundingBox.width &&
        pos.y >= f.boundingBox.y && pos.y <= f.boundingBox.y + f.boundingBox.height
    );

    // Cek klik gambar jika teks tidak diklik
    let clickedImg = null;
    if (!clickedText) {
        clickedImg = imageElements.slice().reverse().find(img => {
            const w = img.img.width * img.scale;
            const h = img.img.height * img.scale;
            return pos.x >= img.x && pos.x <= img.x + w && pos.y >= img.y && pos.y <= img.y + h;
        });
    }

    if (clickedText) {
        selectItem('text', clickedText.id);
        isDragging = true; dragType = 'text';
        dragStartOffset = { x: pos.x - clickedText.x, y: pos.y - clickedText.y };
    } else if (clickedImg) {
        selectItem('image', clickedImg.id);
        isDragging = true; dragType = 'image';
        dragStartOffset = { x: pos.x - clickedImg.x, y: pos.y - clickedImg.y };
    } else {
        selectItem(null, null);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const pos = getMousePos(e);
    if (dragType === 'text') {
        const field = textFields.find(t => t.id === selectedTextId);
        if (field) { field.x = pos.x - dragStartOffset.x; field.y = pos.y - dragStartOffset.y; }
    } else if (dragType === 'image') {
        const img = imageElements.find(i => i.id === selectedElementId);
        if (img) { img.x = pos.x - dragStartOffset.x; img.y = pos.y - dragStartOffset.y; }
    }
    redrawCanvas();
});

window.addEventListener('mouseup', () => { isDragging = false; });

// --- MANAJEMEN SELEKSI UI ---
function selectItem(type, id) {
    const textControls = document.getElementById('text-edit-controls');
    const elemControls = document.getElementById('element-edit-controls');
    const indicator = document.getElementById('selection-indicator');

    selectedTextId = type === 'text' ? id : null;
    selectedElementId = type === 'image' ? id : null;

    if (type === 'text') {
        textControls.classList.remove('hidden');
        elemControls.classList.add('hidden');
        indicator.textContent = "✏️ Teks Terpilih (Pindah ke Tab Teks untuk edit)";
        updateTextToolbar();
    } else if (type === 'image') {
        textControls.classList.add('hidden');
        elemControls.classList.remove('hidden');
        indicator.textContent = "🖼️ Gambar Terpilih (Pindah ke Tab Elemen untuk edit)";
        const img = imageElements.find(i => i.id === id);
        if (img) document.getElementById('element-scale').value = img.scale;
    } else {
        textControls.classList.add('hidden');
        elemControls.classList.add('hidden');
        indicator.textContent = "Pilih teks/gambar di canvas untuk mengedit.";
    }
    redrawCanvas();
}

// --- FITUR DESAIN (BACKGROUND) ---
document.getElementById('design-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loadImg = (url) => {
        const img = new Image();
        img.onload = () => {
            backgroundImage = img;
            canvas.width = img.width; canvas.height = img.height;
            redrawCanvas();
            document.getElementById('generate-bulk-btn').disabled = dataList.length === 0;
        };
        img.src = url;
    };

    if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const pdfDoc = await pdfjsLib.getDocument({ data: event.target.result }).promise;
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 3.0 });
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
            await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport: viewport }).promise;
            loadImg(tempCanvas.toDataURL());
        };
        reader.readAsArrayBuffer(file);
    } else {
        loadImg(URL.createObjectURL(file));
    }
});

// --- FITUR TEKS ---
document.getElementById('add-text-btn').addEventListener('click', () => {
    const newField = {
        id: nextTextId++, text: "Teks Baru", dataLink: null,
        x: canvas.width / 2, y: canvas.height / 2, size: 50,
        family: 'Times New Roman', color: '#000000', align: 'center',
        isBold: false, isItalic: false, transform: 'none', boundingBox: {}
    };
    textFields.push(newField);
    selectItem('text', newField.id);
});

document.getElementById('delete-text-btn').addEventListener('click', () => {
    textFields = textFields.filter(t => t.id !== selectedTextId);
    selectItem(null, null);
});

function updateTextToolbar() {
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;
    document.getElementById('font-family').value = field.family;
    document.getElementById('font-size').value = field.size;
    document.getElementById('font-color').value = field.color;
    document.getElementById('font-color-hex').value = field.color;
    document.getElementById('font-align').value = field.align;
    document.getElementById('text-transform').value = field.transform;
    document.getElementById('font-bold').classList.toggle('active', field.isBold);
    document.getElementById('font-italic').classList.toggle('active', field.isItalic);
    
    const dataLinkEl = document.getElementById('data-link-select');
    const textInputEl = document.getElementById('text-input');
    dataLinkEl.value = field.dataLink || "STATIC";
    textInputEl.value = field.dataLink ? `[${field.dataLink}]` : field.text;
    textInputEl.disabled = !!field.dataLink;
}

// Binding event listener dari HTML ke properti teks
const bindProp = (id, prop) => document.getElementById(id).addEventListener('change', (e) => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field) { field[prop] = e.target.value; redrawCanvas(); }
});
bindProp('font-family', 'family');
bindProp('font-size', 'size');
bindProp('font-align', 'align');
bindProp('text-transform', 'transform');

document.getElementById('text-input').addEventListener('input', (e) => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field && !field.dataLink) { field.text = e.target.value; redrawCanvas(); }
});
document.getElementById('font-color').addEventListener('input', (e) => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field) { field.color = e.target.value; document.getElementById('font-color-hex').value = e.target.value; redrawCanvas(); }
});
document.getElementById('font-bold').addEventListener('click', () => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field) { field.isBold = !field.isBold; updateTextToolbar(); redrawCanvas(); }
});
document.getElementById('font-italic').addEventListener('click', () => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field) { field.isItalic = !field.isItalic; updateTextToolbar(); redrawCanvas(); }
});
document.getElementById('data-link-select').addEventListener('change', (e) => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (field) {
        field.dataLink = e.target.value === "STATIC" ? null : e.target.value;
        updateTextToolbar(); redrawCanvas();
    }
});

// Custom Font
document.getElementById('add-font-btn').addEventListener('click', () => {
    const name = document.getElementById('new-font-name').value;
    const file = document.getElementById('new-font-file').files[0];
    if(name && file) {
        const reader = new FileReader();
        reader.onload = e => {
            const font = new FontFace(name, `url(${e.target.result})`);
            font.load().then(f => {
                document.fonts.add(f);
                document.getElementById('font-family').insertAdjacentHTML('beforeend', `<option value="${name}">${name}</option>`);
                alert("Font berhasil ditambah!");
            });
        };
        reader.readAsDataURL(file);
    }
});

// --- FITUR ELEMEN (GAMBAR) ---
document.getElementById('element-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !backgroundImage) { alert('Upload background desain dulu!'); return; }
    const img = new Image();
    img.onload = () => {
        const newElem = { id: nextElementId++, img: img, x: 50, y: 50, scale: 1 };
        imageElements.push(newElem);
        selectItem('image', newElem.id);
    };
    img.src = URL.createObjectURL(file);
});
document.getElementById('element-scale').addEventListener('input', (e) => {
    const img = imageElements.find(i => i.id === selectedElementId);
    if (img) { img.scale = parseFloat(e.target.value); redrawCanvas(); }
});
document.getElementById('delete-element-btn').addEventListener('click', () => {
    imageElements = imageElements.filter(i => i.id !== selectedElementId);
    selectItem(null, null);
});

// --- FITUR DATA MASSAL (EXCEL/CSV) ---
function updateDataLinkDropdown() {
    const select = document.getElementById('data-link-select');
    select.innerHTML = '<option value="STATIC">Teks Statis</option>';
    dataHeaders.forEach(h => select.insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`));
}

function processData(data) {
    if(data.length > 0) {
        dataList = data; dataHeaders = Object.keys(data[0]);
        updateDataLinkDropdown();
        document.getElementById('bulk-status').textContent = `Terbaca: ${data.length} baris.`;
        if (backgroundImage) document.getElementById('generate-bulk-btn').disabled = false;
    }
}

document.getElementById('bulk-file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
        reader.onload = ev => {
            const rows = ev.target.result.split('\n').map(r=>r.split(','));
            const hdrs = rows[0].map(h=>h.trim());
            const json = rows.slice(1).filter(r=>r.length>1).map(r => {
                let obj={}; hdrs.forEach((h,i)=> obj[h] = r[i]?.trim()); return obj;
            });
            processData(json);
        };
        reader.readAsText(file);
    } else {
        reader.onload = ev => {
            const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
            processData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
        };
        reader.readAsArrayBuffer(file);
    }
});

// --- TOMBOL DOWNLOAD SATUAN ---
document.getElementById('download-btn').addEventListener('click', () => {
    if (!backgroundImage) return;
    selectItem(null, null); // hilangkan kotak seleksi
    const link = document.createElement('a');
    link.download = 'Preview.png';
    link.href = canvas.toDataURL();
    link.click();
});

// --- GENERATE MASSAL ---
const toTitleCase = str => String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

document.getElementById('generate-bulk-btn').addEventListener('click', async () => {
    selectItem(null, null);
    const format = document.getElementById('bulk-format').value;
    const asZip = document.getElementById('download-as-zip').checked;
    const statDiv = document.getElementById('bulk-status');
    let zip = asZip ? new JSZip() : null;
    let jsPDF = format === 'pdf' ? window.jspdf.jsPDF : null;

    statDiv.textContent = "Memproses...";
    
    for (let i = 0; i < dataList.length; i++) {
        const row = dataList[i];
        
        // Render Canvas untuk baris ini
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
        imageElements.forEach(imgObj => ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.img.width * imgObj.scale, imgObj.img.height * imgObj.scale));
        
        textFields.forEach(field => {
            ctx.font = `${field.isItalic?'italic ':''}${field.isBold?'bold ':''}${field.size}px "${field.family}"`;
            ctx.fillStyle = field.color; ctx.textAlign = field.align; ctx.textBaseline = 'middle';
            let txt = field.dataLink ? (row[field.dataLink] || '') : field.text;
            if (field.transform === 'titlecase') txt = toTitleCase(txt);
            if (field.transform === 'uppercase') txt = String(txt).toUpperCase();
            ctx.fillText(txt, field.x, field.y);
        });

        const nameKey = dataHeaders[0];
        const fileName = row[nameKey] ? `Sertifikat - ${row[nameKey].replace(/[\\/*?:"<>|]/g, '')}` : `Sertifikat_${i+1}`;

        if (asZip) {
            if (format === 'png') {
                zip.file(`${fileName}.png`, canvas.toDataURL('image/png').split(',')[1], {base64: true});
            } else {
                const doc = new jsPDF({orientation: canvas.width>canvas.height?'l':'p', unit: 'px', format: [canvas.width, canvas.height]});
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                zip.file(`${fileName}.pdf`, doc.output('blob'));
            }
        } else {
            const link = document.createElement('a');
            if (format === 'png') {
                link.download = `${fileName}.png`; link.href = canvas.toDataURL();
            } else {
                const doc = new jsPDF({orientation: canvas.width>canvas.height?'l':'p', unit: 'px', format: [canvas.width, canvas.height]});
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                link.href = URL.createObjectURL(doc.output('blob')); link.download = `${fileName}.pdf`;
            }
            link.click();
            await new Promise(r => setTimeout(r, 200));
        }
        statDiv.textContent = `Progres: ${i+1}/${dataList.length}`;
    }

    if (asZip) {
        statDiv.textContent = "Membuat ZIP...";
        const content = await zip.generateAsync({type: "blob"});
        const link = document.createElement('a'); link.href = URL.createObjectURL(content);
        link.download = 'Sertifikat_Massal.zip'; link.click();
    }
    statDiv.textContent = "Selesai!";
});

// --- SIMPAN / MUAT TEMPLATE ---
document.getElementById('save-template-btn').addEventListener('click', () => {
    const data = { textFields, imageElements: imageElements.map(e => ({...e, img: e.img.src})) };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
    link.download = 'template.json'; link.click();
});
