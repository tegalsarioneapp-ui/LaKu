import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const helperSource = readFileSync(path.join(__dirname, '../public/sync-state.js'), 'utf8');

function loadHelpers() {
  const sandbox = {
    console,
    window: {},
    globalThis: {},
    module: { exports: {} },
    exports: {},
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(helperSource, sandbox, { filename: 'sync-state.js' });
  return sandbox.window.BOP_SYNC_HELPERS || sandbox.module.exports;
}

const helpers = loadHelpers();
const { resolveSyncSnapshot } = helpers;

test('sync helper exposes a conflict resolver that prefers newer server snapshots', () => {
  assert.match(helperSource, /resolveSyncSnapshot/);
  assert.match(helperSource, /serverVersion/);
  assert.match(helperSource, /localUpdatedAt/);
});

test('sync helper prefers remote state when the server version is newer', () => {
  const localState = { value: 'local' };
  const remoteState = { value: 'remote' };

  const result = resolveSyncSnapshot({
    localState,
    remoteState,
    localVersion: 2,
    serverVersion: 3,
    localUpdatedAt: '2026-06-22T09:00:00.000Z',
    serverUpdatedAt: '2026-06-22T10:00:00.000Z',
  });

  assert.deepEqual(result, remoteState);
});

test('sync helper preserves local edits when the client is newer than the server', () => {
  const localState = { value: 'local' };
  const remoteState = { value: 'remote' };

  const result = resolveSyncSnapshot({
    localState,
    remoteState,
    localVersion: 4,
    serverVersion: 3,
    localUpdatedAt: '2026-06-22T11:00:00.000Z',
    serverUpdatedAt: '2026-06-22T10:00:00.000Z',
  });

  assert.deepEqual(result, localState);
});
