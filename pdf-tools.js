(() => {
    'use strict';

    const TOOL_VERSION = '5.6';
    const MM_TO_PT = 2.834645669;
    const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
    const TESSDATA_BEST_URL = 'https://tessdata.projectnaptha.com/4.0.0_best';
    const FONTKIT_URL = 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
    const NOTO_SANS_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
    const editorState = {
        itemIndex: null,
        sourceBuffer: null,
        sourceLabel: '',
        pdfjs: null,
        pageCount: 0,
        currentPage: 1,
        selected: new Set(),
        deleted: new Set(),
        rotations: new Map(),
        renderToken: 0
    };
    const imageState = { entries: [], draggedId: null };
    const ocrState = {
        file: null,
        running: false,
        cancelRequested: false,
        worker: null,
        outputBlob: null,
        outputName: '',
        extractedText: '',
        pageCount: 0
    };

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .v54-modal { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(2,6,23,.82); backdrop-filter: blur(7px); }
            .v54-hidden { display: none !important; }
            .v54-panel { width: min(1500px, 98vw); max-height: 94vh; overflow: hidden; display: flex; flex-direction: column; border-radius: 20px; background: #fff; box-shadow: 0 28px 80px rgba(0,0,0,.4); }
            .v54-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; color: #fff; background: #0f172a; }
            .v54-close { width: 34px; height: 34px; border: 0; border-radius: 9px; color: #cbd5e1; background: #1e293b; cursor: pointer; }
            .v54-close:hover { color: #fff; background: #e11d48; }
            .v54-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
            .v54-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 34px; padding: 7px 11px; border: 1px solid #cbd5e1; border-radius: 9px; color: #334155; background: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }
            .v54-btn:hover { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }
            .v54-btn:disabled { opacity: .45; cursor: not-allowed; }
            .v54-btn-primary { border-color: #2563eb; color: #fff; background: #2563eb; }
            .v54-btn-primary:hover { color: #fff; background: #1d4ed8; }
            .v54-btn-green { border-color: #10b981; color: #fff; background: #059669; }
            .v54-btn-green:hover { color: #fff; background: #047857; }
            .v54-btn-danger { border-color: #fecdd3; color: #be123c; background: #fff1f2; }
            .v54-editor-body { min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(480px, 1fr) 390px; overflow: hidden; background: #e2e8f0; }
            .v54-preview-wrap { min-height: 0; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 18px; background: #0f172a; }
            #v54-editor-preview { max-width: 100%; height: auto; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.45); }
            .v54-pages { min-height: 0; overflow: auto; padding: 12px; background: #f8fafc; }
            .v54-page-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
            .v54-page-card { position: relative; min-height: 150px; overflow: hidden; border: 2px solid #dbe3ee; border-radius: 12px; background: #fff; cursor: pointer; }
            .v54-page-card:hover, .v54-page-card.current { border-color: #3b82f6; }
            .v54-page-card.selected { box-shadow: 0 0 0 2px #60a5fa inset; }
            .v54-page-card.deleted { opacity: .48; filter: grayscale(1); }
            .v54-page-thumb { width: 100%; height: 130px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #e2e8f0; }
            .v54-page-thumb canvas { max-width: 100%; max-height: 126px; transition: transform .18s ease; box-shadow: 0 2px 7px rgba(15,23,42,.18); }
            .v54-page-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; color: #475569; }
            .v54-deleted-mark { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; color: #fff; background: rgba(190,18,60,.7); font-size: 12px; font-weight: 800; }
            .v54-page-card.deleted .v54-deleted-mark { display: flex; }
            .v54-section { padding: 12px 14px; border-top: 1px solid #e2e8f0; background: #fff; }
            .v54-input { min-height: 34px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 9px; color: #0f172a; background: #fff; font-size: 12px; outline: none; }
            .v54-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
            .v54-image-body { min-height: 0; flex: 1; overflow: auto; padding: 15px; background: #f1f5f9; }
            .v54-image-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(170px,1fr)); gap: 12px; }
            .v54-image-card { overflow: hidden; border: 2px solid #dbe3ee; border-radius: 13px; background: #fff; box-shadow: 0 2px 8px rgba(15,23,42,.06); }
            .v54-image-card.dragging { opacity: .45; }
            .v54-image-card.drag-over { border-color: #2563eb; background: #eff6ff; }
            .v54-image-thumb { width: 100%; height: 145px; object-fit: contain; background: #e2e8f0; }
            .v54-image-name { overflow: hidden; padding: 7px 9px 3px; text-overflow: ellipsis; white-space: nowrap; color: #334155; font-size: 11px; font-weight: 700; }
            .v54-image-actions { display: flex; justify-content: center; gap: 5px; padding: 7px; }
            .v54-drop { padding: 22px; border: 2px dashed #93c5fd; border-radius: 14px; color: #475569; background: #eff6ff; text-align: center; cursor: pointer; }
            .v55-ocr-progress { height: 10px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
            .v55-ocr-progress > div { width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#0ea5e9,#2563eb); transition: width .2s ease; }
            .v55-ocr-preview { width: 100%; min-height: 180px; resize: vertical; padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; color: #0f172a; background: #f8fafc; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
            .v54-file-title-link { cursor: pointer; text-decoration: underline dotted transparent; text-underline-offset: 3px; }
            .v54-file-title-link:hover { color: #2563eb !important; text-decoration-color: #60a5fa; }
            @media (max-width: 900px) {
                .v54-editor-body { grid-template-columns: 1fr; grid-template-rows: minmax(360px,55vh) auto; overflow: auto; }
                .v54-pages { max-height: 45vh; }
                .v54-page-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
            }
            @media (max-width: 600px) { .v54-page-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
        `;
        document.head.appendChild(style);
    }

    function updateVersionUI() {
        document.title = `PDF Optimizer & Resizer Studio V${TOOL_VERSION}`;
        const badge = [...document.querySelectorAll('span')].find(el => /V5\.3\s*•\s*ENGINE/.test(el.textContent || ''));
        if (badge) badge.textContent = `V${TOOL_VERSION} • ENGINE TÍCH HỢP`;

        const footer = document.querySelector('footer');
        if (footer) {
            footer.innerHTML = `
                <div class="font-semibold text-slate-700 mb-1">Built by:</div>
                <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    <span><strong class="text-slate-700">Trần Quang Hải</strong> - email:
                        <a href="mailto:tranquanghai@tdtu.edu.vn" class="font-medium text-blue-600 hover:text-blue-700 hover:underline">tranquanghai@tdtu.edu.vn</a>
                    </span>
                    <span class="hidden sm:inline text-slate-300">•</span>
                    <span><strong class="text-slate-700">Trương Thị Thúy Diễm</strong> - email:
                        <a href="mailto:truongthithuydiem@tdtu.edu.vn" class="font-medium text-blue-600 hover:text-blue-700 hover:underline">truongthithuydiem@tdtu.edu.vn</a>
                    </span>
                </div>
                <div class="mt-1 text-[11px] text-slate-500">
                    Code developed with: <strong class="text-slate-700">OpenAI Codex</strong>
                    <span class="text-slate-400">(AI coding assistant)</span>
                </div>
            `;
        }
    }

    function addToolbarButtons() {
        const dropZone = document.getElementById('drop-zone');
        if (!dropZone || document.getElementById('v54-image-tool-button')) return;
        const toolbar = document.createElement('div');
        toolbar.id = 'v54-conversion-tools';
        toolbar.className = 'flex flex-wrap items-center justify-end gap-2 -mt-3 mb-6';
        toolbar.innerHTML = '<span class="text-[11px] font-semibold text-slate-400 mr-1">Công cụ chuyển đổi:</span>';
        const imageButton = document.createElement('button');
        imageButton.id = 'v54-image-tool-button';
        imageButton.className = 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2';
        imageButton.innerHTML = '<i class="fa-solid fa-images"></i> Ảnh → PDF';
        imageButton.addEventListener('click', openImageTool);
        toolbar.appendChild(imageButton);
        const ocrButton = document.createElement('button');
        ocrButton.id = 'v55-ocr-tool-button';
        ocrButton.className = 'bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2';
        ocrButton.innerHTML = '<i class="fa-solid fa-spell-check"></i> OCR cho Turnitin';
        ocrButton.addEventListener('click', openOcrTool);
        toolbar.appendChild(ocrButton);
        dropZone.insertAdjacentElement('afterend', toolbar);
    }

    function enhanceQueueRows() {
        const container = document.getElementById('file-queue-container');
        if (!container || typeof filesQueue === 'undefined') return;
        const rows = [...container.children].slice(0, filesQueue.length);
        rows.forEach((row, index) => {
            const title = row.querySelector('h4');
            if (title && !title.classList.contains('v54-file-title-link')) {
                title.classList.add('v54-file-title-link');
                title.title = `${title.title || filesQueue[index]?.name || ''} — Bấm để xem và chỉnh PDF`;
                title.addEventListener('click', () => openPdfEditor(index));
            }
            const settingsButton = row.querySelector('button[onclick^="toggleSettingsPanel"]');
            if (settingsButton && !row.querySelector('.v54-edit-pdf-button')) {
                const button = document.createElement('button');
                button.className = 'v54-edit-pdf-button bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5';
                button.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Chỉnh PDF';
                button.addEventListener('click', () => openPdfEditor(index));
                settingsButton.insertAdjacentElement('beforebegin', button);
            }
        });
    }

    function wrapQueueRenderer() {
        if (typeof updateQueueUI !== 'function' || updateQueueUI.__v54Wrapped) return;
        const original = updateQueueUI;
        const wrapped = function(...args) {
            const result = original.apply(this, args);
            requestAnimationFrame(enhanceQueueRows);
            return result;
        };
        wrapped.__v54Wrapped = true;
        updateQueueUI = wrapped;
    }

    function getPageDisplayBox(page) {
        try { return page.getCropBox(); } catch (_) { return page.getMediaBox(); }
    }

    async function detectWhiteMarginBounds(arrayBuffer, item) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const optimizationTask = typeof activeOptimizationTasks !== 'undefined' ? activeOptimizationTasks.get(item.id) : null;
        const unregisterCancel = optimizationTask && typeof registerCancelHandler === 'function'
            ? registerCancelHandler(optimizationTask, () => { try { loadingTask.destroy(); } catch (_) {} })
            : () => {};
        let pdf = null;
        const bounds = [];
        try {
            pdf = await loadingTask.promise;
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                if (optimizationTask && typeof throwIfCancelled === 'function') throwIfCancelled(optimizationTask);
                if (typeof updateItemProgress === 'function') {
                    await updateItemProgress(item.id, pageNumber - 1, pdf.numPages, `Đang phát hiện viền trắng trang ${pageNumber}/${pdf.numPages}...`);
                }
                const page = await pdf.getPage(pageNumber);
                const unit = page.getViewport({ scale: 1 });
                const scale = Math.min(1.5, 900 / Math.max(unit.width, unit.height));
                const viewport = page.getViewport({ scale: Math.max(.2, scale) });
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.ceil(viewport.width));
                canvas.height = Math.max(1, Math.ceil(viewport.height));
                const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
                context.fillStyle = '#FFFFFF';
                context.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: context, viewport }).promise;
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                const step = Math.max(1, Math.floor(Math.max(canvas.width, canvas.height) / 700));
                let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
                for (let y = 0; y < canvas.height; y += step) {
                    for (let x = 0; x < canvas.width; x += step) {
                        const offset = (y * canvas.width + x) * 4;
                        const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
                        // Chỉ xem vùng gần trắng là viền. Màu nền, ảnh, chữ và
                        // vector nhạt đều được giữ lại.
                        const isWhite = r >= 247 && g >= 247 && b >= 247 && Math.max(r, g, b) - Math.min(r, g, b) <= 8;
                        if (!isWhite) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                let normalized = { left: 0, top: 0, right: 1, bottom: 1 };
                if (maxX >= minX && maxY >= minY) {
                    const padX = Math.max(3, Math.round(canvas.width * .012));
                    const padY = Math.max(3, Math.round(canvas.height * .012));
                    minX = Math.max(0, minX - padX);
                    minY = Math.max(0, minY - padY);
                    maxX = Math.min(canvas.width - 1, maxX + padX);
                    maxY = Math.min(canvas.height - 1, maxY + padY);
                    normalized = {
                        left: minX / canvas.width,
                        top: minY / canvas.height,
                        right: (maxX + 1) / canvas.width,
                        bottom: (maxY + 1) / canvas.height
                    };
                    const margins = [normalized.left, normalized.top, 1 - normalized.right, 1 - normalized.bottom];
                    const significantEdges = margins.filter(value => value >= .008).length;
                    const maxMargin = Math.max(...margins);
                    const contentWidth = normalized.right - normalized.left;
                    const contentHeight = normalized.bottom - normalized.top;
                    // Chỉ cắt viền mỏng quanh ảnh hoặc dải trắng cô lập do lệch
                    // tỷ lệ. Không cắt lề bố cục của tài liệu chữ thông thường.
                    const thinFrame = maxMargin <= .035;
                    const isolatedStripe = significantEdges <= 2 && maxMargin <= .18;
                    if (contentWidth < .70 || contentHeight < .70 || (!thinFrame && !isolatedStripe)) {
                        normalized = { left: 0, top: 0, right: 1, bottom: 1 };
                    }
                }
                bounds.push(normalized);
                canvas.width = 1;
                canvas.height = 1;
                page.cleanup();
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        } finally {
            unregisterCancel();
            try { pdf?.destroy(); } catch (_) {}
        }
        return bounds;
    }

    function translateAnnotations(page, dx, dy) {
        try {
            const { PDFName, PDFArray, PDFDict, PDFNumber } = PDFLib;
            const annots = page.node.lookup(PDFName.of('Annots'));
            if (!(annots instanceof PDFArray)) return;
            for (let i = 0; i < annots.size(); i++) {
                const annot = annots.lookup(i);
                if (!(annot instanceof PDFDict)) continue;
                const rect = annot.lookup(PDFName.of('Rect'));
                if (!(rect instanceof PDFArray) || rect.size() !== 4) continue;
                rect.set(0, PDFNumber.of(rect.get(0).numberValue + dx));
                rect.set(1, PDFNumber.of(rect.get(1).numberValue + dy));
                rect.set(2, PDFNumber.of(rect.get(2).numberValue + dx));
                rect.set(3, PDFNumber.of(rect.get(3).numberValue + dy));
            }
        } catch (error) {
            console.warn('Không thể dịch tọa độ chú thích:', error);
        }
    }

    async function createAutoCroppedPdf(sourceFile, item) {
        const originalBuffer = await sourceFile.arrayBuffer();
        try {
            const bounds = await detectWhiteMarginBounds(originalBuffer, item);
            const pdfDoc = await PDFLib.PDFDocument.load(originalBuffer.slice(0), { ignoreEncryption: true });
            const pages = pdfDoc.getPages();
            pages.forEach((page, index) => {
                const box = getPageDisplayBox(page);
                const rotation = ((page.getRotation()?.angle || 0) % 360 + 360) % 360;
                const visual = rotation === 0 ? (bounds[index] || { left: 0, top: 0, right: 1, bottom: 1 }) : { left: 0, top: 0, right: 1, bottom: 1 };
                const cropX = box.x + visual.left * box.width;
                const cropY = box.y + (1 - visual.bottom) * box.height;
                const cropW = Math.max(1, (visual.right - visual.left) * box.width);
                const cropH = Math.max(1, (visual.bottom - visual.top) * box.height);
                page.translateContent(-cropX, -cropY);
                translateAnnotations(page, -cropX, -cropY);
                page.setMediaBox(0, 0, cropW, cropH);
                page.setCropBox(0, 0, cropW, cropH);
                try { page.setBleedBox(0, 0, cropW, cropH); } catch (_) {}
                try { page.setTrimBox(0, 0, cropW, cropH); } catch (_) {}
                try { page.setArtBox(0, 0, cropW, cropH); } catch (_) {}
            });
            const saved = await pdfDoc.save({ useObjectStreams: true, addMissingComponents: false });
            if (typeof showToast === 'function') showToast(`Đã tự động phát hiện và cắt viền trắng của ${item.name}`, 'success');
            return saved;
        } catch (error) {
            if (typeof isCancellationError === 'function' && isCancellationError(error)) throw error;
            const activeTask = typeof activeOptimizationTasks !== 'undefined' ? activeOptimizationTasks.get(item.id) : null;
            if (activeTask?.cancelled && typeof createCancellationError === 'function') throw createCancellationError();
            console.warn('Tự cắt viền không khả dụng, dùng PDF gốc:', error);
            if (typeof showToast === 'function') showToast(`Không thể tự cắt viền: ${error.message}. Tiếp tục bằng trang gốc.`, 'info');
            return new Uint8Array(originalBuffer);
        }
    }

    function installAutoCropPipeline() {
        if (typeof processSingleFile !== 'function' || processSingleFile.__v54AutoCrop) return;
        const original = processSingleFile;
        const wrapped = async function(index) {
            const item = filesQueue[index];
            if (!item || !item.settings || item.settings.targetSize === 'NONE' || item.status === 'processing') {
                return original(index);
            }
            const originalFile = item.file;
            let preparedPromise = null;
            const proxyFile = {
                name: originalFile.name,
                type: originalFile.type,
                size: originalFile.size,
                lastModified: originalFile.lastModified,
                async arrayBuffer() {
                    if (!preparedPromise) preparedPromise = createAutoCroppedPdf(originalFile, item);
                    const bytes = await preparedPromise;
                    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                }
            };
            item._v54OriginalFile = originalFile;
            item.file = proxyFile;
            try {
                return await original(index);
            } finally {
                item.file = originalFile;
                delete item._v54OriginalFile;
            }
        };
        wrapped.__v54AutoCrop = true;
        processSingleFile = wrapped;

        // Ở chế độ Rasterize, trang mới cũng phải ôm đúng tỷ lệ nội dung thay
        // vì tạo khổ cố định rồi căn giữa gây viền trắng trên/dưới.
        if (typeof processPdfRasterization === 'function') {
            const source = processPdfRasterization.toString();
            const oldBlock = `finalW = targetMM.width * 2.83465;\n                        finalH = targetMM.height * 2.83465;\n                        \n                        // Uniform scale for raster page fit and center\n                        scaleToFit = Math.min(finalW / origW, finalH / origH);\n                        tx = (finalW - (origW * scaleToFit)) / 2;\n                        ty = (finalH - (origH * scaleToFit)) / 2;`;
            const newBlock = `const maxW = targetMM.width * 2.83465;\n                        const maxH = targetMM.height * 2.83465;\n                        scaleToFit = Math.min(maxW / origW, maxH / origH);\n                        finalW = origW * scaleToFit;\n                        finalH = origH * scaleToFit;\n                        tx = 0;\n                        ty = 0;`;
            if (source.includes(oldBlock)) {
                window.eval(`processPdfRasterization = (${source.replace(oldBlock, newBlock)})`);
            }
        }
    }

    function sanitizeFileName(name) {
        return String(name || 'document')
            .replace(/\.pdf$/i, '')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim() || 'document';
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2500);
    }

    function setToolStatus(id, message, tone = 'slate') {
        const element = document.getElementById(id);
        if (!element) return;
        const colors = {
            slate: 'text-slate-500', blue: 'text-blue-700', green: 'text-emerald-700', rose: 'text-rose-700'
        };
        element.className = `text-xs font-semibold ${colors[tone] || colors.slate}`;
        element.textContent = message;
    }

    async function withBusyButton(button, busyLabel, action) {
        if (!button || button.disabled) return;
        const oldHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${busyLabel}`;
        try {
            await action();
        } catch (error) {
            console.error(error);
            if (typeof showToast === 'function') showToast(error.message || 'Không thể hoàn thành thao tác', 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = oldHtml;
        }
    }

    function createModals() {
        if (document.getElementById('v54-image-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="v54-image-modal" class="v54-modal v54-hidden" role="dialog" aria-modal="true" aria-labelledby="v54-image-title">
                <div class="v54-panel" style="width:min(1250px,98vw)">
                    <div class="v54-header">
                        <div>
                            <div id="v54-image-title" class="font-bold"><i class="fa-solid fa-images text-emerald-400 mr-2"></i>Chuyển hình ảnh thành PDF</div>
                            <div class="text-[11px] text-slate-400 mt-0.5">Kéo để sắp xếp • xuất chung một PDF hoặc từng PDF riêng</div>
                        </div>
                        <button id="v54-image-close" class="v54-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="v54-toolbar">
                        <input id="v54-image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden">
                        <button id="v54-image-add" class="v54-btn v54-btn-primary"><i class="fa-solid fa-plus"></i> Chọn hình</button>
                        <label class="text-xs font-semibold text-slate-600 ml-1">Khổ trang</label>
                        <select id="v54-image-page-mode" class="v54-input">
                            <option value="original">Theo tỷ lệ hình gốc</option>
                            <option value="a4">A4 tự xoay, Fit & Center</option>
                        </select>
                        <button id="v54-image-clear" class="v54-btn v54-btn-danger ml-auto"><i class="fa-solid fa-trash"></i> Xóa tất cả</button>
                    </div>
                    <div class="v54-image-body">
                        <div id="v54-image-drop" class="v54-drop">
                            <i class="fa-solid fa-cloud-arrow-up text-3xl text-blue-500 mb-2"></i>
                            <div class="font-bold">Kéo thả JPG, PNG hoặc WebP vào đây</div>
                            <div class="text-xs mt-1">Có thể chọn nhiều hình cùng lúc</div>
                        </div>
                        <div id="v54-image-grid" class="v54-image-grid mt-3"></div>
                    </div>
                    <div class="v54-section flex flex-wrap items-center gap-2">
                        <span id="v54-image-status" class="text-xs font-semibold text-slate-500">Chưa có hình ảnh</span>
                        <div class="ml-auto flex flex-wrap gap-2">
                            <button id="v54-image-export-separate" class="v54-btn"><i class="fa-solid fa-file-zipper"></i> Xuất từng PDF riêng</button>
                            <button id="v54-image-export-combined" class="v54-btn v54-btn-green"><i class="fa-solid fa-file-pdf"></i> Xuất 1 PDF</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="v55-ocr-modal" class="v54-modal v54-hidden" role="dialog" aria-modal="true" aria-labelledby="v55-ocr-title">
                <div class="v54-panel" style="width:min(1050px,98vw)">
                    <div class="v54-header">
                        <div>
                            <div id="v55-ocr-title" class="font-bold"><i class="fa-solid fa-spell-check text-sky-400 mr-2"></i>OCR PDF tiếng Việt cho Turnitin</div>
                            <div class="text-[11px] text-slate-400 mt-0.5">Giữ nguyên hình ảnh • thêm lớp chữ Unicode có thể bôi chọn và tìm kiếm</div>
                        </div>
                        <button id="v55-ocr-close" class="v54-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="v54-toolbar">
                        <input id="v55-ocr-input" type="file" accept="application/pdf,.pdf" class="hidden">
                        <button id="v55-ocr-select" class="v54-btn v54-btn-primary"><i class="fa-solid fa-file-pdf"></i> Chọn PDF</button>
                        <label class="text-xs font-semibold text-slate-600 ml-1" for="v55-ocr-language">Ngôn ngữ</label>
                        <select id="v55-ocr-language" class="v54-input">
                            <option value="vie" selected>Tiếng Việt — chính xác hơn</option>
                            <option value="vie+eng">Việt + Anh — tài liệu song ngữ</option>
                        </select>
                        <label class="text-xs font-semibold text-slate-600 ml-1" for="v55-ocr-dpi">Độ nét OCR</label>
                        <select id="v55-ocr-dpi" class="v54-input">
                            <option value="200">200 DPI — nhanh</option>
                            <option value="250">250 DPI — cân bằng</option>
                            <option value="300" selected>300 DPI — khuyên dùng</option>
                            <option value="400">400 DPI — chữ rất nhỏ</option>
                        </select>
                        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 ml-1">
                            <input id="v55-ocr-skip-text" type="checkbox" checked>
                            Bỏ qua trang đã có chữ
                        </label>
                        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 ml-1">
                            <input id="v55-ocr-high-accuracy" type="checkbox" checked>
                            Chính xác cao (2 lượt)
                        </label>
                        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 ml-1">
                            <input id="v55-ocr-auto-correct" type="checkbox" checked>
                            Sửa lỗi học thuật phổ biến
                        </label>
                    </div>
                    <div class="min-h-0 flex-1 overflow-auto p-4 bg-slate-100">
                        <div id="v55-ocr-drop" class="v54-drop">
                            <i class="fa-solid fa-cloud-arrow-up text-3xl text-sky-500 mb-2"></i>
                            <div class="font-bold">Kéo thả một file PDF dạng ảnh vào đây</div>
                            <div class="text-xs mt-1">Mặc định dùng mô hình tiếng Việt chất lượng cao; toàn bộ OCR thực hiện trên máy</div>
                        </div>
                        <div id="v55-ocr-file" class="v54-hidden mt-3 p-3 rounded-xl border border-sky-200 bg-white"></div>
                        <div class="mt-4">
                            <div class="flex items-center justify-between gap-3 mb-2">
                                <span id="v55-ocr-status" class="text-xs font-semibold text-slate-500">Chưa chọn PDF</span>
                                <span id="v55-ocr-percent" class="text-xs font-bold text-blue-700">0%</span>
                            </div>
                            <div class="v55-ocr-progress"><div id="v55-ocr-progress-bar"></div></div>
                        </div>
                        <div class="mt-4">
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <label for="v55-ocr-preview" class="text-xs font-bold text-slate-700">Văn bản OCR để kiểm tra</label>
                                <span id="v55-ocr-summary" class="text-[11px] text-slate-500">Chưa có kết quả</span>
                            </div>
                            <textarea id="v55-ocr-preview" class="v55-ocr-preview" readonly placeholder="Nội dung nhận dạng sẽ xuất hiện tại đây…"></textarea>
                        </div>
                        <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                            <strong>Lưu ý:</strong> OCR giúp Turnitin đọc PDF dạng ảnh nhưng không thể đảm bảo đúng tuyệt đối. Hãy kiểm tra tên riêng, dấu tiếng Việt và thứ tự cột trước khi nộp.
                        </div>
                    </div>
                    <div class="v54-section flex flex-wrap items-center gap-2">
                        <button id="v55-ocr-reset" class="v54-btn v54-btn-danger"><i class="fa-solid fa-trash-arrow-up"></i> Chọn file khác</button>
                        <div class="ml-auto flex flex-wrap gap-2">
                            <button id="v55-ocr-download-text" class="v54-btn" disabled><i class="fa-solid fa-file-lines"></i> Tải TXT kiểm tra</button>
                            <button id="v55-ocr-download" class="v54-btn v54-btn-green" disabled><i class="fa-solid fa-download"></i> Tải PDF cho Turnitin</button>
                            <button id="v55-ocr-start" class="v54-btn v54-btn-primary"><i class="fa-solid fa-wand-magic-sparkles"></i> Bắt đầu OCR</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="v54-editor-modal" class="v54-modal v54-hidden" role="dialog" aria-modal="true" aria-labelledby="v54-editor-title">
                <div class="v54-panel">
                    <div class="v54-header">
                        <div class="min-w-0">
                            <div id="v54-editor-title" class="font-bold truncate"><i class="fa-solid fa-pen-ruler text-violet-400 mr-2"></i>Chỉnh sửa PDF</div>
                            <div id="v54-editor-source" class="text-[11px] text-slate-400 mt-0.5 truncate"></div>
                        </div>
                        <button id="v54-editor-close" class="v54-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="v54-toolbar">
                        <button id="v54-editor-select-all" class="v54-btn"><i class="fa-regular fa-square-check"></i> Chọn tất cả</button>
                        <button id="v54-editor-select-none" class="v54-btn"><i class="fa-regular fa-square"></i> Bỏ chọn</button>
                        <span class="h-7 w-px bg-slate-300 mx-1"></span>
                        <button id="v54-editor-rotate-left" class="v54-btn"><i class="fa-solid fa-rotate-left"></i> Xoay trái</button>
                        <button id="v54-editor-rotate-right" class="v54-btn"><i class="fa-solid fa-rotate-right"></i> Xoay phải</button>
                        <button id="v54-editor-delete" class="v54-btn v54-btn-danger"><i class="fa-solid fa-trash"></i> Xóa trang</button>
                        <button id="v54-editor-restore" class="v54-btn"><i class="fa-solid fa-trash-arrow-up"></i> Khôi phục</button>
                        <span id="v54-editor-status" class="ml-auto text-xs font-semibold text-slate-500">Đang tải…</span>
                    </div>
                    <div class="v54-editor-body">
                        <div class="v54-preview-wrap"><canvas id="v54-editor-preview"></canvas></div>
                        <aside class="v54-pages">
                            <div class="text-xs text-slate-500 mb-2">Bấm trang để xem; đánh dấu ô để thao tác nhiều trang.</div>
                            <div id="v54-page-grid" class="v54-page-grid"></div>
                        </aside>
                    </div>
                    <div class="v54-section">
                        <div class="flex flex-wrap items-center gap-2">
                            <label for="v54-split-ranges" class="text-xs font-bold text-slate-700">Cụm trang:</label>
                            <input id="v54-split-ranges" class="v54-input flex-1 min-w-[250px]" placeholder="Ví dụ: 1-10, 11-20, 21-25">
                            <button id="v54-split-ranges-button" class="v54-btn"><i class="fa-solid fa-scissors"></i> Tách theo cụm</button>
                            <button id="v54-split-pages-button" class="v54-btn"><i class="fa-solid fa-layer-group"></i> Tách từng trang</button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                            <span class="text-[11px] text-slate-500">Các thay đổi không ghi đè file gốc. “Lưu phiên bản” sẽ thêm một phiên bản mới vào danh sách.</span>
                            <div class="ml-auto flex flex-wrap gap-2">
                                <button id="v54-editor-download" class="v54-btn"><i class="fa-solid fa-download"></i> Tải bản đã chỉnh</button>
                                <button id="v54-editor-save-version" class="v54-btn v54-btn-green"><i class="fa-solid fa-code-branch"></i> Lưu phiên bản mới</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        const imageInput = document.getElementById('v54-image-input');
        const imageDrop = document.getElementById('v54-image-drop');
        document.getElementById('v54-image-close').addEventListener('click', closeImageTool);
        document.getElementById('v54-image-add').addEventListener('click', () => imageInput.click());
        imageDrop.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', event => {
            addImageFiles(event.target.files);
            event.target.value = '';
        });
        ['dragenter', 'dragover'].forEach(type => imageDrop.addEventListener(type, event => {
            event.preventDefault();
            imageDrop.classList.add('ring-4', 'ring-blue-200');
        }));
        ['dragleave', 'drop'].forEach(type => imageDrop.addEventListener(type, event => {
            event.preventDefault();
            imageDrop.classList.remove('ring-4', 'ring-blue-200');
        }));
        imageDrop.addEventListener('drop', event => addImageFiles(event.dataTransfer.files));
        document.getElementById('v54-image-clear').addEventListener('click', clearImages);
        document.getElementById('v54-image-grid').addEventListener('click', handleImageGridClick);
        document.getElementById('v54-image-grid').addEventListener('dragstart', handleImageDragStart);
        document.getElementById('v54-image-grid').addEventListener('dragover', handleImageDragOver);
        document.getElementById('v54-image-grid').addEventListener('drop', handleImageDrop);
        document.getElementById('v54-image-grid').addEventListener('dragend', clearImageDragStyles);
        document.getElementById('v54-image-export-combined').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang tạo PDF…', exportImagesCombined));
        document.getElementById('v54-image-export-separate').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang đóng gói…', exportImagesSeparate));

        const ocrInput = document.getElementById('v55-ocr-input');
        const ocrDrop = document.getElementById('v55-ocr-drop');
        document.getElementById('v55-ocr-close').addEventListener('click', closeOcrTool);
        document.getElementById('v55-ocr-select').addEventListener('click', () => ocrInput.click());
        ocrDrop.addEventListener('click', () => ocrInput.click());
        ocrInput.addEventListener('change', event => {
            selectOcrFile(event.target.files?.[0]);
            event.target.value = '';
        });
        ['dragenter', 'dragover'].forEach(type => ocrDrop.addEventListener(type, event => {
            event.preventDefault();
            ocrDrop.classList.add('ring-4', 'ring-sky-200');
        }));
        ['dragleave', 'drop'].forEach(type => ocrDrop.addEventListener(type, event => {
            event.preventDefault();
            ocrDrop.classList.remove('ring-4', 'ring-sky-200');
        }));
        ocrDrop.addEventListener('drop', event => selectOcrFile([...(event.dataTransfer?.files || [])].find(file => /\.pdf$/i.test(file.name))));
        document.getElementById('v55-ocr-reset').addEventListener('click', resetOcrTool);
        document.getElementById('v55-ocr-start').addEventListener('click', handleOcrStartStop);
        document.getElementById('v55-ocr-download').addEventListener('click', downloadOcrPdf);
        document.getElementById('v55-ocr-download-text').addEventListener('click', downloadOcrText);

        document.getElementById('v54-editor-close').addEventListener('click', closePdfEditor);
        document.getElementById('v54-editor-select-all').addEventListener('click', selectAllEditorPages);
        document.getElementById('v54-editor-select-none').addEventListener('click', clearEditorSelection);
        document.getElementById('v54-editor-rotate-left').addEventListener('click', () => rotateEditorPages(-90));
        document.getElementById('v54-editor-rotate-right').addEventListener('click', () => rotateEditorPages(90));
        document.getElementById('v54-editor-delete').addEventListener('click', () => setEditorPagesDeleted(true));
        document.getElementById('v54-editor-restore').addEventListener('click', () => setEditorPagesDeleted(false));
        document.getElementById('v54-page-grid').addEventListener('click', handleEditorGridClick);
        document.getElementById('v54-page-grid').addEventListener('change', handleEditorGridChange);
        document.getElementById('v54-editor-save-version').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang lưu…', saveEditedVersion));
        document.getElementById('v54-editor-download').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang tạo…', downloadEditedPdf));
        document.getElementById('v54-split-pages-button').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang tách…', splitEveryPage));
        document.getElementById('v54-split-ranges-button').addEventListener('click', event =>
            withBusyButton(event.currentTarget, 'Đang tách…', splitByRanges));

        [document.getElementById('v54-image-modal'), document.getElementById('v55-ocr-modal'), document.getElementById('v54-editor-modal')].forEach(modal => {
            modal.addEventListener('mousedown', event => {
                if (event.target !== modal) return;
                if (modal === document.getElementById('v54-image-modal')) closeImageTool();
                else if (modal === document.getElementById('v55-ocr-modal')) closeOcrTool();
                else closePdfEditor();
            });
        });
    }

    function openImageTool() {
        document.getElementById('v54-image-modal')?.classList.remove('v54-hidden');
    }

    function openOcrTool() {
        document.getElementById('v55-ocr-modal')?.classList.remove('v54-hidden');
    }

    function closeOcrTool() {
        document.getElementById('v55-ocr-modal')?.classList.add('v54-hidden');
    }

    function loadBrowserScript(id, source, ready) {
        if (ready()) return Promise.resolve();
        const existing = document.getElementById(id);
        if (existing?._loadPromise) return existing._loadPromise;
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.id = id;
        script.src = source;
        script.crossOrigin = 'anonymous';
        script._loadPromise = new Promise((resolve, reject) => {
            script.addEventListener('load', () => ready() ? resolve() : reject(new Error(`Thư viện ${id} không khởi tạo được.`)), { once: true });
            script.addEventListener('error', () => reject(new Error(`Không tải được thư viện ${id}.`)), { once: true });
        });
        document.head.appendChild(script);
        return script._loadPromise;
    }

    function setOcrProgress(percent, message, tone = 'blue') {
        const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
        const bar = document.getElementById('v55-ocr-progress-bar');
        if (bar) bar.style.width = `${value}%`;
        const label = document.getElementById('v55-ocr-percent');
        if (label) label.textContent = `${value}%`;
        if (message) setToolStatus('v55-ocr-status', message, tone);
    }

    function setOcrRunning(running) {
        ocrState.running = running;
        const button = document.getElementById('v55-ocr-start');
        if (!button) return;
        button.disabled = false;
        if (running) {
            button.className = 'v54-btn !border-red-600 !bg-red-600 !text-white hover:!bg-red-700';
            button.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng OCR';
        } else {
            button.className = 'v54-btn v54-btn-primary';
            button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Bắt đầu OCR';
        }
    }

    function selectOcrFile(file) {
        if (!file) return;
        if (ocrState.running) {
            if (typeof showToast === 'function') showToast('Hãy dừng OCR trước khi đổi file.', 'info');
            return;
        }
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
            if (typeof showToast === 'function') showToast('Chức năng OCR chỉ nhận file PDF.', 'info');
            return;
        }
        ocrState.file = file;
        ocrState.outputBlob = null;
        ocrState.outputName = '';
        ocrState.extractedText = '';
        ocrState.pageCount = 0;
        const fileBox = document.getElementById('v55-ocr-file');
        fileBox.classList.remove('v54-hidden');
        fileBox.innerHTML = `<div class="flex items-center gap-3"><i class="fa-solid fa-file-pdf text-2xl text-red-500"></i><div class="min-w-0"><div class="font-bold text-sm text-slate-800 truncate">${typeof escapeHtml === 'function' ? escapeHtml(file.name) : file.name}</div><div class="text-[11px] text-slate-500">${typeof formatBytes === 'function' ? formatBytes(file.size) : Math.round(file.size / 1024) + ' KB'}</div></div></div>`;
        document.getElementById('v55-ocr-drop')?.classList.add('v54-hidden');
        document.getElementById('v55-ocr-preview').value = '';
        document.getElementById('v55-ocr-summary').textContent = 'Sẵn sàng nhận dạng';
        document.getElementById('v55-ocr-download').disabled = true;
        document.getElementById('v55-ocr-download-text').disabled = true;
        setOcrProgress(0, 'Đã chọn PDF • sẵn sàng OCR', 'green');
    }

    async function resetOcrTool() {
        if (ocrState.running) await stopOcr();
        ocrState.file = null;
        ocrState.outputBlob = null;
        ocrState.outputName = '';
        ocrState.extractedText = '';
        ocrState.pageCount = 0;
        document.getElementById('v55-ocr-file')?.classList.add('v54-hidden');
        document.getElementById('v55-ocr-drop')?.classList.remove('v54-hidden');
        document.getElementById('v55-ocr-preview').value = '';
        document.getElementById('v55-ocr-summary').textContent = 'Chưa có kết quả';
        document.getElementById('v55-ocr-download').disabled = true;
        document.getElementById('v55-ocr-download-text').disabled = true;
        setOcrProgress(0, 'Chưa chọn PDF', 'slate');
    }

    function flattenOcrLines(blocks) {
        const lines = [];
        for (const block of blocks || []) {
            for (const paragraph of block.paragraphs || []) {
                for (const line of paragraph.lines || []) {
                    const text = String(line.text || '').replace(/\s+/g, ' ').trim().normalize('NFC');
                    if (text && line.bbox) lines.push({ text, bbox: line.bbox, confidence: Number(line.confidence ?? paragraph.confidence ?? block.confidence ?? 0) });
                }
            }
        }
        return lines;
    }

    function preserveOcrCase(source, replacement) {
        if (source === source.toUpperCase()) return replacement.toUpperCase();
        if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
        return replacement;
    }

    function correctCommonVietnameseOcr(text) {
        const replacements = [
            [/đồ\s+(?:ó\s+)?an/giu, 'đồ án'],
            [/thi[eế]t\s+k[eế]\s+nội\s+th[aấ]t/giu, 'thiết kế nội thất'],
            [/trung\s+tam/giu, 'trung tâm'],
            [/ch[aă]m\s+s[oó]c/giu, 'chăm sóc'],
            [/th[uú]\s+cung/giu, 'thú cưng'],
            [/ph[aầ]n\s+giới\s+thiệu/giu, 'phần giới thiệu'],
            [/th[éeôó]ng\s+tin\s+chung\s+(?:d[eéề]\s*)?t[aàá]i/giu, 'thông tin chung đề tài'],
            [/l[úyý]\s+do\s+ch[oọ]n\s+(?:d[eéề]\s*)?t[aàá]i/giu, 'lý do chọn đề tài'],
            [/phạm\s*vi\s+v[aà]\s+giới\s+hạn\s+nghi[eê]n\s+c[uứ]u/giu, 'phạm vi và giới hạn nghiên cứu'],
            [/[yý]\s+tưởng\s+thi[eế]t\s+k[eế]/giu, 'ý tưởng thiết kế'],
            [/tp\.\s*h[oồ]\s*chí\s*minh/giu, 'TP. Hồ Chí Minh']
        ];
        return replacements.reduce((result, [pattern, replacement]) =>
            result.replace(pattern, match => preserveOcrCase(match, replacement)), String(text || '').normalize('NFC'));
    }

    function enhanceOcrCanvas(sourceCanvas) {
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.filter = 'grayscale(1) contrast(1.38)';
        context.drawImage(sourceCanvas, 0, 0);
        context.filter = 'none';
        return canvas;
    }

    function scoreOcrResult(result) {
        const text = String(result?.data?.text || '');
        const confidence = Number(result?.data?.confidence || 0);
        const vietnameseMarks = (text.match(/[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gu) || []).length;
        const noise = (text.match(/[#|^`{}\[\]<>]/g) || []).length;
        const usefulLength = text.replace(/\s/g, '').length;
        return confidence + Math.min(8, vietnameseMarks * .08) - Math.min(18, noise * 2) + Math.min(4, usefulLength / 500);
    }

    async function recognizeOcrPage(worker, canvas, highAccuracy, pageTextHint) {
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.AUTO });
        const first = await worker.recognize(canvas, {}, { text: true, blocks: true });
        if (!highAccuracy) return first;
        const enhanced = enhanceOcrCanvas(canvas);
        try {
            const sparseLayout = String(first.data.text || pageTextHint || '').replace(/\s/g, '').length < 450;
            await worker.setParameters({ tessedit_pageseg_mode: sparseLayout ? Tesseract.PSM.SPARSE_TEXT : Tesseract.PSM.AUTO });
            const second = await worker.recognize(enhanced, {}, { text: true, blocks: true });
            return scoreOcrResult(second) > scoreOcrResult(first) ? second : first;
        } finally {
            enhanced.width = 1;
            enhanced.height = 1;
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.AUTO });
        }
    }

    function filterFontText(text, supportedCodePoints) {
        return Array.from(String(text || ''))
            .filter(character => {
                const code = character.codePointAt(0);
                return (code >= 32 || character === '\t') && supportedCodePoints.has(code);
            })
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function addInvisibleOcrLine(page, font, supportedCodePoints, line, canvasWidth, canvasHeight) {
        const text = filterFontText(line.text, supportedCodePoints);
        if (!text) return 0;
        const box = typeof page.getCropBox === 'function' ? page.getCropBox() : { x: 0, y: 0, ...page.getSize() };
        const x = box.x + (line.bbox.x0 / canvasWidth) * box.width;
        const y = box.y + box.height - (line.bbox.y1 / canvasHeight) * box.height;
        const targetWidth = Math.max(1, ((line.bbox.x1 - line.bbox.x0) / canvasWidth) * box.width);
        const fontSize = Math.max(2, Math.min(72, ((line.bbox.y1 - line.bbox.y0) / canvasHeight) * box.height * .88));
        const naturalWidth = Math.max(.1, font.widthOfTextAtSize(text, fontSize));
        const horizontalScale = Math.max(25, Math.min(200, (targetWidth / naturalWidth) * 100));
        page.setFont(font);
        page.pushOperators(
            PDFLib.pushGraphicsState(),
            PDFLib.beginText(),
            PDFLib.setFontAndSize(page.fontKey, fontSize),
            PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Invisible),
            PDFLib.setCharacterSqueeze(horizontalScale),
            PDFLib.moveText(x, y),
            PDFLib.showText(font.encodeText(text)),
            PDFLib.endText(),
            PDFLib.popGraphicsState()
        );
        return text.length;
    }

    async function ensureOcrDependencies() {
        setOcrProgress(1, 'Đang tải bộ máy OCR tiếng Việt…', 'blue');
        await Promise.all([
            loadBrowserScript('v55-tesseract-script', TESSERACT_URL, () => !!window.Tesseract?.createWorker),
            loadBrowserScript('v55-fontkit-script', FONTKIT_URL, () => !!window.fontkit)
        ]);
    }

    async function verifyOcrPdf(bytes) {
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
        let pdf = null;
        let pagesWithText = 0;
        let characterCount = 0;
        try {
            pdf = await loadingTask.promise;
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();
                const text = content.items.map(item => item.str || '').join(' ').trim();
                if (text) pagesWithText++;
                characterCount += text.length;
                page.cleanup();
            }
            return { pagesWithText, characterCount, pageCount: pdf.numPages };
        } finally {
            try { pdf?.destroy(); } catch (_) {}
        }
    }

    async function runOcr() {
        if (!ocrState.file) throw new Error('Hãy chọn một file PDF trước khi OCR.');
        ocrState.cancelRequested = false;
        ocrState.outputBlob = null;
        ocrState.extractedText = '';
        document.getElementById('v55-ocr-preview').value = '';
        document.getElementById('v55-ocr-download').disabled = true;
        document.getElementById('v55-ocr-download-text').disabled = true;
        setOcrRunning(true);
        let sourcePdf = null;
        try {
            await ensureOcrDependencies();
            if (ocrState.cancelRequested) throw new Error('Đã dừng OCR.');
            const sourceBytes = await ocrState.file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: sourceBytes.slice(0) });
            sourcePdf = await loadingTask.promise;
            ocrState.pageCount = sourcePdf.numPages;
            const outputDoc = await PDFLib.PDFDocument.load(sourceBytes.slice(0), { ignoreEncryption: true });
            outputDoc.registerFontkit(window.fontkit);
            setOcrProgress(3, 'Đang tải font Unicode tiếng Việt…', 'blue');
            const fontResponse = await fetch(NOTO_SANS_URL);
            if (!fontResponse.ok) throw new Error(`Không tải được font Unicode (${fontResponse.status}).`);
            const unicodeFont = await outputDoc.embedFont(await fontResponse.arrayBuffer(), { subset: true });
            const supportedCodePoints = new Set(unicodeFont.getCharacterSet());
            const pdfPages = outputDoc.getPages();
            const dpi = Number(document.getElementById('v55-ocr-dpi').value || 300);
            const language = document.getElementById('v55-ocr-language').value || 'vie';
            const highAccuracy = document.getElementById('v55-ocr-high-accuracy').checked;
            const autoCorrect = document.getElementById('v55-ocr-auto-correct').checked;
            const skipExistingText = document.getElementById('v55-ocr-skip-text').checked;
            let activePage = 0;
            ocrState.worker = await Tesseract.createWorker(language, Tesseract.OEM.LSTM_ONLY, {
                langPath: TESSDATA_BEST_URL,
                logger: message => {
                    if (!ocrState.running || !message) return;
                    const stage = String(message.status || 'Đang nhận dạng').replace(/^./, character => character.toUpperCase());
                    const pageProgress = Number(message.progress || 0);
                    const overall = 5 + ((activePage + pageProgress) / Math.max(1, ocrState.pageCount)) * 87;
                    setOcrProgress(overall, `Trang ${Math.min(activePage + 1, ocrState.pageCount)}/${ocrState.pageCount} • ${stage}`, 'blue');
                }
            });
            await ocrState.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                preserve_interword_spaces: '1',
                user_defined_dpi: String(dpi),
                thresholding_method: '2',
                tessedit_do_invert: '1'
            });
            const extractedPages = [];
            let recognizedPages = 0;
            let skippedPages = 0;
            for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber++) {
                if (ocrState.cancelRequested) throw new Error('Đã dừng OCR.');
                activePage = pageNumber - 1;
                const sourcePage = await sourcePdf.getPage(pageNumber);
                if (skipExistingText) {
                    const existing = await sourcePage.getTextContent();
                    const existingText = existing.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
                    if (existingText.length >= 20) {
                        extractedPages.push(existingText);
                        skippedPages++;
                        sourcePage.cleanup();
                        setOcrProgress(5 + (pageNumber / sourcePdf.numPages) * 87, `Trang ${pageNumber}/${sourcePdf.numPages} đã có chữ • bỏ qua OCR`, 'blue');
                        continue;
                    }
                }
                const baseViewport = sourcePage.getViewport({ scale: 1 });
                let scale = dpi / 72;
                const maxPixels = 22_000_000;
                const estimatedPixels = baseViewport.width * scale * baseViewport.height * scale;
                if (estimatedPixels > maxPixels) scale *= Math.sqrt(maxPixels / estimatedPixels);
                const viewport = sourcePage.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.ceil(viewport.width));
                canvas.height = Math.max(1, Math.ceil(viewport.height));
                const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
                context.fillStyle = '#fff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                await sourcePage.render({ canvasContext: context, viewport }).promise;
                const result = await recognizeOcrPage(ocrState.worker, canvas, highAccuracy, '');
                const lines = flattenOcrLines(result.data.blocks).map(line => ({
                    ...line,
                    text: autoCorrect ? correctCommonVietnameseOcr(line.text) : line.text
                }));
                const rawPageText = String(result.data.text || lines.map(line => line.text).join('\n')).trim().normalize('NFC');
                const pageText = autoCorrect ? correctCommonVietnameseOcr(rawPageText) : rawPageText;
                extractedPages.push(pageText);
                for (const line of lines) addInvisibleOcrLine(pdfPages[pageNumber - 1], unicodeFont, supportedCodePoints, line, canvas.width, canvas.height);
                recognizedPages++;
                document.getElementById('v55-ocr-preview').value = extractedPages.join('\n\n--- Trang mới ---\n\n').slice(0, 120000);
                const wordCount = extractedPages.join(' ').trim().split(/\s+/).filter(Boolean).length;
                document.getElementById('v55-ocr-summary').textContent = `${recognizedPages} trang OCR • khoảng ${wordCount.toLocaleString('vi-VN')} từ`;
                canvas.width = 1;
                canvas.height = 1;
                sourcePage.cleanup();
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (ocrState.cancelRequested) throw new Error('Đã dừng OCR.');
            ocrState.extractedText = extractedPages.join('\n\n--- Trang mới ---\n\n');
            setOcrProgress(94, 'Đang nhúng font Unicode và tạo PDF…', 'blue');
            const outputBytes = await outputDoc.save({ useObjectStreams: true, addDefaultPage: false });
            setOcrProgress(97, 'Đang kiểm tra lớp văn bản đầu ra…', 'blue');
            const verification = await verifyOcrPdf(outputBytes);
            if (!verification.characterCount) throw new Error('PDF đầu ra chưa có văn bản trích xuất được.');
            ocrState.outputBlob = new Blob([outputBytes], { type: 'application/pdf' });
            ocrState.outputName = `${sanitizeFileName(ocrState.file.name)}_Turnitin_OCR.pdf`;
            document.getElementById('v55-ocr-download').disabled = false;
            document.getElementById('v55-ocr-download-text').disabled = false;
            document.getElementById('v55-ocr-summary').textContent = `${recognizedPages} trang OCR • ${skippedPages} trang đã có chữ • ${verification.characterCount.toLocaleString('vi-VN')} ký tự kiểm tra được`;
            setOcrProgress(100, `Hoàn tất • ${verification.pagesWithText}/${verification.pageCount} trang có thể trích xuất chữ`, 'green');
            if (typeof showToast === 'function') showToast('OCR hoàn tất. PDF đã có lớp chữ Unicode cho Turnitin.', 'success');
        } catch (error) {
            const stopped = ocrState.cancelRequested || /Đã dừng OCR/i.test(error.message || '');
            setOcrProgress(0, stopped ? 'Đã dừng OCR theo yêu cầu.' : `OCR lỗi: ${error.message}`, stopped ? 'slate' : 'rose');
            if (!stopped) throw error;
        } finally {
            try { await ocrState.worker?.terminate(); } catch (_) {}
            ocrState.worker = null;
            try { sourcePdf?.destroy(); } catch (_) {}
            setOcrRunning(false);
        }
    }

    async function stopOcr() {
        if (!ocrState.running) return;
        ocrState.cancelRequested = true;
        setToolStatus('v55-ocr-status', 'Đang dừng OCR…', 'rose');
        try { await ocrState.worker?.terminate(); } catch (_) {}
        ocrState.worker = null;
    }

    async function handleOcrStartStop() {
        if (ocrState.running) {
            await stopOcr();
            return;
        }
        try {
            await runOcr();
        } catch (error) {
            console.error('OCR Turnitin:', error);
            if (typeof showToast === 'function') showToast(error.message || 'Không thể OCR PDF.', 'error');
        }
    }

    function downloadOcrPdf() {
        if (!ocrState.outputBlob) return;
        downloadBlob(ocrState.outputBlob, ocrState.outputName || 'Turnitin_OCR.pdf');
    }

    function downloadOcrText() {
        if (!ocrState.extractedText) return;
        const blob = new Blob([`\uFEFF${ocrState.extractedText}`], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${sanitizeFileName(ocrState.file?.name)}_OCR_kiem_tra.txt`);
    }

    function closeImageTool() {
        document.getElementById('v54-image-modal')?.classList.add('v54-hidden');
    }

    async function addImageFiles(fileList) {
        const accepted = [...(fileList || [])].filter(file => /^image\/(jpeg|png|webp)$/i.test(file.type));
        if (!accepted.length) {
            if (fileList?.length && typeof showToast === 'function') showToast('Chỉ hỗ trợ hình JPG, PNG và WebP.', 'info');
            return;
        }
        setToolStatus('v54-image-status', `Đang đọc ${accepted.length} hình…`, 'blue');
        for (const file of accepted) {
            try {
                const bitmap = await createImageBitmap(file);
                imageState.entries.push({
                    id: `image_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    file,
                    width: bitmap.width,
                    height: bitmap.height,
                    url: URL.createObjectURL(file)
                });
                bitmap.close();
            } catch (error) {
                console.warn(`Không đọc được ${file.name}:`, error);
            }
        }
        renderImageList();
    }

    function renderImageList() {
        const grid = document.getElementById('v54-image-grid');
        const drop = document.getElementById('v54-image-drop');
        if (!grid) return;
        drop?.classList.toggle('v54-hidden', imageState.entries.length > 0);
        grid.innerHTML = imageState.entries.map((entry, index) => `
            <article class="v54-image-card" draggable="true" data-image-id="${entry.id}">
                <img class="v54-image-thumb" src="${entry.url}" alt="${typeof escapeHtml === 'function' ? escapeHtml(entry.file.name) : entry.file.name}">
                <div class="v54-image-name" title="${typeof escapeHtml === 'function' ? escapeHtml(entry.file.name) : entry.file.name}">${index + 1}. ${typeof escapeHtml === 'function' ? escapeHtml(entry.file.name) : entry.file.name}</div>
                <div class="px-2 text-[10px] text-center text-slate-400">${entry.width} × ${entry.height}px</div>
                <div class="v54-image-actions">
                    <button class="v54-btn !min-h-[28px] !px-2" data-action="up" title="Lên"><i class="fa-solid fa-arrow-left"></i></button>
                    <button class="v54-btn !min-h-[28px] !px-2" data-action="down" title="Xuống"><i class="fa-solid fa-arrow-right"></i></button>
                    <button class="v54-btn v54-btn-danger !min-h-[28px] !px-2" data-action="remove" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                </div>
            </article>
        `).join('');
        const totalSize = imageState.entries.reduce((sum, entry) => sum + entry.file.size, 0);
        setToolStatus('v54-image-status', imageState.entries.length
            ? `${imageState.entries.length} hình • ${typeof formatBytes === 'function' ? formatBytes(totalSize) : Math.round(totalSize / 1024) + ' KB'}`
            : 'Chưa có hình ảnh', imageState.entries.length ? 'green' : 'slate');
    }

    function clearImages() {
        imageState.entries.forEach(entry => URL.revokeObjectURL(entry.url));
        imageState.entries = [];
        renderImageList();
    }

    function handleImageGridClick(event) {
        const button = event.target.closest('[data-action]');
        const card = event.target.closest('[data-image-id]');
        if (!button || !card) return;
        const index = imageState.entries.findIndex(entry => entry.id === card.dataset.imageId);
        if (index < 0) return;
        if (button.dataset.action === 'remove') {
            URL.revokeObjectURL(imageState.entries[index].url);
            imageState.entries.splice(index, 1);
        } else {
            const target = button.dataset.action === 'up' ? index - 1 : index + 1;
            if (target >= 0 && target < imageState.entries.length) {
                [imageState.entries[index], imageState.entries[target]] = [imageState.entries[target], imageState.entries[index]];
            }
        }
        renderImageList();
    }

    function handleImageDragStart(event) {
        const card = event.target.closest('[data-image-id]');
        if (!card) return;
        imageState.draggedId = card.dataset.imageId;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', imageState.draggedId);
    }

    function handleImageDragOver(event) {
        const card = event.target.closest('[data-image-id]');
        if (!card || card.dataset.imageId === imageState.draggedId) return;
        event.preventDefault();
        clearImageDragStyles();
        card.classList.add('drag-over');
    }

    function handleImageDrop(event) {
        const card = event.target.closest('[data-image-id]');
        if (!card || !imageState.draggedId) return;
        event.preventDefault();
        const from = imageState.entries.findIndex(entry => entry.id === imageState.draggedId);
        const to = imageState.entries.findIndex(entry => entry.id === card.dataset.imageId);
        if (from >= 0 && to >= 0 && from !== to) {
            const [moved] = imageState.entries.splice(from, 1);
            imageState.entries.splice(to, 0, moved);
        }
        imageState.draggedId = null;
        renderImageList();
    }

    function clearImageDragStyles() {
        document.querySelectorAll('.v54-image-card').forEach(card => card.classList.remove('dragging', 'drag-over'));
    }

    async function convertImageForPdf(entry, pdfDoc) {
        const bytes = await entry.file.arrayBuffer();
        if (entry.file.type === 'image/jpeg') return pdfDoc.embedJpg(bytes);
        if (entry.file.type === 'image/png') return pdfDoc.embedPng(bytes);
        const bitmap = await createImageBitmap(entry.file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const jpegBlob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể chuyển WebP')), 'image/jpeg', .96));
        return pdfDoc.embedJpg(await jpegBlob.arrayBuffer());
    }

    async function appendImagePage(pdfDoc, entry, pageMode) {
        const embedded = await convertImageForPdf(entry, pdfDoc);
        let pageWidth = Math.max(1, entry.width * .75);
        let pageHeight = Math.max(1, entry.height * .75);
        let drawWidth = pageWidth;
        let drawHeight = pageHeight;
        let x = 0;
        let y = 0;
        if (pageMode === 'a4') {
            const landscape = entry.width > entry.height;
            pageWidth = (landscape ? 297 : 210) * MM_TO_PT;
            pageHeight = (landscape ? 210 : 297) * MM_TO_PT;
            const margin = 12 * MM_TO_PT;
            const scale = Math.min((pageWidth - margin * 2) / embedded.width, (pageHeight - margin * 2) / embedded.height);
            drawWidth = embedded.width * scale;
            drawHeight = embedded.height * scale;
            x = (pageWidth - drawWidth) / 2;
            y = (pageHeight - drawHeight) / 2;
        }
        pdfDoc.addPage([pageWidth, pageHeight]).drawImage(embedded, { x, y, width: drawWidth, height: drawHeight });
    }

    async function createPdfFromImages(entries) {
        if (!entries.length) throw new Error('Hãy chọn ít nhất một hình ảnh.');
        const pdfDoc = await PDFLib.PDFDocument.create();
        const mode = document.getElementById('v54-image-page-mode').value;
        for (let index = 0; index < entries.length; index++) {
            setToolStatus('v54-image-status', `Đang tạo trang ${index + 1}/${entries.length}…`, 'blue');
            await appendImagePage(pdfDoc, entries[index], mode);
        }
        return pdfDoc.save({ useObjectStreams: true });
    }

    async function exportImagesCombined() {
        const bytes = await createPdfFromImages(imageState.entries);
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `images_${new Date().toISOString().slice(0, 10)}.pdf`);
        setToolStatus('v54-image-status', `Đã tạo PDF gồm ${imageState.entries.length} trang`, 'green');
    }

    async function exportImagesSeparate() {
        if (!imageState.entries.length) throw new Error('Hãy chọn ít nhất một hình ảnh.');
        if (imageState.entries.length === 1) {
            const bytes = await createPdfFromImages(imageState.entries);
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${sanitizeFileName(imageState.entries[0].file.name)}.pdf`);
            return;
        }
        const zip = new JSZip();
        for (let index = 0; index < imageState.entries.length; index++) {
            const entry = imageState.entries[index];
            setToolStatus('v54-image-status', `Đang tạo file ${index + 1}/${imageState.entries.length}…`, 'blue');
            const bytes = await createPdfFromImages([entry]);
            zip.file(`${String(index + 1).padStart(3, '0')}_${sanitizeFileName(entry.file.name)}.pdf`, bytes);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        downloadBlob(blob, `images_to_pdf_${new Date().toISOString().slice(0, 10)}.zip`);
        setToolStatus('v54-image-status', `Đã xuất ${imageState.entries.length} PDF riêng`, 'green');
    }

    async function getEditorSource(item) {
        const selectedVersion = typeof getSelectedVersion === 'function' ? getSelectedVersion(item) : null;
        if (selectedVersion?.blob) {
            return {
                buffer: await selectedVersion.blob.arrayBuffer(),
                label: `Phiên bản tối ưu V${selectedVersion.number} • ${typeof formatBytes === 'function' ? formatBytes(selectedVersion.size) : selectedVersion.size + ' bytes'}`
            };
        }
        const sourceFile = item._v54OriginalFile || item.file;
        return { buffer: await sourceFile.arrayBuffer(), label: 'File PDF gốc' };
    }

    async function openPdfEditor(index) {
        const item = filesQueue[index];
        if (!item) return;
        const modal = document.getElementById('v54-editor-modal');
        modal.classList.remove('v54-hidden');
        setToolStatus('v54-editor-status', 'Đang mở PDF…', 'blue');
        editorState.renderToken++;
        if (editorState.pdfjs) {
            try { editorState.pdfjs.destroy(); } catch (_) {}
        }
        editorState.itemIndex = index;
        editorState.selected.clear();
        editorState.deleted.clear();
        editorState.rotations.clear();
        editorState.currentPage = 1;
        try {
            const source = await getEditorSource(item);
            editorState.sourceBuffer = source.buffer;
            editorState.sourceLabel = source.label;
            const loadingTask = pdfjsLib.getDocument({ data: source.buffer.slice(0) });
            editorState.pdfjs = await loadingTask.promise;
            editorState.pageCount = editorState.pdfjs.numPages;
            document.getElementById('v54-editor-title').innerHTML = `<i class="fa-solid fa-pen-ruler text-violet-400 mr-2"></i>${typeof escapeHtml === 'function' ? escapeHtml(item.name) : item.name}`;
            document.getElementById('v54-editor-source').textContent = `${source.label} • ${editorState.pageCount} trang`;
            document.getElementById('v54-split-ranges').value = editorState.pageCount > 10
                ? `1-10, 11-${Math.min(20, editorState.pageCount)}${editorState.pageCount > 20 ? `, 21-${editorState.pageCount}` : ''}`
                : `1-${editorState.pageCount}`;
            renderEditorGrid();
            await renderEditorPreview();
            setToolStatus('v54-editor-status', `${editorState.pageCount} trang • chưa chỉnh sửa`, 'green');
        } catch (error) {
            console.error(error);
            setToolStatus('v54-editor-status', `Không mở được PDF: ${error.message}`, 'rose');
        }
    }

    function closePdfEditor() {
        editorState.renderToken++;
        document.getElementById('v54-editor-modal')?.classList.add('v54-hidden');
        if (editorState.pdfjs) {
            try { editorState.pdfjs.destroy(); } catch (_) {}
            editorState.pdfjs = null;
        }
    }

    function effectiveRotation(pageNumber, baseRotation = 0) {
        return ((baseRotation + (editorState.rotations.get(pageNumber) || 0)) % 360 + 360) % 360;
    }

    function renderEditorGrid() {
        const grid = document.getElementById('v54-page-grid');
        if (!grid) return;
        grid.innerHTML = Array.from({ length: editorState.pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return `
                <article class="v54-page-card${pageNumber === editorState.currentPage ? ' current' : ''}" data-page-number="${pageNumber}">
                    <div class="v54-page-thumb"><canvas id="v54-thumb-${pageNumber}"></canvas></div>
                    <div class="v54-page-meta">
                        <label class="flex items-center gap-1"><input type="checkbox" data-page-select="${pageNumber}"> Trang ${pageNumber}</label>
                        <span id="v54-rotation-${pageNumber}"></span>
                    </div>
                    <div class="v54-deleted-mark"><i class="fa-solid fa-trash mr-1"></i> Đã xóa</div>
                </article>`;
        }).join('');
        const token = ++editorState.renderToken;
        renderAllThumbnails(token);
        syncEditorCards();
    }

    async function renderAllThumbnails(token) {
        for (let pageNumber = 1; pageNumber <= editorState.pageCount; pageNumber++) {
            if (token !== editorState.renderToken || !editorState.pdfjs) return;
            try { await renderEditorThumbnail(pageNumber); } catch (error) { console.warn('Lỗi thumbnail:', error); }
            if (pageNumber % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    async function renderEditorThumbnail(pageNumber) {
        if (!editorState.pdfjs) return;
        const canvas = document.getElementById(`v54-thumb-${pageNumber}`);
        if (!canvas) return;
        const page = await editorState.pdfjs.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, 126 / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale, rotation: effectiveRotation(pageNumber, page.rotate || 0) });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
    }

    async function renderEditorPreview() {
        if (!editorState.pdfjs) return;
        const requestedPage = editorState.currentPage;
        const token = editorState.renderToken;
        const page = await editorState.pdfjs.getPage(requestedPage);
        if (token !== editorState.renderToken || requestedPage !== editorState.currentPage) return;
        const base = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(1050, Math.max(450, document.querySelector('.v54-preview-wrap')?.clientWidth - 42 || 900));
        const maxHeight = Math.max(400, window.innerHeight * .62);
        const scale = Math.min(2, maxWidth / base.width, maxHeight / base.height);
        const viewport = page.getViewport({ scale, rotation: effectiveRotation(requestedPage, page.rotate || 0) });
        const canvas = document.getElementById('v54-editor-preview');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
    }

    function syncEditorCards() {
        document.querySelectorAll('.v54-page-card').forEach(card => {
            const pageNumber = Number(card.dataset.pageNumber);
            card.classList.toggle('current', pageNumber === editorState.currentPage);
            card.classList.toggle('selected', editorState.selected.has(pageNumber));
            card.classList.toggle('deleted', editorState.deleted.has(pageNumber));
            const checkbox = card.querySelector('[data-page-select]');
            if (checkbox) checkbox.checked = editorState.selected.has(pageNumber);
            const rotation = editorState.rotations.get(pageNumber) || 0;
            const label = card.querySelector(`#v54-rotation-${pageNumber}`);
            if (label) label.textContent = rotation ? `${rotation > 0 ? '+' : ''}${rotation}°` : '';
        });
        const activeCount = editorState.pageCount - editorState.deleted.size;
        const editCount = editorState.rotations.size + editorState.deleted.size;
        setToolStatus('v54-editor-status', `${activeCount}/${editorState.pageCount} trang giữ lại • ${editCount} thay đổi`, editCount ? 'blue' : 'green');
    }

    function handleEditorGridClick(event) {
        if (event.target.matches('input[type="checkbox"]')) return;
        const card = event.target.closest('[data-page-number]');
        if (!card) return;
        editorState.currentPage = Number(card.dataset.pageNumber);
        syncEditorCards();
        renderEditorPreview().catch(console.error);
    }

    function handleEditorGridChange(event) {
        const checkbox = event.target.closest('[data-page-select]');
        if (!checkbox) return;
        const pageNumber = Number(checkbox.dataset.pageSelect);
        checkbox.checked ? editorState.selected.add(pageNumber) : editorState.selected.delete(pageNumber);
        syncEditorCards();
    }

    function editorActionPages() {
        return editorState.selected.size ? [...editorState.selected] : [editorState.currentPage];
    }

    function selectAllEditorPages() {
        for (let page = 1; page <= editorState.pageCount; page++) editorState.selected.add(page);
        syncEditorCards();
    }

    function clearEditorSelection() {
        editorState.selected.clear();
        syncEditorCards();
    }

    function rotateEditorPages(delta) {
        const pages = editorActionPages();
        pages.forEach(pageNumber => {
            const next = ((editorState.rotations.get(pageNumber) || 0) + delta) % 360;
            if (next) editorState.rotations.set(pageNumber, next); else editorState.rotations.delete(pageNumber);
        });
        syncEditorCards();
        pages.forEach(pageNumber => renderEditorThumbnail(pageNumber).catch(console.error));
        if (pages.includes(editorState.currentPage)) renderEditorPreview().catch(console.error);
    }

    function setEditorPagesDeleted(deleted) {
        editorActionPages().forEach(pageNumber => deleted ? editorState.deleted.add(pageNumber) : editorState.deleted.delete(pageNumber));
        syncEditorCards();
    }

    function keptEditorPages() {
        return Array.from({ length: editorState.pageCount }, (_, index) => index + 1)
            .filter(pageNumber => !editorState.deleted.has(pageNumber));
    }

    async function buildEditedPdf(pageNumbers = keptEditorPages()) {
        if (!editorState.sourceBuffer) throw new Error('Chưa mở file PDF.');
        if (!pageNumbers.length) throw new Error('Không thể tạo PDF rỗng. Hãy khôi phục ít nhất một trang.');
        const sourceDoc = await PDFLib.PDFDocument.load(editorState.sourceBuffer.slice(0), { ignoreEncryption: true });
        const outputDoc = await PDFLib.PDFDocument.create();
        const copiedPages = await outputDoc.copyPages(sourceDoc, pageNumbers.map(page => page - 1));
        copiedPages.forEach((page, index) => {
            const sourceNumber = pageNumbers[index];
            const currentRotation = page.getRotation()?.angle || 0;
            page.setRotation(PDFLib.degrees(effectiveRotation(sourceNumber, currentRotation)));
            outputDoc.addPage(page);
        });
        return outputDoc.save({ useObjectStreams: true, addDefaultPage: false });
    }

    async function saveEditedVersion() {
        const item = filesQueue[editorState.itemIndex];
        if (!item) throw new Error('Không tìm thấy file trong danh sách.');
        const bytes = await buildEditedPdf();
        const details = [];
        if (editorState.deleted.size) details.push(`xóa ${editorState.deleted.size} trang`);
        if (editorState.rotations.size) details.push(`xoay ${editorState.rotations.size} trang`);
        const method = `Chỉnh sửa PDF${details.length ? ` (${details.join(', ')})` : ''}`;
        addOptimizedVersion(item, bytes, { ...item.settings, edited: true }, method);
        item.status = 'done';
        item.settingsDirty = false;
        item.progressPct = 100;
        item.progressText = 'Đã lưu phiên bản chỉnh sửa';
        updateQueueUI();
        if (typeof showToast === 'function') showToast(`Đã lưu phiên bản mới của ${item.name}`, 'success');
        setToolStatus('v54-editor-status', 'Đã lưu một phiên bản mới vào danh sách', 'green');
    }

    async function downloadEditedPdf() {
        const item = filesQueue[editorState.itemIndex];
        const bytes = await buildEditedPdf();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${sanitizeFileName(item?.name)}_edited.pdf`);
    }

    function parsePageRanges(text) {
        const groups = [];
        const parts = String(text || '').split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
        if (!parts.length) throw new Error('Hãy nhập cụm trang, ví dụ: 1-10, 11-20.');
        for (const part of parts) {
            const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
            if (!match) throw new Error(`Cụm trang không hợp lệ: “${part}”.`);
            const start = Number(match[1]);
            const end = Number(match[2] || match[1]);
            if (start < 1 || end < start || end > editorState.pageCount) {
                throw new Error(`Cụm ${part} nằm ngoài phạm vi 1-${editorState.pageCount}.`);
            }
            const pages = [];
            for (let page = start; page <= end; page++) if (!editorState.deleted.has(page)) pages.push(page);
            if (pages.length) groups.push({ label: start === end ? `${start}` : `${start}-${end}`, pages });
        }
        if (!groups.length) throw new Error('Tất cả các trang trong cụm đã bị xóa.');
        return groups;
    }

    async function exportEditorGroups(groups, zipName) {
        const item = filesQueue[editorState.itemIndex];
        const baseName = sanitizeFileName(item?.name);
        if (groups.length === 1) {
            const bytes = await buildEditedPdf(groups[0].pages);
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}_pages_${groups[0].label}.pdf`);
            return;
        }
        const zip = new JSZip();
        for (let index = 0; index < groups.length; index++) {
            setToolStatus('v54-editor-status', `Đang tách nhóm ${index + 1}/${groups.length}…`, 'blue');
            const bytes = await buildEditedPdf(groups[index].pages);
            zip.file(`${baseName}_pages_${groups[index].label}.pdf`, bytes);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        downloadBlob(blob, zipName || `${baseName}_split.zip`);
        setToolStatus('v54-editor-status', `Đã tách thành ${groups.length} file PDF`, 'green');
    }

    async function splitEveryPage() {
        const groups = keptEditorPages().map(page => ({ label: String(page), pages: [page] }));
        const item = filesQueue[editorState.itemIndex];
        await exportEditorGroups(groups, `${sanitizeFileName(item?.name)}_tung_trang.zip`);
    }

    async function splitByRanges() {
        const groups = parsePageRanges(document.getElementById('v54-split-ranges').value);
        const item = filesQueue[editorState.itemIndex];
        await exportEditorGroups(groups, `${sanitizeFileName(item?.name)}_theo_cum_trang.zip`);
    }

    function initialize() {
        injectStyles();
        updateVersionUI();
        createModals();
        addToolbarButtons();
        wrapQueueRenderer();
        installAutoCropPipeline();
        enhanceQueueRows();
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (!document.getElementById('v54-editor-modal')?.classList.contains('v54-hidden')) closePdfEditor();
            else if (!document.getElementById('v55-ocr-modal')?.classList.contains('v54-hidden')) closeOcrTool();
            else if (!document.getElementById('v54-image-modal')?.classList.contains('v54-hidden')) closeImageTool();
        });
        console.info(`PDF Optimizer Studio V${TOOL_VERSION}: công cụ ảnh, OCR Turnitin, chỉnh PDF và tự cắt viền đã sẵn sàng.`);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
