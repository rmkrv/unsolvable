const MAX_PROBLEM_FILE_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 12_000;

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

async function extractPdfText(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, { default: PdfWorker }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?worker"),
  ]);
  if (!GlobalWorkerOptions.workerPort) GlobalWorkerOptions.workerPort = new PdfWorker();
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let value = "";
    for (const item of content.items as PdfTextItem[]) {
      if (typeof item.str !== "string") continue;
      value += item.str;
      value += item.hasEOL ? "\n" : " ";
    }
    pages.push(value.trim());
    if (pages.join("\n\n").length >= MAX_EXTRACTED_CHARACTERS) break;
  }
  return pages.join("\n\n");
}

async function extractDocxText(file: File) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function extractProblemFile(file: File) {
  if (file.size > MAX_PROBLEM_FILE_BYTES) throw new Error("Choose a file smaller than 15 MB.");
  const extension = extensionOf(file);
  let text = "";
  if (extension === "txt" || file.type === "text/plain") text = await file.text();
  else if (extension === "pdf" || file.type === "application/pdf") text = await extractPdfText(file);
  else if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") text = await extractDocxText(file);
  else throw new Error("Upload a PDF, DOCX, or TXT problem file.");

  const normalized = normalizeExtractedText(text);
  if (!normalized) throw new Error("No readable problem text was found in that file.");
  return {
    text: normalized,
    title: file.name.replace(/\.[^.]+$/, "").trim().slice(0, 120) || "Imported problem",
  };
}
