import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const sourcePath = fileURLToPath(new URL("../vendor/hershey/p5.hershey.data.js", import.meta.url));
const outputPath = fileURLToPath(new URL("../lib/handwriting-font-data.mjs", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const font = runInNewContext(`${source}\nFONT_HERSHEY`);
const glyphs = {};

for (let code = 32; code <= 126; code += 1) {
  const entry = font.DATA[font.SCRIPT_SIMPLEX(code)];
  if (!entry) continue;
  const left = entry.charCodeAt(3) - 82;
  const right = entry.charCodeAt(4) - 82;
  const paths = [];
  let path = [];
  for (let index = 5; index < entry.length; index += 2) {
    const pair = entry.slice(index, index + 2);
    if (pair === " R") {
      if (path.length > 1) paths.push(path);
      path = [];
    } else if (pair.length === 2) {
      path.push([pair.charCodeAt(0) - 82 - left, pair.charCodeAt(1) - 82]);
    }
  }
  if (path.length > 1) paths.push(path);
  glyphs[String.fromCharCode(code)] = { advance: right - left, paths };
}

writeFileSync(outputPath, `// Derived from p5-hershey-js SCRIPT_SIMPLEX. See vendor/hershey/LICENSE.\nexport default ${JSON.stringify(glyphs)};\n`);
console.log(`Wrote ${Object.keys(glyphs).length} handwriting glyphs to ${outputPath}`);
