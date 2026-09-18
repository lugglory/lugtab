'use strict';
const { Plugin, MarkdownView, Notice, setIcon } = require('obsidian');
const { adjacentPane, moveText, moveDocumentTab } = require('./transfer');
const { confirmAction } = require('./confirmation');
const { registerTransferIcons } = require('./icons');

module.exports = class PaneTransferPlugin extends Plugin {
  onload() {
    registerTransferIcons();
    this.busy = false;
    this.actions = new Map();
    this.unloaded = false;
    this.addCommand({ id: 'focus-other-pane', name: '다른 문서 패널로 포커스 전환', hotkeys: [{ modifiers: ['Ctrl'], key: '\\' }],
      editorCallback: (_editor, view) => this.focusOtherPane(view) });
    for (const [direction, label] of [['next', '다음'], ['previous', '이전']]) {
      this.addCommand({ id: `move-tab-to-${direction}-pane`, name: `${label} 문서 패널로 현재 탭 옮기기`,
        editorCallback: (_editor, view) => this.moveTab(view, direction) });
    }
    this.registerDomEvent(document, 'dblclick', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('.modal-container')) return;
      const element = event.target;
      if (!element?.closest || element.closest('button, .view-action, .workspace-tab-header-inner-close-button')) return;
      const header = element.closest('.workspace-tab-header, .view-header-title');
      if (!header) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || header.closest('.workspace-tabs') !== view.containerEl.closest('.workspace-tabs')) return;
      if (header.matches('.workspace-tab-header') && !header.classList.contains('is-active')) return;
      event.preventDefault(); event.stopPropagation();
      this.moveTab(view, event.shiftKey ? 'previous' : 'next', !event.shiftKey);
    }, true);
    for (const [direction, name] of [['next', '다음 문서 패널로 텍스트 보내기 (오른쪽·아래)'], ['previous', '이전 문서 패널로 텍스트 보내기 (왼쪽·위)']]) {
      this.addCommand({ id: `send-to-${direction}-pane`, name,
        editorCallback: (_editor, view) => this.send(view, direction) });
    }
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, _editor, view) => {
      menu.addItem(item => item.setTitle('다음 문서 패널로 보내기').setIcon('lugtab-send-right').onClick(() => this.send(view, 'next')));
      menu.addItem(item => item.setTitle('이전 문서 패널로 보내기').setIcon('lugtab-send-left').onClick(() => this.send(view, 'previous')));
    }));
    for (const event of ['layout-change', 'file-open', 'active-leaf-change', 'resize']) {
      this.registerEvent(this.app.workspace.on(event, () => this.scheduleActions()));
    }
    this.app.workspace.onLayoutReady(() => this.syncActions());
    this.register(() => {
      this.unloaded = true;
      window.clearTimeout(this.actionsTimer);
      for (const buttons of this.actions.values()) for (const button of Object.values(buttons)) button.remove();
      this.actions.clear();
    });
  }
  scheduleActions() {
    window.clearTimeout(this.actionsTimer);
    this.actionsTimer = window.setTimeout(() => this.syncActions(), 50);
  }
  visiblePanes(view) {
    const candidates = [];
    this.app.workspace.iterateRootLeaves(leaf => {
      const el = leaf.view.containerEl;
      if (el.ownerDocument !== view.containerEl.ownerDocument || !el.isShown()) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) candidates.push({ leaf, rect });
    });
    return candidates;
  }
  adjacentLeaf(view, direction, fallback = false) {
    const candidates = this.visiblePanes(view);
    const source = candidates.find(item => item.leaf === view.leaf);
    if (!source) return null;
    return (adjacentPane(source, candidates, direction) || (fallback && adjacentPane(source, candidates, direction === 'next' ? 'previous' : 'next')))?.leaf || null;
  }
  focusOtherPane(view) {
    if (this.busy || !(view instanceof MarkdownView) || view.containerEl.ownerDocument.querySelector('.modal-container')) return;
    const target = this.adjacentLeaf(view, 'next', true);
    if (!target) return;
    this.app.workspace.setActiveLeaf(target, { focus: true });
    if (target.view instanceof MarkdownView && target.view.getMode() === 'source') target.view.editor.focus();
  }
  createTargetPane(view, direction, axis = 'vertical') {
    if (!this.visiblePanes(view).some(item => item.leaf === view.leaf)) throw new Error('주 작업 영역의 문서 패널에서 실행해 주세요.');
    return this.app.workspace.createLeafBySplit(view.leaf, axis, direction === 'previous');
  }
  async moveTab(view, direction, fallback = false) {
    if (this.busy || !(view instanceof MarkdownView)) return;
    this.busy = true;
    try {
      const target = this.adjacentLeaf(view, direction, fallback);
      await moveDocumentTab({ source: view, target, createTarget: () => this.createTargetPane(view, 'next', 'horizontal'),
        workspace: this.app.workspace, vault: this.app.vault });
    } catch (error) { new Notice(error.message, 6000); }
    finally { this.busy = false; this.syncActions(); }
  }
  syncActions() {
    if (this.unloaded) return;
    const views = new Set();
    this.app.workspace.iterateRootLeaves(leaf => { if (leaf.view instanceof MarkdownView) views.add(leaf.view); });
    for (const [view, buttons] of this.actions) {
      if (!views.has(view) || Object.values(buttons).some(button => !button.isConnected)) {
        for (const button of Object.values(buttons)) button.remove();
        this.actions.delete(view);
      }
    }
    for (const view of views) {
      let buttons = this.actions.get(view);
      if (!buttons) {
        buttons = {};
        for (const direction of ['previous', 'next']) {
          const label = direction === 'next' ? '다음 문서 패널로 텍스트 보내기 (오른쪽·아래)' : '이전 문서 패널로 텍스트 보내기 (왼쪽·위)';
          const button = view.addAction(direction === 'next' ? 'lugtab-send-right' : 'lugtab-send-left', label, () => this.send(view, direction));
          button.addClass('lugtab-action');
          button.dataset.direction = direction;
          button.setAttribute('aria-label', label);
          button.setAttribute('role', 'button');
          button.setAttribute('tabindex', '0');
          button.title = label;
          // Keep the editor selection intact when clicking its header action.
          button.addEventListener('mousedown', event => event.preventDefault());
          if (button.tagName !== 'BUTTON') button.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault(); event.stopPropagation(); this.send(view, direction);
          });
          buttons[direction] = button;
        }
        this.actions.set(view, buttons);
      }
      const candidates = this.visiblePanes(view);
      const source = candidates.find(item => item.leaf === view.leaf);
      for (const [direction, button] of Object.entries(buttons)) {
        const target = source && adjacentPane(source, candidates, direction);
        const neighbor = target || (source && adjacentPane(source, candidates, direction === 'next' ? 'previous' : 'next'));
        const horizontal = !neighbor || Math.min(source.rect.bottom, neighbor.rect.bottom) - Math.max(source.rect.top, neighbor.rect.top) > 1;
        const arrow = direction === 'next' ? (horizontal ? 'right' : 'down') : (horizontal ? 'left' : 'up');
        setIcon(button, `lugtab-send-${arrow}`);
        button.setAttribute('aria-disabled', String(this.busy));
        button.style.opacity = this.busy ? '0.4' : '';
      }
    }
  }
  async send(view, direction) {
    if (this.busy) return;
    this.busy = true;
    this.syncActions();
    try {
      if (!(view instanceof MarkdownView) || view.getMode() !== 'source') throw new Error('편집 모드의 Markdown 문서에서 실행해 주세요.');
      const candidates = this.visiblePanes(view);
      const source = candidates.find(item => item.leaf === view.leaf);
      if (!source) throw new Error('주 작업 영역의 문서 패널에서 실행해 주세요.');
      let target = adjacentPane(source, candidates, direction)?.leaf;
      let confirmed = false;
      if (!target || target.view.getViewType() === 'empty') {
        const file = view.file, content = view.editor.getValue();
        if (!file) throw new Error('저장된 Markdown 문서에서 실행해 주세요.');
        if (view.editor.listSelections().length !== 1) throw new Error('여러 선택 영역은 지원하지 않습니다. 한 영역을 선택해 주세요.');
        const from = view.editor.posToOffset(view.editor.getCursor('from')), to = view.editor.posToOffset(view.editor.getCursor('to'));
        const unchanged = () => view.file === file && view.editor.getValue() === content &&
          view.editor.posToOffset(view.editor.getCursor('from')) === from && view.editor.posToOffset(view.editor.getCursor('to')) === to;
        const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : '';
        let path = folder + '새 메모.md', index = 2;
        while (this.app.vault.getAbstractFileByPath(path)) path = folder + `새 메모 ${index++}.md`;
        if (from === to) {
          confirmed = await confirmAction(this.app, { title: '문서 전체 보내기', message: `${file.path} 전체를 새 문서 ${path}에 합치고 원본은 휴지통으로 보낼까요?`, confirmLabel: '합치고 휴지통으로 보내기' });
          if (!confirmed) return;
        }
        if (!unchanged() || (target && target.view.getViewType() !== 'empty')) throw new Error('문서 또는 대상 패널이 변경되어 취소했습니다.');
        // Only split after whole-document confirmation, so cancellation creates nothing.
        if (!target) {
          if (this.adjacentLeaf(view, direction)) throw new Error('패널 배치가 변경되어 취소했습니다. 다시 실행해 주세요.');
          target = this.createTargetPane(view, direction);
        }
        if (!target || target.view.getViewType() !== 'empty') throw new Error('빈 대상 패널을 만들지 못했습니다.');
        const created = await this.app.vault.create(path, '');
        if (!unchanged() || target.view.getViewType() !== 'empty') throw new Error('대상 패널이 변경되어 이동을 취소했습니다. 새 메모는 그대로 두었습니다.');
        await target.setViewState({ type: 'markdown', state: { file: created.path, mode: 'source' }, active: false });
        if (!unchanged()) throw new Error('대상 문서를 여는 동안 원본이 변경되어 이동을 취소했습니다.');
      }
      if (!(target.view instanceof MarkdownView) || target.view.getMode() !== 'source' || !target.view.file) {
        throw new Error('대상 패널에 Markdown 문서를 편집 모드로 열어 주세요.');
      }
      if (await moveText({ source: view, target: target.view, vault: this.app.vault,
        trash: file => this.app.vault.trash(file, true),
        confirm: (a, b) => confirmed || confirmAction(this.app, { title: '문서 전체 보내기',
          message: `${a.path} 전체를 ${b.path}에 합치고 원본은 휴지통으로 보낼까요?`,
          confirmLabel: '합치고 휴지통으로 보내기' }) })) {
        this.app.workspace.setActiveLeaf(target, { focus: true });
        target.view.editor.focus();
        new Notice('텍스트를 옮겼습니다.', 1500);
      }
    } catch (error) { new Notice(error.message, 6000); }
    finally { this.busy = false; this.syncActions(); }
  }
};
