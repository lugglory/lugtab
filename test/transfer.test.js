const { test } = require('node:test');
const assert = require('node:assert/strict');
const { adjacentPane, transferText, moveText, moveDocumentTab } = require('../src/transfer');

const pane = (name, left, top, width = 400, height = 300) => ({ leaf: name, rect: { left, top, right: left + width, bottom: top + height } });
test('cycles through horizontal and vertical panes in both directions', () => {
  const a = pane('a', 0, 0), b = pane('b', 410, 0), c = pane('c', 0, 310);
  assert.equal(adjacentPane(a, [a, b], 'next'), b);
  assert.equal(adjacentPane(b, [a, b], 'previous'), a);
  assert.equal(adjacentPane(a, [a, c], 'next'), c);
  assert.equal(adjacentPane(c, [a, c], 'previous'), a);
  assert.equal(adjacentPane(b, [a, b], 'next'), a);
  assert.equal(adjacentPane(a, [a, b], 'previous'), b);
  assert.equal(adjacentPane(a, [a, b, c], 'next'), b);
  assert.equal(adjacentPane(a, [a], 'next'), null);
});
test('nested splits follow reading order and visit every panel before wrapping', () => {
  const source = pane('source', 0, 0, 400, 620), top = pane('top', 410, 0, 400, 200), bottom = pane('bottom', 410, 210, 400, 410);
  assert.equal(adjacentPane(source, [source, top, bottom], 'next'), top);
  assert.equal(adjacentPane(top, [source, top, bottom], 'next'), bottom);
  assert.equal(adjacentPane(bottom, [source, top, bottom], 'next'), source);
  assert.equal(adjacentPane(source, [source, top, bottom], 'previous'), bottom);
});
test('whole document adds its title once and respects line boundaries', () => {
  assert.equal(transferText('body', 'Note', 0, 0, 'abcDEF', 3).merged, 'abc\n# Note\n\nbody\nDEF');
  assert.equal(transferText('# Note\n\nbody', 'Note', 0, 0, '', 0).text, '# Note\n\nbody\n');
  assert.equal(transferText('hello world', 'Note', 6, 11, 'ab', 1).merged, 'aworldb');
});

function setup({ whole = false, confirm = async () => true } = {}) {
  const disk = new Map(), events = [];
  function view(name, content, from, to) {
    const file = { path: name + '.md', basename: name };
    disk.set(file.path, content);
    const editor = { content, from, to,
      getValue() { return this.content; },
      listSelections() { return [{}]; },
      getCursor(which) { return which === 'to' ? this.to : this.from; },
      posToOffset(pos) { return pos; }, offsetToPos(offset) { return offset; },
      replaceRange(text, start, end = start) { this.content = this.content.slice(0, start) + text + this.content.slice(end); },
      setCursor(pos) { this.from = this.to = pos; },
    };
    return { file, editor, async save() { events.push('save:' + name); disk.set(file.path, editor.content); } };
  }
  const source = view('source', 'hello world', whole ? 0 : 6, whole ? 0 : 11);
  const target = view('target', 'target!', 6, 6);
  const vault = { async read(file) { return disk.get(file.path); } };
  return { source, target, vault, confirm, disk, events, async trash(file) { events.push('trash'); disk.delete(file.path); } };
}
test('selection is inserted at inactive cursor, saved, then removed from source', async () => {
  const context = setup();
  await moveText(context);
  assert.equal(context.disk.get('target.md'), 'targetworld!');
  assert.equal(context.disk.get('source.md'), 'hello ');
  assert.deepEqual(context.events, ['save:source', 'save:target', 'save:target', 'save:source']);
});
test('whole document is trashed only after target save and readback', async () => {
  const context = setup({ whole: true });
  await moveText(context);
  assert.equal(context.disk.has('source.md'), false);
  assert.equal(context.disk.get('target.md'), 'target\n# source\n\nhello world\n!');
  assert.equal(context.events.at(-1), 'trash');
});
test('cancelling whole-document confirmation makes no edits', async () => {
  const context = setup({ whole: true, confirm: async () => false });
  assert.equal(await moveText(context), false);
  assert.deepEqual(context.events, []);
  assert.equal(context.target.editor.getValue(), 'target!');
});
test('failed destination save never removes source', async () => {
  const context = setup({ whole: true });
  const save = context.target.save;
  let count = 0;
  context.target.save = async () => { if (++count === 2) throw new Error('disk full'); await save(); };
  await assert.rejects(moveText(context), /disk full/);
  assert.equal(context.disk.get('source.md'), 'hello world');
  assert.equal(context.source.editor.getValue(), 'hello world');
  assert.equal(context.events.includes('trash'), false);
});
test('source edits during destination save preserve the edited original', async () => {
  const context = setup({ whole: true });
  const save = context.target.save;
  let count = 0;
  context.target.save = async () => { await save(); if (++count === 2) context.source.editor.content += ' new'; };
  await assert.rejects(moveText(context), /원본을 보존/);
  assert.equal(context.source.editor.content, 'hello world new');
  assert.equal(context.events.includes('trash'), false);
});
test('target changes and disk readback mismatch prevent source removal', async () => {
  for (const edit of ['editor', 'disk']) {
    const context = setup();
    const save = context.target.save;
    let count = 0;
    context.target.save = async () => { await save(); if (++count === 2) {
      if (edit === 'editor') context.target.editor.content += 'new';
      else context.disk.set('target.md', 'external');
    } };
    await assert.rejects(moveText(context), /원본을 보존/);
    assert.equal(context.source.editor.content, 'hello world');
  }
});
test('same document and multiple selections are rejected before saving', async () => {
  const context = setup();
  context.target.file.path = context.source.file.path;
  await assert.rejects(moveText(context), /서로 다른/);
  context.target.file.path = 'target.md';
  context.source.editor.listSelections = () => [{}, {}];
  await assert.rejects(moveText(context), /여러 선택/);
  assert.deepEqual(context.events, []);
});
test('tab movement preserves selection/scroll and closes the original even when it is the final tab', async () => {
  const context = setup(); const events = [], left = {}, right = {};
  const selections = [{ anchor: 6, head: 11 }];
  context.source.editor.listSelections = () => selections;
  context.source.editor.getScrollInfo = () => ({ left: 4, top: 80 });
  context.source.leaf = { parent: left, getViewState: () => ({ type: 'markdown', state: { file: 'source.md' } }), getEphemeralState: () => ({}),
    async setViewState(state) { events.push(state.type); }, detach() { events.push('detach'); } };
  const destination = { parent: right, view: { file: context.source.file, editor: {
    getValue: () => 'hello world', setSelections: value => events.push(value), scrollTo: (x, y) => events.push([x, y]), focus() {},
  } }, async setViewState(state) { events.push(state.state.file); } };
  const workspace = { setActiveLeaf() {}, async revealLeaf() {}, getLeaf: () => destination, iterateRootLeaves: callback => callback(context.source.leaf), requestSaveLayout() {} };
  await moveDocumentTab({ source: context.source, target: { parent: right }, workspace, vault: context.vault });
  assert.deepEqual(events, ['source.md', selections, [4, 80], 'detach']);
  assert.equal(context.disk.get('source.md'), 'hello world');
});
test('tab movement stops before opening a new tab if saving fails', async () => {
  const context = setup();
  context.source.editor.getScrollInfo = () => ({ left: 0, top: 0 });
  context.source.leaf = { parent: {}, getViewState: () => ({}), getEphemeralState: () => ({}) };
  context.source.save = async () => { throw new Error('disk full'); };
  const workspace = { getLeaf() { assert.fail('must not create a tab'); } };
  await assert.rejects(moveDocumentTab({ source: context.source, target: { parent: {} }, workspace, vault: context.vault }), /disk full/);
  await assert.rejects(moveDocumentTab({ source: context.source, createTarget() { assert.fail('must not split before saving'); }, workspace, vault: context.vault }), /disk full/);
});

test('tab movement creates a missing panel and reuses its empty leaf', async () => {
  const context = setup(), events = [];
  context.source.editor.getScrollInfo = () => ({ left: 0, top: 40 });
  context.source.leaf = { parent: {}, getViewState: () => ({ type: 'markdown', state: { file: 'source.md' } }),
    getEphemeralState: () => ({}), detach() { events.push('detach'); } };
  const destination = { parent: {}, view: { getViewType: () => 'empty' }, async setViewState(state) {
    events.push(state.state.file);
    this.view = { file: context.source.file, editor: { getValue: () => 'hello world', setSelections() {}, scrollTo() {}, focus() {} } };
  } };
  const workspace = { setActiveLeaf() {}, async revealLeaf() {}, getLeaf() { assert.fail('must reuse the empty split'); },
    iterateRootLeaves: callback => callback(context.source.leaf), requestSaveLayout() {} };
  const result = await moveDocumentTab({ source: context.source, workspace, vault: context.vault, createTarget() {
    assert.deepEqual(context.events, ['save:source']); events.push('split'); return destination;
  } });
  assert.equal(result, destination);
  assert.deepEqual(events, ['split', 'source.md', 'detach']);
  assert.equal(context.disk.get('source.md'), 'hello world');
});

test('tab movement keeps the original open when the destination content cannot be verified', async () => {
  const context = setup();
  context.source.editor.getScrollInfo = () => ({ left: 0, top: 0 });
  context.source.leaf = { parent: {}, getViewState: () => ({}), getEphemeralState: () => ({}),
    detach() { assert.fail('must preserve original'); } };
  const target = { parent: {}, view: { getViewType: () => 'empty' }, async setViewState() {
    this.view = { file: context.source.file, editor: { getValue: () => 'wrong content' } };
  } };
  let active;
  await assert.rejects(moveDocumentTab({ source: context.source, target, vault: context.vault,
    workspace: { setActiveLeaf(leaf) { active = leaf; }, async revealLeaf() {} } }), /원본 탭을 보존/);
  assert.equal(active, context.source.leaf);
});

test('tab movement waits for the revealed deferred document before checking and closing the source', async () => {
  const context = setup(), events = [];
  context.source.editor.getScrollInfo = () => ({ left: 0, top: 40 });
  context.source.leaf = { parent: {}, getViewState: () => ({ type: 'markdown', state: { file: 'source.md' } }),
    getEphemeralState: () => ({}), detach() { events.push('close source'); } };
  const target = { parent: {}, view: { getViewType: () => 'empty' }, async setViewState() {
    events.push('request document'); this.view = { getViewType: () => 'deferred' };
  } };
  let releaseLoad, started;
  const load = new Promise(resolve => { releaseLoad = resolve; });
  const revealing = new Promise(resolve => { started = resolve; });
  const workspace = { setActiveLeaf() {}, requestSaveLayout() {}, async revealLeaf(leaf) {
    assert.equal(leaf, target); events.push('reveal'); started(); await load;
    leaf.view = { file: context.source.file, editor: { getValue: () => 'hello world',
      setSelections() { events.push('restore selection'); }, scrollTo() {}, focus() {} } };
    events.push('document loaded');
  } };
  const movement = moveDocumentTab({ source: context.source, target, vault: context.vault, workspace });
  await revealing;
  assert.deepEqual(events, ['request document', 'reveal']);
  assert.equal(context.source.editor.getValue(), 'hello world');
  releaseLoad();
  assert.equal(await movement, target);
  assert.deepEqual(events, ['request document', 'reveal', 'document loaded', 'restore selection', 'close source']);
});

test('loading failure or a source edit during reveal preserves the original tab', async () => {
  for (const failure of ['load', 'edit']) {
    const context = setup(); let active;
    context.source.editor.getScrollInfo = () => ({ left: 0, top: 0 });
    context.source.leaf = { parent: {}, getViewState: () => ({}), getEphemeralState: () => ({}),
      detach() { assert.fail('must preserve original'); } };
    const target = { parent: {}, view: { getViewType: () => 'empty' }, async setViewState() {} };
    const workspace = { setActiveLeaf(leaf) { active = leaf; }, async revealLeaf() {
      await Promise.resolve();
      if (failure === 'load') throw new Error('document load failed');
      context.source.editor.content += ' new';
    } };
    await assert.rejects(moveDocumentTab({ source: context.source, target, vault: context.vault, workspace }),
      failure === 'load' ? /document load failed/ : /원본 탭을 보존/);
    assert.equal(active, context.source.leaf);
    assert.equal(context.source.editor.getValue(), failure === 'load' ? 'hello world' : 'hello world new');
  }
});
