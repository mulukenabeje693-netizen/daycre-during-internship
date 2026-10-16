const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('seedRequestedUsers is exportable without auto-running on import', async () => {
  const filePath = path.join(__dirname, '..', 'config', 'seedRequestedUsers.js');
  const mod = await import(pathToFileURL(filePath).href);

  assert.equal(typeof mod.seedRequestedUsers, 'function');
  assert.equal(Array.isArray(mod.requestedUsers), true);
  assert.equal(mod.requestedUsers.length, 4);
});
