const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

app.disableHardwareAcceleration();
const deadline = setTimeout(() => { console.error('Plugin UI timed out'); app.exit(1); }, 25000);
app.whenReady().then(async () => {
  console.log('Plugin UI: Electron ready');
  const win = new BrowserWindow({ width: 960, height: 640, show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (_event, ...args) => console.log('Renderer:', ...args));
  const capture = async filename => {
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    fs.writeFileSync(filename, (await win.webContents.capturePage()).toPNG());
  };
  try {
    await win.loadFile(path.join(__dirname, 'ui-fixture.html'));
    console.log('Plugin UI: fixture loaded');
    const transfer = await win.webContents.executeJavaScript('runTransferTest()', true);
    assert.equal(transfer.buttonCount, 4, 'Both document headers contain previous and next buttons');
    assert.equal(transfer.duplicateCount, 4, 'Layout refresh does not duplicate actions');
    assert.equal(transfer.selectionProtected, true, 'Clicking a header preserves the selection');
    assert.deepEqual(transfer.horizontalIcons, ['lugtab-send-right', 'lugtab-send-left']);
    assert.deepEqual(transfer.verticalIcons, ['lugtab-send-down', 'lugtab-send-up']);
    assert.deepEqual(transfer.moved, ['hello ', 'targetworld!']);
    assert.deepEqual(transfer.returned, ['hello world', 'target!']);
    assert.deepEqual(transfer.emptyTarget, ['새 메모.md', 'world', 'hello '], 'An empty destination gets a new note without removing the source file');
    assert.deepEqual(transfer.splits, [['vertical', false], ['vertical', true]], 'Missing next/previous panels are created to the right/left');
    assert.deepEqual(transfer.autoTargets, [['새 메모 2.md', 'world', 'hello ', true], ['새 메모 3.md', 'world', 'hello ', true]]);
    assert.equal(transfer.cancelCreatedNothing, true, 'Cancelling whole-document transfer creates neither a panel nor a note');
    assert.equal(transfer.splitFailurePreservedSource, true, 'Split failure leaves source content untouched');
    assert.deepEqual(transfer.tabSplit, ['horizontal', false], 'Double-click creates a missing destination below');
    assert.deepEqual(transfer.relocatedTab, ['원본 문서.md', 'hello world', 1, false], 'Double-click moves the document and closes the original tab');
    assert.equal(transfer.deferredTabLoaded, true, 'Destination finishes deferred loading before the original tab closes');
    assert.equal(transfer.focusPreserved, true, 'Panel focus switching preserves the selection');
    assert.deepEqual(transfer.hotkey, { modifiers: ['Ctrl'], key: '\\' });
    assert.deepEqual(transfer.tabMoves, [['원본 문서.md', 'next', true], ['원본 문서.md', 'previous', false]], 'Double-click and Shift-double-click choose the correct direction');
    const transferScreenshot = path.join(os.tmpdir(), 'lugtab-transfer-buttons.png');
    await capture(transferScreenshot);
    assert.equal(await win.webContents.executeJavaScript('transferPlugin.cleanups.forEach(fn => fn()); document.querySelectorAll(".lugtab-action").length'), 0);
    console.log('Transfer UI passed: header buttons, horizontal/vertical icons, move and return, unload cleanup. Screenshot: ' + transferScreenshot);
    clearTimeout(deadline); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(deadline); if (!win.isDestroyed()) win.destroy(); app.exit(1); }
});
