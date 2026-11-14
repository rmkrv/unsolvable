const MAX_TASK_FILE_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 120_000;
const MAX_IMAGE_EDGE = 1_600;
const MAX_IMAGE_DATA_URL_LENGTH = 700_000;
const MAX_PDF_IMAGE_PAGES = 12;
const MAX_PDF_PAGE_EDGE = 1_400;

type PdfTextItem = { str?: string; hasEOL?: boolean };

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ \u00a0]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

async function openPdf(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, { default: PdfWorker }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?worker"),
  ]);
  if (!GlobalWorkerOptions.workerPort) GlobalWorkerOptions.workerPort = new PdfWorker();
  return getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function extractDocxText(file: File) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared for Nyx.")), "image/jpeg", quality);
  });
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function drawingCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be prepared for Nyx.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

async function encodeCanvas(source: HTMLCanvasElement, maximumLength: number) {
  let canvas = source;
  for (let resize = 0; resize < 5; resize += 1) {
    for (const quality of [0.82, 0.68, 0.52, 0.38, 0.28]) {
      const dataUrl = await blobDataUrl(await canvasBlob(canvas, quality));
      if (dataUrl.length <= maximumLength) return { dataUrl, width: canvas.width, height: canvas.height };
    }
    const nextLongestEdge = Math.max(320, Math.round(Math.max(canvas.width, canvas.height) * 0.78));
    const scale = nextLongestEdge / Math.max(canvas.width, canvas.height);
    const smaller = drawingCanvas(
      Math.max(1, Math.round(canvas.width * scale)),
      Math.max(1, Math.round(canvas.height * scale)),
    );
    smaller.context.drawImage(canvas, 0, 0, smaller.canvas.width, smaller.canvas.height);
    canvas = smaller.canvas;
  }
  throw new Error("The image could not be made small enough for Nyx.");
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const { canvas, context } = drawingCanvas(width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return encodeCanvas(canvas, MAX_IMAGE_DATA_URL_LENGTH);
  } finally {
    bitmap.close();
  }
}

async function extractPdfTask(file: File) {
  const pdf = await openPdf(file);
  try {
    const pageLimit = Math.min(pdf.numPages, MAX_PDF_IMAGE_PAGES);
    const imageBudget = Math.floor(MAX_IMAGE_DATA_URL_LENGTH / pageLimit);
    const textPages: string[] = [];
    const images: Array<{ dataUrl: string; width: number; height: number; pageNumber: number }> = [];
    let extractedCharacters = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      if (extractedCharacters < MAX_EXTRACTED_CHARACTERS) {
        const content = await page.getTextContent();
        let value = "";
        for (const item of content.items as PdfTextItem[]) {
          if (typeof item.str !== "string") continue;
          value += item.str;
          value += item.hasEOL ? "\n" : " ";
        }
        const pageText = value.trim();
        textPages.push(pageText);
        extractedCharacters += pageText.length + 2;
      }
      if (pageNumber <= pageLimit) {
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, MAX_PDF_PAGE_EDGE / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const { canvas, context } = drawingCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        images.push({ ...(await encodeCanvas(canvas, imageBudget)), pageNumber });
      }
    }

    return {
      text: normalizeExtractedText(textPages.join("\n\n")) || undefined,
      images,
      pageCount: pdf.numPages,
      omittedPageCount: Math.max(0, pdf.numPages - images.length) || undefined,
    };
  } finally {
    await pdf.cleanup();
  }
}

export async function extractTaskFile(file: File) {
  if (file.size > MAX_TASK_FILE_BYTES) throw new Error("Choose a file smaller than 15 MB.");
  const extension = extensionOf(file);
  const sourceName = file.name.trim().slice(0, 180) || "Task description";
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) {
    return {
      sourceName,
      mediaType: "image/jpeg",
      images: [await prepareImage(file)],
    };
  }
  if (extension === "pdf" || file.type === "application/pdf") {
    return {
      sourceName,
      mediaType: "application/pdf",
      ...(await extractPdfTask(file)),
    };
  }

  let text = "";
  if (extension === "txt" || file.type === "text/plain") text = await file.text();
  else if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = await extractDocxText(file);
  else throw new Error("Give Nyx a PDF, DOCX, TXT, or image file.");

  const normalized = normalizeExtractedText(text);
  if (!normalized) throw new Error("No readable task text was found in that file.");
  return {
    text: normalized,
    sourceName,
    mediaType: file.type || (extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain"),
  };
}
