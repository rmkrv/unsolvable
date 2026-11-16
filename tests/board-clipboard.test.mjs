import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

function moduleUrl(relativePath, replacements = new Map()) {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  let output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of replacements) {
    output = output.replaceAll(`"${specifier}"`, `"${replacement}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

async function boardModules() {
  const modelUrl = moduleUrl("lib/domain/board/model.ts");
  return {
    model: await import(modelUrl),
    operations: await import(moduleUrl("lib/domain/board/operations.ts", new Map([["./model", modelUrl]]))),
  };
}

function rectangle() {
  return [
    { x: 10, y: 20, pressure: 1, t: 0 },
    { x: 110, y: 20, pressure: 1, t: 0 },
    { x: 110, y: 70, pressure: 1, t: 0 },
    { x: 10, y: 70, pressure: 1, t: 0 },
    { x: 10, y: 20, pressure: 1, t: 0 },
  ];
}

function baseStroke(kind) {
  return {
    id: `${kind}-1`,
    points: rectangle(),
    color: "#172036",
    width: 1,
    opacity: 1,
    kind,
    author: "student",
    createdAt: 1,
  };
}

test("clipboard parser accepts persisted image and text board objects", async () => {
  const { operations } = await boardModules();
  const image = { ...baseStroke("image"), image: { dataUrl: "data:image/webp;base64,AA==", width: 100, height: 50 } };
  const text = { ...baseStroke("text"), text: { value: "hello", lines: ["hello"], fontSize: 22, lineHeight: 30 } };
  const parsed = operations.parseClipboardStrokes(JSON.stringify({ version: 1, strokes: [image, text] }));
  assert.deepEqual(parsed, [image, text]);
});

test("clipboard parser rejects incomplete rich board objects", async () => {
  const { operations } = await boardModules();
  const missingImage = baseStroke("image");
  const malformedText = { ...baseStroke("text"), text: { value: "hello", lines: [4], fontSize: 22, lineHeight: 30 } };
  assert.deepEqual(
    operations.parseClipboardStrokes(JSON.stringify({ strokes: [missingImage, malformedText] })),
    [],
  );
});

test("copied board text also exposes a plain-text clipboard value", async () => {
  const { operations } = await boardModules();
  const first = { ...baseStroke("text"), text: { value: "First note", lines: ["First note"], fontSize: 22, lineHeight: 30 } };
  const second = { ...baseStroke("text"), id: "text-2", text: { value: "Second note", lines: ["Second note"], fontSize: 22, lineHeight: 30 } };
  const image = { ...baseStroke("image"), image: { dataUrl: "data:image/webp;base64,AA==", width: 100, height: 50 } };
  assert.equal(operations.clipboardPlainText([first, image, second]), "First note\n\nSecond note");
});

test("image and text objects can be selected from their interior", async () => {
  const { model } = await boardModules();
  for (const kind of ["image", "text"]) {
    assert.equal(model.distanceToStroke(60, 45, baseStroke(kind), 5), 0);
    assert.equal(model.distanceToStroke(200, 200, baseStroke(kind), 5), Number.POSITIVE_INFINITY);
  }
});
