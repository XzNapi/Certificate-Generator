// JAVASCRIPT untuk fungsionalitas

// Inisialisasi PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

// Ambil elemen dari HTML
const uploadInput = document.getElementById('design-upload');
const editorSection = document.getElementById('editor-section');
const bulkSection = document.getElementById('bulk-section');
const uploadSection = document.getElementById('upload-section');
const canvas = document.getElementById('sertifikat-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Ambil elemen toolbar
const textEditControls = document.getElementById('text-edit-controls');
const addTextBtn = document.getElementById('add-text-btn');
const deleteTextBtn = document.getElementById('delete-text-btn');
const dataLinkSelect = document.getElementById('data-link-select');
const textInput = document.getElementById('text-input');

// Ambil kontainer tombol hapus
const deleteTextContainer = document.getElementById('delete-text-container');

// Ambil semua elemen tools
const fontFamilySelect = document.getElementById('font-family');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const fontBoldBtn = document.getElementById('font-bold');
const fontItalicBtn = document.getElementById('font-italic');
const fontAlignSelect = document.getElementById('font-align');
const downloadBtn = document.getElementById('download-btn');
const textTransformSelect = document.getElementById('text-transform');

// Elemen Warna Lanjutan
const fontColorHexInput = document.getElementById('font-color-hex');
const colorPickerBtn = document.getElementById('color-picker-btn');

// Elemen Tambah Font
const addFontBtn = document.getElementById('add-font-btn');
const newFontNameInput = document.getElementById('new-font-name');
const newFontFileInput = document.getElementById('new-font-file');

// Elemen Tombol Geser (Nudge)
const moveUpBtn = document.getElementById('move-up');
const moveDownBtn = document.getElementById('move-down');
const moveLeftBtn = document.getElementById('move-left');
const moveRightBtn = document.getElementById('move-right');
const NUDGE_AMOUNT = 5;

// Elemen untuk bulk generation
const bulkFileInput = document.getElementById('bulk-file-upload');
const gdocLinkInput = document.getElementById('gdoc-link');
const fetchGdocBtn = document.getElementById('fetch-gdoc-btn');
const bulkFormatSelect = document.getElementById('bulk-format');
const generateBulkBtn = document.getElementById('generate-bulk-btn');
const bulkStatusDiv = document.getElementById('bulk-status');
const zipCheckbox = document.getElementById('download-as-zip');

// <-- TAMBAHKAN BLOK DI BAWAH INI -->
// Elemen Simpan/Muat Template
const saveTemplateBtn = document.getElementById('save-template-btn');
const loadTemplateBtn = document.getElementById('load-template-btn');
const loadTemplateInput = document.getElementById('load-template-input');
// <-- AKHIR BLOK TAMBAHAN -->

// Variabel Global
let backgroundImage;
let textFields = [];
let selectedTextId = null;
let nextTextId = 0;
let dataList = [];
let dataHeaders = [];
let isDragging = false;
let dragStartOffset = { x: 0, y: 0 };

// --- FUNGSI UTAMA ---

// [BARU] Fungsi untuk mengubah teks menjadi Title Case
function toTitleCase(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function redrawCanvas() {
    if (!backgroundImage || !backgroundImage.src) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    for (const field of textFields) {
        let style = "";
        if (field.isItalic) style += "italic ";
        if (field.isBold) style += "bold ";
        ctx.font = `${style}${field.size}px "${field.family}"`;
        ctx.fillStyle = field.color;
        ctx.textAlign = field.align;
        ctx.textBaseline = 'middle';

        const textToDraw = field.dataLink ? `[${field.dataLink}]` : field.text;
        updateTextFieldBoundingBox(field, textToDraw);
        ctx.fillText(textToDraw, field.x, field.y);

        if (field.id === selectedTextId) {
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(field.boundingBox.x, field.boundingBox.y, field.boundingBox.width, field.boundingBox.height);
            ctx.setLineDash([]);
        }
    }
}

function updateTextFieldBoundingBox(field, textToDraw) {
    let style = "";
    if (field.isItalic) style += "italic ";
    if (field.isBold) style += "bold ";
    ctx.font = `${style}${field.size}px "${field.family}"`;
    ctx.textAlign = field.align;
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(textToDraw);
    const actualHeight = (textMetrics.actualBoundingBoxAscent || 0) + (textMetrics.actualBoundingBoxDescent || 0);
    const actualWidth = textMetrics.width;
    const paddingX = 10;
    const paddingY = 10;

    field.boundingBox = field.boundingBox || {};
    field.boundingBox.width = actualWidth + (paddingX * 2);
    field.boundingBox.height = actualHeight + (paddingY * 2);

    if (field.align === 'center') {
        field.boundingBox.x = field.x - (actualWidth / 2) - paddingX;
    } else if (field.align === 'left') {
        field.boundingBox.x = field.x - paddingX;
    } else {
        field.boundingBox.x = field.x - actualWidth - paddingX;
    }
    field.boundingBox.y = field.y - (actualHeight / 2) - paddingY;
}

// [PEROMBAKAN BESAR] Memproses file Excel/CSV/GSheet
function processNamaList(list, isGSheet = false, explicitHeaders = null) {
    
    dataList = [];
    dataHeaders = [];

    // --- 1. Parsing Data ---
    if (isGSheet) {
        const lines = list.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) { // Butuh setidaknya 1 header dan 1 baris data
            bulkStatusDiv.textContent = "File CSV kosong atau tidak valid (butuh header dan data).";
            bulkStatusDiv.style.color = 'red';
            return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        dataHeaders = headers;
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            let obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = values[j] ? values[j].trim() : '';
            }
            dataList.push(obj);
        }
    } else {
        dataList = list;
        dataHeaders = explicitHeaders || (dataList.length > 0 ? Object.keys(dataList[0]) : []);
    }
    
    if (dataList.length === 0) {
        bulkStatusDiv.textContent = "Tidak ada baris data yang ditemukan (file mungkin hanya berisi header).";
        bulkStatusDiv.style.color = 'red';
        return;
    }

    // --- 2. Deteksi Duplikat (Case-Insensitive) ---
    const allDuplicatesMap = new Map();

    for (const header of dataHeaders) {
        const valueCounts = new Map(); 

        for (const row of dataList) {
            const originalValue = row[header];
            if (originalValue === null || originalValue === undefined) continue;
            
            const standardizedValue = String(originalValue).toLowerCase().trim();
            if (standardizedValue === "") continue; 

            if (valueCounts.has(standardizedValue)) {
                valueCounts.get(standardizedValue).count++;
            } else {
                valueCounts.set(standardizedValue, { count: 1, originalValue: originalValue });
            }
        }

        const duplicates = new Map();
        for (const [stdVal, data] of valueCounts.entries()) {
            if (data.count > 1) {
                duplicates.set(data.originalValue, data.count - 1); 
            }
        }
        
        if (duplicates.size > 0) {
            allDuplicatesMap.set(header, duplicates);
        }
    }

    // --- 3. Buat Pesan Status ---
    let mainStatusMessage = "";
    let mainStatusColor = "red";

    if (dataList.length > 0 && backgroundImage && backgroundImage.src) {
        mainStatusMessage = `Siap menghasilkan ${dataList.length} sertifikat.`;
        mainStatusColor = 'green';
        generateBulkBtn.disabled = false;
    } else if (dataList.length > 0) {
        mainStatusMessage = `Data terbaca (${dataList.length} baris, ${dataHeaders.length} kolom). Silakan upload desain.`;
        mainStatusColor = 'blue';
    } else {
        mainStatusMessage = `Tidak ada data valid ditemukan.`;
        generateBulkBtn.disabled = true;
    }

    // --- 4. Buat Peringatan Duplikat ---
    let warningMessage = "";
    if (allDuplicatesMap.size > 0) {
        const headerToIndex = new Map(dataHeaders.map((h, i) => [h, String.fromCharCode(65 + i)]));
        
        for (const [header, duplicatesMap] of allDuplicatesMap.entries()) {
            const cellLetter = headerToIndex.get(header) || header;
            const duplicateValues = [...duplicatesMap.keys()].join(', '); 
            const totalDuplicateCount = [...duplicatesMap.values()].reduce((a, b) => a + b, 0);

            warningMessage += `<br><strong style="color: #e67e22;">Peringatan !!</strong> Ditemukan ${totalDuplicateCount} duplikasi pada cell <strong>${cellLetter}</strong> : ${duplicateValues}.`;
        }
    }
    
    // 5. Tampilkan Pesan
    bulkStatusDiv.innerHTML = mainStatusMessage + warningMessage;
    bulkStatusDiv.style.color = mainStatusColor;

    // 6. Update UI Lainnya
    updateDataLinkDropdown();
    if (textFields.length === 0 && dataHeaders.length > 0) {
        addNewTextField(dataHeaders[0]); 
    } else if (textFields.length === 0) {
        addNewTextField();
    }
}

// Membuat bidang teks baru
function addNewTextField(linkToData = null) {
    const defaultText = linkToData ? `[${linkToData}]` : "Teks Baru";
    const newField = {
        id: nextTextId++,
        text: defaultText,
        dataLink: linkToData,
        x: canvas.width / 2,
        y: (canvas.height / 2) + (textFields.length * 50),
        size: 50,
        family: 'Times New Roman',
        color: '#000000',
        isBold: false,
        isItalic: false,
        align: 'center',
        transform: 'none', 
        boundingBox: {}
    };
    textFields.push(newField);
    selectTextField(newField.id);
}

// Fungsi untuk memilih teks
function selectTextField(id) {
    selectedTextId = id;
    if (id === null) {
        textEditControls.classList.add('hidden');
        deleteTextContainer.classList.add('invisible');
    } else {
        textEditControls.classList.remove('hidden');
        deleteTextContainer.classList.remove('invisible');
        updateToolbarForSelected();
    }
    redrawCanvas();
}

// Mengisi toolbar saat teks dipilih
function updateToolbarForSelected() {
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;

    fontFamilySelect.value = field.family;
    fontSizeInput.value = field.size;
    fontColorInput.value = field.color;
    fontColorHexInput.value = field.color;
    fontBoldBtn.classList.toggle('active', field.isBold);
    fontItalicBtn.classList.toggle('active', field.isItalic);
    fontAlignSelect.value = field.align;
    textTransformSelect.value = field.transform || 'none';

    if (field.dataLink) {
        dataLinkSelect.value = field.dataLink;
        textInput.value = `[${field.dataLink}]`;
        textInput.disabled = true;
    } else {
        dataLinkSelect.value = "STATIC_TEXT";
        textInput.value = field.text;
        textInput.disabled = false;
    }
}

// Mengisi dropdown "Link Data"
function updateDataLinkDropdown() {
    dataLinkSelect.innerHTML = '';
    const staticOption = document.createElement('option');
    staticOption.value = "STATIC_TEXT";
    staticOption.textContent = "Teks Statis (Tidak Di-link)";
    dataLinkSelect.appendChild(staticOption);
    for (const header of dataHeaders) {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        dataLinkSelect.appendChild(option);
    }
}

// Memperbarui properti teks dari toolbar
function updateSelectedTextField(property, value) {
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;

    field[property] = value;
    if (property === 'dataLink') {
        if (value === "STATIC_TEXT") {
            field.dataLink = null;
            field.text = "Teks Statis";
        } else {
            field.dataLink = value;
            field.text = `[${value}]`;
        }
        updateToolbarForSelected();
    }
    if (property === 'text') {
        field.dataLink = null;
    }
    redrawCanvas();
}

// --- FUNGSI TOOLS LAINNYA ---
function setupEyedropper() {
    if (!('EyeDropper' in window)) {
        console.warn("EyeDropper API tidak didukung. Tombol disembunyikan.");
        colorPickerBtn.style.display = 'none';
        return;
    }
    colorPickerBtn.addEventListener('click', async () => {
        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            fontColorInput.value = result.sRGBHex;
            fontColorHexInput.value = result.sRGBHex;
            updateSelectedTextField('color', result.sRGBHex);
        } catch (e) {
            console.log("Eyedropper dibatalkan.");
        }
    });
}

function handleAddFont() {
    const name = newFontNameInput.value.trim();
    const file = newFontFileInput.files[0];
    if (!name || !file) {
        alert("Harap isi Nama Font dan pilih File Font (.ttf, .otf, .woff).");
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const fontDataUrl = event.target.result;
        const newFont = new FontFace(name, `url(${fontDataUrl})`);
        newFont.load().then((loadedFont) => {
            document.fonts.add(loadedFont);
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            fontFamilySelect.appendChild(option);
            fontFamilySelect.value = name;
            if (selectedTextId !== null) {
                updateSelectedTextField('family', name);
            }
            newFontNameInput.value = '';
            newFontFileInput.value = '';
            alert(`Font '${name}' berhasil ditambahkan!`);
        }).catch((error) => {
            alert(`Gagal memuat file font: ${error.message}`);
        });
    };
    reader.onerror = () => {
        alert("Gagal membaca file. File mungkin rusak.");
    };
    reader.readAsDataURL(file);
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// --- EVENT LISTENERS ---

// 1. Upload Desain
uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const loadBackgroundImage = (dataUrl) => {
        const img = new Image();
        img.onload = () => {
            backgroundImage = img; 
            canvas.width = backgroundImage.width;
            canvas.height = backgroundImage.height;
            if (textFields.length === 0) {
                addNewTextField(dataHeaders.length > 0 ? dataHeaders[0] : null);
            }
            redrawCanvas();
            editorSection.style.display = 'block';
            bulkSection.style.display = 'block';
            uploadSection.style.display = 'none';
            if (dataList.length > 0) {
                generateBulkBtn.disabled = false;
            }
        };
        img.onerror = () => {
            alert("Gagal memuat data gambar. File mungkin rusak.");
            uploadInput.value = '';
        };
        img.src = dataUrl;
    };
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadBackgroundImage(event.target.result);
        };
        reader.readAsDataURL(file);
    } 
    else if (file.type === 'application/pdf') {
        if (typeof pdfjsLib === 'undefined') {
            alert("Gagal memuat library PDF. Periksa koneksi internet Anda.");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdfDoc.getPage(1);
                const scale = 3.0;
                const viewport = page.getViewport({ scale: scale });
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                await page.render({
                    canvasContext: tempCtx,
                    viewport: viewport
                }).promise;
                const dataUrl = tempCanvas.toDataURL('image/png');
                loadBackgroundImage(dataUrl);
            } catch (error) {
                alert(`Gagal membaca file PDF: ${error.message}`);
                uploadInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    else {
        alert("Format file tidak didukung. Harap unggah .png, .jpeg, atau .pdf");
        uploadInput.value = '';
    }
});

// 2. Event Listener untuk Toolbar
addTextBtn.addEventListener('click', () => addNewTextField());
deleteTextBtn.addEventListener('click', () => {
    if (selectedTextId === null) return;
    if (confirm("Apakah Anda yakin ingin menghapus bidang teks ini?")) {
        textFields = textFields.filter(t => t.id !== selectedTextId);
        selectTextField(null);
    }
});
dataLinkSelect.addEventListener('change', () => {
    updateSelectedTextField('dataLink', dataLinkSelect.value);
});
textInput.addEventListener('change', () => {
    updateSelectedTextField('text', textInput.value);
});
fontFamilySelect.addEventListener('change', () => {
    updateSelectedTextField('family', fontFamilySelect.value);
});
fontSizeInput.addEventListener('change', () => {
    updateSelectedTextField('size', fontSizeInput.value);
});
fontColorInput.addEventListener('input', () => {
    fontColorHexInput.value = fontColorInput.value;
    updateSelectedTextField('color', fontColorInput.value);
});
fontColorHexInput.addEventListener('change', () => {
    let value = fontColorHexInput.value;
    if (value.length === 6 && !value.startsWith('#')) value = '#' + value;
    if (/^#[0-9A-F]{6}$/i.test(value) || /^#[0-9A-F]{3}$/i.test(value)) {
        fontColorInput.value = value;
        fontColorHexInput.value = value;
        updateSelectedTextField('color', value);
    } else {
        fontColorHexInput.value = fontColorInput.value;
    }
});
fontBoldBtn.addEventListener('click', () => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;
    field.isBold = !field.isBold;
    fontBoldBtn.classList.toggle('active', field.isBold);
    redrawCanvas();
});
fontItalicBtn.addEventListener('click', () => {
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;
    field.isItalic = !field.isItalic;
    fontItalicBtn.classList.toggle('active', field.isItalic);
    redrawCanvas();
});
fontAlignSelect.addEventListener('change', () => {
    updateSelectedTextField('align', fontAlignSelect.value);
});
textTransformSelect.addEventListener('change', () => {
    updateSelectedTextField('transform', textTransformSelect.value);
});

// 3. Tombol Geser (Nudge)
moveUpBtn.addEventListener('click', () => { 
    const f = textFields.find(t => t.id === selectedTextId); if (f) f.y -= NUDGE_AMOUNT; redrawCanvas(); 
});
moveDownBtn.addEventListener('click', () => {
    const f = textFields.find(t => t.id === selectedTextId); if (f) f.y += NUDGE_AMOUNT; redrawCanvas();
});
moveLeftBtn.addEventListener('click', () => {
    const f = textFields.find(t => t.id === selectedTextId); if (f) f.x -= NUDGE_AMOUNT; redrawCanvas();
});
moveRightBtn.addEventListener('click', () => {
    const f = textFields.find(t => t.id === selectedTextId); if (f) f.x += NUDGE_AMOUNT; redrawCanvas();
});

// 4. Drag-and-Drop Canvas
canvas.addEventListener('mousedown', (e) => {
    if (!backgroundImage || !backgroundImage.src) return;
    const pos = getMousePos(e);
    let clickedField = null;
    for (let i = textFields.length - 1; i >= 0; i--) {
        const field = textFields[i];
        const box = field.boundingBox;
        if (pos.x >= box.x && pos.x <= box.x + box.width &&
            pos.y >= box.y && pos.y <= box.y + box.height) {
            clickedField = field;
            break;
        }
    }
    if (clickedField) {
        isDragging = true;
        selectTextField(clickedField.id);
        canvas.style.cursor = 'move';
        dragStartOffset.x = pos.x - clickedField.x;
        dragStartOffset.y = pos.y - clickedField.y;
    } else {
        isDragging = false;
        selectTextField(null);
        canvas.style.cursor = 'crosshair';
    }
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || selectedTextId === null) return;
    const field = textFields.find(t => t.id === selectedTextId);
    if (!field) return;
    const pos = getMousePos(e);
    field.x = pos.x - dragStartOffset.x;
    field.y = pos.y - dragStartOffset.y;
    redrawCanvas();
});
canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('mouseout', () => {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});

// 5. Download Satuan
downloadBtn.addEventListener('click', () => {
    if (!backgroundImage || !backgroundImage.src) { alert("Mohon upload desain sertifikat terlebih dahulu."); return; }
    const previouslySelected = selectedTextId;
    selectTextField(null);
    redrawCanvas();
    const link = document.createElement('a');
    const namaFile = 'Sertifikat_Preview.png';
    link.download = namaFile;
    link.href = canvas.toDataURL('image/png');
    link.click();
    selectTextField(previouslySelected);
});

// 6. Otomatisasi Massal (BULK)
// Opsi 1: Upload File
bulkFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt === 'csv') {
        reader.onload = (event) => {
            processNamaList(event.target.result, true, null);
        };
        reader.readAsText(file);
    } else if (fileExt === 'xls' || fileExt === 'xlsx') {
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                if (typeof XLSX === 'undefined') throw new Error("Library SheetJS (XLSX) tidak termuat.");
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const headerArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
                const json = XLSX.utils.sheet_to_json(worksheet); 
                processNamaList(json, false, headerArray); 
            } catch (error) {
                bulkStatusDiv.textContent = `Gagal membaca file Excel: ${error.message}`;
                bulkStatusDiv.style.color = 'red';
                generateBulkBtn.disabled = true;
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        bulkStatusDiv.textContent = "Format file tidak didukung. Harap gunakan .csv, .xls, or .xlsx";
        bulkStatusDiv.style.color = 'red';
    }
});
// Opsi 2: Fetch Google Sheet
fetchGdocBtn.addEventListener('click', async () => {
    const url = gdocLinkInput.value.trim();
    if (!url) {
        bulkStatusDiv.textContent = "Harap masukkan URL Google Sheet.";
        bulkStatusDiv.style.color = 'red';
        return;
    }
    bulkStatusDiv.textContent = "Mengambil data dari link...";
    bulkStatusDiv.style.color = 'blue';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Gagal mengambil data. Status: ${response.status}`);
        const csvContent = await response.text();
        processNamaList(csvContent, true, null);
    } catch (error) {
        bulkStatusDiv.textContent = `Gagal: ${error.message}. Pastikan link benar dan dipublikasikan sebagai CSV.`;
        bulkStatusDiv.style.color = 'red';
    }
});

// Tombol Generate Massal
generateBulkBtn.addEventListener('click', () => {
    if (dataList.length === 0 || !backgroundImage || !backgroundImage.src) {
        alert("Mohon siapkan desain sertifikat dan daftar nama terlebih dahulu.");
        return;
    }
    generateBulkBtn.disabled = true;
    bulkStatusDiv.textContent = "Memulai generasi massal...";
    bulkStatusDiv.style.color = 'blue';
    const previouslySelected = selectedTextId;
    selectTextField(null);
    setTimeout(async () => {
        try {
            const format = bulkFormatSelect.value;
            const asZip = zipCheckbox.checked;
            let jsPDF;
            let zip;
            if (format === 'pdf') {
                if (typeof window.jspdf === 'undefined') throw new Error("Library jsPDF tidak termuat.");
                jsPDF = window.jspdf.jsPDF;
            }
            if (asZip) {
                if (typeof JSZip === 'undefined') throw new Error("Library JSZip tidak termuat.");
                zip = new JSZip();
            }
            let generatedCount = 0;
            for (const row of dataList) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
                for (const field of textFields) {
                    let style = "";
                    if (field.isItalic) style += "italic ";
                    if (field.isBold) style += "bold ";
                    ctx.font = `${style}${field.size}px "${field.family}"`;
                    ctx.fillStyle = field.color;
                    ctx.textAlign = field.align;
                    ctx.textBaseline = 'middle';
                    
                    // [PERBAIKAN] Terapkan Transform
                    let textToDraw = field.dataLink ? (row[field.dataLink] || '') : field.text;
                    if (field.dataLink) {
                        if (field.transform === 'titlecase') {
                            textToDraw = toTitleCase(textToDraw);
                        } else if (field.transform === 'uppercase') {
                            textToDraw = String(textToDraw).toUpperCase();
                        }
                    }
                    
                    ctx.fillText(textToDraw, field.x, field.y);
                }
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // [PERBAIKAN NAMA FILE]
                const firstColumnKey = dataHeaders.length > 0 ? dataHeaders[0] : 'sertifikat';
                const nameForFile = (firstColumnKey !== 'sertifikat' && row[firstColumnKey]) ? row[firstColumnKey] : `sertifikat_${generatedCount + 1}`;
                
                const titleCaseName = toTitleCase(String(nameForFile));
                // Hapus karakter ilegal, tapi biarkan spasi dan tanda hubung
                const cleanedName = titleCaseName.replace(/[\\/*?:"<>|]/g, ''); 
                const fileName = `S - ${cleanedName}`; // Format baru
                
                if (asZip) {
                    if (format === 'png') {
                        const dataURL = canvas.toDataURL('image/png');
                        const base64Data = dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
                        zip.file(`${fileName}.png`, base64Data, { base64: true });
                    } 
                    else if (format === 'pdf') {
                        const orientation = canvas.width > canvas.height ? 'l' : 'p';
                        const doc = new jsPDF({
                            orientation: orientation, unit: 'px', format: [canvas.width, canvas.height]
                        });
                        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                        const pdfBlob = doc.output('blob');
                        zip.file(`${fileName}.pdf`, pdfBlob);
                    }
                } else {
                    if (format === 'png') {
                        const dataURL = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = `${fileName}.png`;
                        link.href = dataURL;
                        link.click();
                    } 
                    else if (format === 'pdf') {
                        const orientation = canvas.width > canvas.height ? 'l' : 'p';
                        const doc = new jsPDF({
                            orientation: orientation, unit: 'px', format: [canvas.width, canvas.height]
                        });
                        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                        doc.save(`${fileName}.pdf`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                generatedCount++;
                const statusMsg = asZip ? `Memproses ${generatedCount}/${dataList.length} ke ZIP...` : `Mengunduh ${generatedCount}/${dataList.length}...`;
                bulkStatusDiv.textContent = statusMsg;
            }
            if (asZip) {
                bulkStatusDiv.textContent = "Membuat file .zip... (mohon tunggu)";
                const content = await zip.generateAsync({ type: "blob" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = 'Sertifikat_Massal.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
            bulkStatusDiv.textContent = `Selesai! ${generatedCount} sertifikat telah diproses.`;
            bulkStatusDiv.style.color = 'green';
        } catch (error) {
            bulkStatusDiv.textContent = `Gagal: ${error.message}`;
            bulkStatusDiv.style.color = 'red';
        } finally {
            generateBulkBtn.disabled = false;
            selectTextField(previouslySelected);
        }
    }, 10);
});

// --- PANGGIL FUNGSI SAAT SCRIPT DIMUAT ---
setupEyedropper();
addFontBtn.addEventListener('click', handleAddFont);
updateDataLinkDropdown(); // Panggil saat muat untuk mengisi opsi "Teks Statis"

// <-- TAMBAHKAN BLOK DI BAWAH INI -->
// Event Listener untuk Simpan/Muat Template
saveTemplateBtn.addEventListener('click', () => {
    if (textFields.length === 0) {
        alert("Tidak ada bidang teks untuk disimpan. Tambahkan teks terlebih dahulu.");
        return;
    }
    const dataStr = JSON.stringify(textFields, null, 2); // 'null, 2' untuk format cantik
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = 'sertifikat_template.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
});

loadTemplateBtn.addEventListener('click', () => {
    // Memicu input file tersembunyi
    loadTemplateInput.click();
});

loadTemplateInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!backgroundImage) {
        alert("Harap unggah desain sertifikat terlebih dahulu sebelum memuat template.");
        loadTemplateInput.value = ''; // Reset input
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsedJson = JSON.parse(event.target.result);
            if (!Array.isArray(parsedJson)) {
                throw new Error("File template tidak valid.");
            }
            textFields = parsedJson;
            // Set nextTextId agar tidak bentrok
            if (textFields.length > 0) {
                const maxId = Math.max(...textFields.map(f => f.id));
                nextTextId = maxId + 1;
            } else {
                nextTextId = 0;
            }
            redrawCanvas();
            selectTextField(null);
            alert("Template berhasil dimuat!");
        } catch (error) {
            alert(`Gagal memuat template: ${error.message}`);
        } finally {
            loadTemplateInput.value = ''; // Reset input agar bisa muat file yang sama
        }
    };
    reader.onerror = () => {
        alert("Gagal membaca file template.");
        loadTemplateInput.value = ''; 
    };
    reader.readAsText(file);
});
// <-- AKHIR BLOK TAMBAHAN -->
