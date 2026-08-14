import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve("artifacts/bop-app/public");
const source = fs.readFileSync(path.join(root, "print-kop.js"), "utf8");
const css = fs.readFileSync(path.join(root, "print-kop.css"), "utf8");

function loadTemplate() {
  const window = {
    data: {
      kop: {},
      master: {}
    },
    console: { info() {}, warn() {} }
  };
  const document = {
    readyState: "complete",
    getElementById() { return null; },
    addEventListener() {}
  };
  vm.runInNewContext(source, {
    window,
    document,
    console: window.console,
    URL,
    setTimeout() {}
  });
  return window.PrintKopTemplate;
}

test("global KOP renders both balanced logos and identity hierarchy", () => {
  const template = loadTemplate();
  const html = template.render();

  assert.match(html, /assets\/logo-rt005\.png/);
  assert.match(html, /assets\/logo-pemkot-semarang-transparent\.png/);
  assert.match(html, /width="90" height="90"/);
  assert.match(html, /PEMERINTAH KOTA SEMARANG/);
  assert.match(html, /KECAMATAN CANDISARI/);
  assert.match(html, /KELURAHAN TEGALSARI/);
  assert.match(html, /RW 012 RT 005/);
});

test("print CSS centralizes A4 margins, color adjustment, flex layout, and double rule", () => {
  assert.match(css, /margin:\s*2cm\s+2cm\s+2cm\s+3cm/);
  assert.match(css, /-webkit-print-color-adjust:\s*exact/);
  assert.match(css, /\.print-kop\s*\{/);
  assert.match(css, /display:\s*flex/);
  assert.match(css, /\.print-kop::after\s*\{/);
  assert.match(css, /border-top:\s*2px solid/);
  assert.match(css, /border-bottom:\s*1px solid/);
  assert.match(css, /\.print-area\s*\{/);
});