import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const helperSource = readFileSync(path.join(__dirname, '../public/document-studio/letter-rendering.js'), 'utf8');

test('letter helper defines a stable header structure', () => {
  assert.match(helperSource, /buildLetterHeaderHtml/);
  assert.match(helperSource, /letter-head/);
  assert.match(helperSource, /letter-head__logo/);
  assert.match(helperSource, /letter-head__meta/);
});

test('letter helper defines print-safe layout and page-break rules', () => {
  assert.match(helperSource, /grid-template-columns:\s*92px minmax\(0, 1fr\)/);
  assert.match(helperSource, /page-break-inside:\s*avoid/);
  assert.match(helperSource, /break-inside:\s*avoid/);
});

test('letter helper exposes a full document shell builder', () => {
  assert.match(helperSource, /buildLetterDocumentHtml/);
  assert.match(helperSource, /letter-shell/);
  assert.match(helperSource, /letter-body/);
});
