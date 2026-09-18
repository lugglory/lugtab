"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/transfer.js
var require_transfer = __commonJS({
  "src/transfer.js"(exports2, module2) {
    "use strict";
    function adjacentPane2(source, candidates, direction) {
      const ordered = [...candidates].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
      const index = ordered.findIndex((item) => item.leaf === source.leaf);
      if (index < 0 || ordered.length < 2) return null;
      return ordered[(index + (direction === "next" ? 1 : ordered.length - 1)) % ordered.length];
    }
    function transferText(content, title, from, to, destination, offset) {
      const whole = from === to;
      let text = content.slice(from, to);
      if (whole) {
        const body = content.trim();
        const heading = /^#\s+(.+)$/.exec(body.split("\n")[0]);
        text = (heading?.[1].trim() === title ? body : "# " + title + "\n\n" + body) + "\n";
      }
      if (whole || text.includes("\n")) {
        if (offset > 0 && destination[offset - 1] !== "\n") text = "\n" + text;
        if (offset < destination.length && !text.endsWith("\n")) text += "\n";
      }
      return { whole, text, merged: destination.slice(0, offset) + text + destination.slice(offset) };
    }
    async function moveText2({ source, target, vault, trash, confirm }) {
      const sourceFile = source.file, targetFile = target.file;
      if (!sourceFile || !targetFile || sourceFile.path === targetFile.path) throw new Error("\uC11C\uB85C \uB2E4\uB978 \uB450 \uBB38\uC11C\uB97C \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      const sourcePath = sourceFile.path, targetPath = targetFile.path;
      const content = source.editor.getValue(), destination = target.editor.getValue();
      const selections = source.editor.listSelections();
      if (selections.length !== 1) throw new Error("\uC5EC\uB7EC \uC120\uD0DD \uC601\uC5ED\uC740 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD55C \uC601\uC5ED\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      const from = source.editor.posToOffset(source.editor.getCursor("from"));
      const to = source.editor.posToOffset(source.editor.getCursor("to"));
      const offset = target.editor.posToOffset(target.editor.getCursor("from"));
      const plan = transferText(content, sourceFile.basename, from, to, destination, offset);
      const sameSource = () => source.file === sourceFile && sourceFile.path === sourcePath && source.editor.getValue() === content;
      const sameTarget = (text) => target.file === targetFile && targetFile.path === targetPath && target.editor.getValue() === text;
      if (plan.whole && !await confirm(sourceFile, targetFile)) return false;
      if (!sameSource() || !sameTarget(destination)) throw new Error("\uBB38\uC11C\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
      await source.save();
      await target.save();
      if (!sameSource() || !sameTarget(destination)) throw new Error("\uC800\uC7A5 \uC911 \uBB38\uC11C\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
      const sourceDisk = await vault.read(sourceFile);
      const targetDisk = await vault.read(targetFile);
      if (sourceDisk !== content || targetDisk !== destination || !sameSource() || !sameTarget(destination)) {
        throw new Error("\uC800\uC7A5 \uB0B4\uC6A9\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
      }
      target.editor.replaceRange(plan.text, target.editor.offsetToPos(offset));
      target.editor.setCursor(target.editor.offsetToPos(offset + plan.text.length));
      await target.save();
      const savedTarget = await vault.read(targetFile);
      if (savedTarget !== plan.merged || !sameTarget(plan.merged)) throw new Error("\uB300\uC0C1 \uC800\uC7A5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC6D0\uBCF8\uC744 \uBCF4\uC874\uD588\uC2B5\uB2C8\uB2E4. \uB300\uC0C1 \uB0B4\uC6A9\uC744 \uD655\uC778\uD558\uC138\uC694.");
      const latestSource = await vault.read(sourceFile);
      if (latestSource !== content || !sameSource() || !sameTarget(plan.merged)) {
        throw new Error("\uC774\uB3D9 \uC911 \uBB38\uC11C\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uC6D0\uBCF8\uC744 \uBCF4\uC874\uD588\uC2B5\uB2C8\uB2E4. \uB300\uC0C1\uC5D0 \uBCF5\uC0AC\uB41C \uB0B4\uC6A9\uC744 \uD655\uC778\uD558\uC138\uC694.");
      }
      if (plan.whole) await trash(sourceFile);
      else {
        source.editor.replaceRange("", source.editor.offsetToPos(from), source.editor.offsetToPos(to));
        source.editor.setCursor(source.editor.offsetToPos(from));
        await source.save();
      }
      return true;
    }
    async function moveDocumentTab2({ source, target, createTarget, workspace, vault }) {
      const file = source.file, content = source.editor.getValue();
      if (!file || target && source.leaf.parent === target.parent) throw new Error("\uB2E4\uB978 \uBB38\uC11C \uD328\uB110\uC744 \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      const selections = source.editor.listSelections();
      const scroll = source.editor.getScrollInfo();
      const state = source.leaf.getViewState(), ephemeral = source.leaf.getEphemeralState();
      await source.save();
      if (source.file !== file || source.editor.getValue() !== content || await vault.read(file) !== content) {
        throw new Error("\uC800\uC7A5 \uC911 \uBB38\uC11C\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uD0ED \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
      }
      target ||= createTarget?.();
      if (!target || source.leaf.parent === target.parent) throw new Error("\uB300\uC0C1 \uBB38\uC11C \uD328\uB110\uC744 \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      workspace.setActiveLeaf(target, { focus: false });
      const destination = target.view?.getViewType() === "empty" ? target : workspace.getLeaf("tab");
      if (destination.parent !== target.parent) {
        destination.detach();
        workspace.setActiveLeaf(source.leaf, { focus: true });
        throw new Error("\uB300\uC0C1 \uD328\uB110\uC5D0 \uD0ED\uC744 \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      try {
        await destination.setViewState({ ...state, active: true }, ephemeral);
        await workspace.revealLeaf(destination);
        if (source.file !== file || source.editor.getValue() !== content) throw new Error("\uBB38\uC11C\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uC6D0\uBCF8 \uD0ED\uC744 \uBCF4\uC874\uD588\uC2B5\uB2C8\uB2E4.");
        if (!destination.view.editor || destination.view.file?.path !== file.path || destination.view.editor.getValue() !== content) {
          throw new Error("\uB300\uC0C1 \uD0ED \uB0B4\uC6A9\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC6D0\uBCF8 \uD0ED\uC744 \uBCF4\uC874\uD588\uC2B5\uB2C8\uB2E4.");
        }
        destination.view.editor.setSelections(selections);
        destination.view.editor.scrollTo(scroll.left, scroll.top);
        source.leaf.detach();
        workspace.setActiveLeaf(destination, { focus: true });
        destination.view.editor.focus();
        workspace.requestSaveLayout();
        return destination;
      } catch (error) {
        workspace.setActiveLeaf(source.leaf, { focus: true });
        throw error;
      }
    }
    module2.exports = { adjacentPane: adjacentPane2, transferText, moveText: moveText2, moveDocumentTab: moveDocumentTab2 };
  }
});

// src/confirmation.js
var require_confirmation = __commonJS({
  "src/confirmation.js"(exports2, module2) {
    "use strict";
    var { Modal } = require("obsidian");
    var ConfirmationModal = class extends Modal {
      constructor(app, options, resolve) {
        super(app);
        this.options = options;
        this.resolve = resolve;
        this.accepted = false;
      }
      onOpen() {
        this.setTitle(this.options.title);
        this.contentEl.createEl("p", { text: this.options.message });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container lugtab-confirm-actions" });
        Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px", flexWrap: "wrap" });
        const cancel = actions.createEl("button", { text: "\uCDE8\uC18C", attr: { type: "button" } });
        const approve = actions.createEl("button", { text: this.options.confirmLabel, cls: "mod-warning", attr: { type: "button" } });
        cancel.onclick = () => this.close();
        const accept = () => {
          this.accepted = true;
          this.close();
        };
        approve.onclick = accept;
        this.keyHandler = (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
          if (event.target === cancel) return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) accept();
        };
        this.modalEl.addEventListener("keydown", this.keyHandler);
        approve.focus({ preventScroll: true });
      }
      onClose() {
        this.modalEl.removeEventListener("keydown", this.keyHandler);
        this.contentEl.empty();
        this.resolve(this.accepted);
      }
    };
    function confirmAction2(app, options) {
      return new Promise((resolve) => new ConfirmationModal(app, options, resolve).open());
    }
    module2.exports = { confirmAction: confirmAction2 };
  }
});

// src/icons.js
var require_icons = __commonJS({
  "src/icons.js"(exports2, module2) {
    "use strict";
    var { addIcon } = require("obsidian");
    var up = '<path d="M10 13V3.5M5.5 8 10 3.5 14.5 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 18.5h13M3.5 16h13M3.5 13.5h3.5M13 13.5h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>';
    var down = '<path d="M10 7v9.5M5.5 12 10 16.5 14.5 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 1.5h13M3.5 4h13M3.5 6.5h3.5M13 6.5h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>';
    function registerTransferIcons2() {
      for (const [direction, paths, rotation] of [
        ["up", up, 0],
        ["down", down, 0],
        ["left", up, -90],
        ["right", down, -90]
      ]) {
        addIcon(`lugtab-send-${direction}`, `<g transform="scale(5)"><g fill="none" transform="rotate(${rotation} 10 10)">${paths}</g></g>`);
      }
    }
    module2.exports = { registerTransferIcons: registerTransferIcons2 };
  }
});

// src/main.js
var { Plugin, MarkdownView, Notice, setIcon } = require("obsidian");
var { adjacentPane, moveText, moveDocumentTab } = require_transfer();
var { confirmAction } = require_confirmation();
var { registerTransferIcons } = require_icons();
module.exports = class PaneTransferPlugin extends Plugin {
  onload() {
    registerTransferIcons();
    this.busy = false;
    this.actions = /* @__PURE__ */ new Map();
    this.unloaded = false;
    this.addCommand({
      id: "focus-other-pane",
      name: "\uB2E4\uB978 \uBB38\uC11C \uD328\uB110\uB85C \uD3EC\uCEE4\uC2A4 \uC804\uD658",
      hotkeys: [{ modifiers: ["Ctrl"], key: "\\" }],
      editorCallback: (_editor, view) => this.focusOtherPane(view)
    });
    for (const [direction, label] of [["next", "\uB2E4\uC74C"], ["previous", "\uC774\uC804"]]) {
      this.addCommand({
        id: `move-tab-to-${direction}-pane`,
        name: `${label} \uBB38\uC11C \uD328\uB110\uB85C \uD604\uC7AC \uD0ED \uC62E\uAE30\uAE30`,
        editorCallback: (_editor, view) => this.moveTab(view, direction)
      });
    }
    this.registerDomEvent(document, "dblclick", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || document.querySelector(".modal-container")) return;
      const element = event.target;
      if (!element?.closest || element.closest("button, .view-action, .workspace-tab-header-inner-close-button")) return;
      const header = element.closest(".workspace-tab-header, .view-header-title");
      if (!header) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || header.closest(".workspace-tabs") !== view.containerEl.closest(".workspace-tabs")) return;
      if (header.matches(".workspace-tab-header") && !header.classList.contains("is-active")) return;
      event.preventDefault();
      event.stopPropagation();
      this.moveTab(view, event.shiftKey ? "previous" : "next", !event.shiftKey);
    }, true);
    for (const [direction, name] of [["next", "\uB2E4\uC74C \uBB38\uC11C \uD328\uB110\uB85C \uD14D\uC2A4\uD2B8 \uBCF4\uB0B4\uAE30 (\uC624\uB978\uCABD\xB7\uC544\uB798)"], ["previous", "\uC774\uC804 \uBB38\uC11C \uD328\uB110\uB85C \uD14D\uC2A4\uD2B8 \uBCF4\uB0B4\uAE30 (\uC67C\uCABD\xB7\uC704)"]]) {
      this.addCommand({
        id: `send-to-${direction}-pane`,
        name,
        editorCallback: (_editor, view) => this.send(view, direction)
      });
    }
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
      menu.addItem((item) => item.setTitle("\uB2E4\uC74C \uBB38\uC11C \uD328\uB110\uB85C \uBCF4\uB0B4\uAE30").setIcon("lugtab-send-right").onClick(() => this.send(view, "next")));
      menu.addItem((item) => item.setTitle("\uC774\uC804 \uBB38\uC11C \uD328\uB110\uB85C \uBCF4\uB0B4\uAE30").setIcon("lugtab-send-left").onClick(() => this.send(view, "previous")));
    }));
    for (const event of ["layout-change", "file-open", "active-leaf-change", "resize"]) {
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
    this.app.workspace.iterateRootLeaves((leaf) => {
      const el = leaf.view.containerEl;
      if (el.ownerDocument !== view.containerEl.ownerDocument || !el.isShown()) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) candidates.push({ leaf, rect });
    });
    return candidates;
  }
  adjacentLeaf(view, direction, fallback = false) {
    const candidates = this.visiblePanes(view);
    const source = candidates.find((item) => item.leaf === view.leaf);
    if (!source) return null;
    return (adjacentPane(source, candidates, direction) || fallback && adjacentPane(source, candidates, direction === "next" ? "previous" : "next"))?.leaf || null;
  }
  focusOtherPane(view) {
    if (this.busy || !(view instanceof MarkdownView) || view.containerEl.ownerDocument.querySelector(".modal-container")) return;
    const target = this.adjacentLeaf(view, "next", true);
    if (!target) return;
    this.app.workspace.setActiveLeaf(target, { focus: true });
    if (target.view instanceof MarkdownView && target.view.getMode() === "source") target.view.editor.focus();
  }
  createTargetPane(view, direction, axis = "vertical") {
    if (!this.visiblePanes(view).some((item) => item.leaf === view.leaf)) throw new Error("\uC8FC \uC791\uC5C5 \uC601\uC5ED\uC758 \uBB38\uC11C \uD328\uB110\uC5D0\uC11C \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.");
    return this.app.workspace.createLeafBySplit(view.leaf, axis, direction === "previous");
  }
  async moveTab(view, direction, fallback = false) {
    if (this.busy || !(view instanceof MarkdownView)) return;
    this.busy = true;
    try {
      const target = this.adjacentLeaf(view, direction, fallback);
      await moveDocumentTab({
        source: view,
        target,
        createTarget: () => this.createTargetPane(view, "next", "horizontal"),
        workspace: this.app.workspace,
        vault: this.app.vault
      });
    } catch (error) {
      new Notice(error.message, 6e3);
    } finally {
      this.busy = false;
      this.syncActions();
    }
  }
  syncActions() {
    if (this.unloaded) return;
    const views = /* @__PURE__ */ new Set();
    this.app.workspace.iterateRootLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) views.add(leaf.view);
    });
    for (const [view, buttons] of this.actions) {
      if (!views.has(view) || Object.values(buttons).some((button) => !button.isConnected)) {
        for (const button of Object.values(buttons)) button.remove();
        this.actions.delete(view);
      }
    }
    for (const view of views) {
      let buttons = this.actions.get(view);
      if (!buttons) {
        buttons = {};
        for (const direction of ["previous", "next"]) {
          const label = direction === "next" ? "\uB2E4\uC74C \uBB38\uC11C \uD328\uB110\uB85C \uD14D\uC2A4\uD2B8 \uBCF4\uB0B4\uAE30 (\uC624\uB978\uCABD\xB7\uC544\uB798)" : "\uC774\uC804 \uBB38\uC11C \uD328\uB110\uB85C \uD14D\uC2A4\uD2B8 \uBCF4\uB0B4\uAE30 (\uC67C\uCABD\xB7\uC704)";
          const button = view.addAction(direction === "next" ? "lugtab-send-right" : "lugtab-send-left", label, () => this.send(view, direction));
          button.addClass("lugtab-action");
          button.dataset.direction = direction;
          button.setAttribute("aria-label", label);
          button.setAttribute("role", "button");
          button.setAttribute("tabindex", "0");
          button.title = label;
          button.addEventListener("mousedown", (event) => event.preventDefault());
          if (button.tagName !== "BUTTON") button.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            this.send(view, direction);
          });
          buttons[direction] = button;
        }
        this.actions.set(view, buttons);
      }
      const candidates = this.visiblePanes(view);
      const source = candidates.find((item) => item.leaf === view.leaf);
      for (const [direction, button] of Object.entries(buttons)) {
        const target = source && adjacentPane(source, candidates, direction);
        const neighbor = target || source && adjacentPane(source, candidates, direction === "next" ? "previous" : "next");
        const horizontal = !neighbor || Math.min(source.rect.bottom, neighbor.rect.bottom) - Math.max(source.rect.top, neighbor.rect.top) > 1;
        const arrow = direction === "next" ? horizontal ? "right" : "down" : horizontal ? "left" : "up";
        setIcon(button, `lugtab-send-${arrow}`);
        button.setAttribute("aria-disabled", String(this.busy));
        button.style.opacity = this.busy ? "0.4" : "";
      }
    }
  }
  async send(view, direction) {
    if (this.busy) return;
    this.busy = true;
    this.syncActions();
    try {
      if (!(view instanceof MarkdownView) || view.getMode() !== "source") throw new Error("\uD3B8\uC9D1 \uBAA8\uB4DC\uC758 Markdown \uBB38\uC11C\uC5D0\uC11C \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.");
      const candidates = this.visiblePanes(view);
      const source = candidates.find((item) => item.leaf === view.leaf);
      if (!source) throw new Error("\uC8FC \uC791\uC5C5 \uC601\uC5ED\uC758 \uBB38\uC11C \uD328\uB110\uC5D0\uC11C \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.");
      let target = adjacentPane(source, candidates, direction)?.leaf;
      let confirmed = false;
      if (!target || target.view.getViewType() === "empty") {
        const file = view.file, content = view.editor.getValue();
        if (!file) throw new Error("\uC800\uC7A5\uB41C Markdown \uBB38\uC11C\uC5D0\uC11C \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.");
        if (view.editor.listSelections().length !== 1) throw new Error("\uC5EC\uB7EC \uC120\uD0DD \uC601\uC5ED\uC740 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD55C \uC601\uC5ED\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        const from = view.editor.posToOffset(view.editor.getCursor("from")), to = view.editor.posToOffset(view.editor.getCursor("to"));
        const unchanged = () => view.file === file && view.editor.getValue() === content && view.editor.posToOffset(view.editor.getCursor("from")) === from && view.editor.posToOffset(view.editor.getCursor("to")) === to;
        const folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/") + 1) : "";
        let path = folder + "\uC0C8 \uBA54\uBAA8.md", index = 2;
        while (this.app.vault.getAbstractFileByPath(path)) path = folder + `\uC0C8 \uBA54\uBAA8 ${index++}.md`;
        if (from === to) {
          confirmed = await confirmAction(this.app, { title: "\uBB38\uC11C \uC804\uCCB4 \uBCF4\uB0B4\uAE30", message: `${file.path} \uC804\uCCB4\uB97C \uC0C8 \uBB38\uC11C ${path}\uC5D0 \uD569\uCE58\uACE0 \uC6D0\uBCF8\uC740 \uD734\uC9C0\uD1B5\uC73C\uB85C \uBCF4\uB0BC\uAE4C\uC694?`, confirmLabel: "\uD569\uCE58\uACE0 \uD734\uC9C0\uD1B5\uC73C\uB85C \uBCF4\uB0B4\uAE30" });
          if (!confirmed) return;
        }
        if (!unchanged() || target && target.view.getViewType() !== "empty") throw new Error("\uBB38\uC11C \uB610\uB294 \uB300\uC0C1 \uD328\uB110\uC774 \uBCC0\uACBD\uB418\uC5B4 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
        if (!target) {
          if (this.adjacentLeaf(view, direction)) throw new Error("\uD328\uB110 \uBC30\uCE58\uAC00 \uBCC0\uACBD\uB418\uC5B4 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.");
          target = this.createTargetPane(view, direction);
        }
        if (!target || target.view.getViewType() !== "empty") throw new Error("\uBE48 \uB300\uC0C1 \uD328\uB110\uC744 \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        const created = await this.app.vault.create(path, "");
        if (!unchanged() || target.view.getViewType() !== "empty") throw new Error("\uB300\uC0C1 \uD328\uB110\uC774 \uBCC0\uACBD\uB418\uC5B4 \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4. \uC0C8 \uBA54\uBAA8\uB294 \uADF8\uB300\uB85C \uB450\uC5C8\uC2B5\uB2C8\uB2E4.");
        await target.setViewState({ type: "markdown", state: { file: created.path, mode: "source" }, active: false });
        if (!unchanged()) throw new Error("\uB300\uC0C1 \uBB38\uC11C\uB97C \uC5EC\uB294 \uB3D9\uC548 \uC6D0\uBCF8\uC774 \uBCC0\uACBD\uB418\uC5B4 \uC774\uB3D9\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4.");
      }
      if (!(target.view instanceof MarkdownView) || target.view.getMode() !== "source" || !target.view.file) {
        throw new Error("\uB300\uC0C1 \uD328\uB110\uC5D0 Markdown \uBB38\uC11C\uB97C \uD3B8\uC9D1 \uBAA8\uB4DC\uB85C \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      }
      if (await moveText({
        source: view,
        target: target.view,
        vault: this.app.vault,
        trash: (file) => this.app.vault.trash(file, true),
        confirm: (a, b) => confirmed || confirmAction(this.app, {
          title: "\uBB38\uC11C \uC804\uCCB4 \uBCF4\uB0B4\uAE30",
          message: `${a.path} \uC804\uCCB4\uB97C ${b.path}\uC5D0 \uD569\uCE58\uACE0 \uC6D0\uBCF8\uC740 \uD734\uC9C0\uD1B5\uC73C\uB85C \uBCF4\uB0BC\uAE4C\uC694?`,
          confirmLabel: "\uD569\uCE58\uACE0 \uD734\uC9C0\uD1B5\uC73C\uB85C \uBCF4\uB0B4\uAE30"
        })
      })) {
        this.app.workspace.setActiveLeaf(target, { focus: true });
        target.view.editor.focus();
        new Notice("\uD14D\uC2A4\uD2B8\uB97C \uC62E\uACBC\uC2B5\uB2C8\uB2E4.", 1500);
      }
    } catch (error) {
      new Notice(error.message, 6e3);
    } finally {
      this.busy = false;
      this.syncActions();
    }
  }
};
