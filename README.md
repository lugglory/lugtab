# Lugtab

[한국어](README.ko.md)

Lugtab is an Obsidian plugin that sends text from a Markdown editor to the next (right / below) or previous (left / above) editor pane. Two arrow buttons at the top of every Markdown pane run it. With no selection, it asks for confirmation, merges the whole note (with its title) into the target note, and moves the original to the trash.

If there is no other pane, sending text creates a new pane and note — to the right for "next", to the left for "previous". Double-clicking a tab title moves the tab itself to the adjacent pane, creating a new pane below when none exists.

Requires Obsidian 1.7.2 or later. Works on desktop and mobile.

> The interface text (command names, notices, confirmation dialogs) is currently in Korean.

## Installation

Once the plugin is listed, install it from **Settings → Community plugins → Browse** by searching for "Lugtab".

Manual installation:

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/lugglory/lugtab/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/lugtab/`.
3. Enable the plugin in **Settings → Community plugins**. Restart Obsidian if it is not listed.

## Usage

In a Markdown note in editing mode (including Live Preview), use the **previous / next send buttons at the top of each pane**. Horizontal splits show left / right arrows and vertical splits show up / down arrows. The same actions are available from the command palette and the editor context menu:

- Send text to the next editor pane (right / below)
- Send text to the previous editor pane (left / above)
- Move the current tab to the next / previous editor pane
- Switch focus to another editor pane

Panes are cycled top to bottom, then left to right at the same height. The pane after the last one is the first, and the pane before the first is the last. Sending text, moving tabs, and switching focus all use the same order. Hidden tabs, sidebars, and pop-out windows are not targets.

- **With a selection:** the text is inserted at the **last cursor position of the target note** and removed from the source. A selection in the target is never overwritten.
- **Without a selection:** after confirmation, the whole note is merged into the target under a `# File name` heading (not duplicated if the first line already is that heading). Once the target is verified as saved, the original goes to the system trash (or the vault trash if unavailable).
- After sending, focus moves to the target editor. If the target pane is empty, a new note is created in the same folder as the source and receives the text. Whole-note transfers ask for confirmation before any pane or note is created; cancelling creates neither. In reading mode, or when source and target are the same file, only a notice is shown.
- Multiple cursors are not supported. Use a single selection.
- **Double-click a tab title or the note title bar:** moves the tab to the next pane. **Shift + double-click:** moves it to the previous pane. If there is no target, a new pane is created below. The original tab is closed only after the note is confirmed open in the target, and an emptied pane is not left behind. No text is merged and no file is deleted.
- **Switch focus:** cycles focus to the next pane while keeping the cursor and selection. No pane is created.
- No default hotkeys are assigned. Set your own in **Settings → Hotkeys** (for example `Ctrl+\` for switching focus).

Tab moves reopen the note in the target pane through the public API, reveal the target tab, and wait for deferred loading to finish before verifying the content and closing the original tab. If loading fails, the content does not match, or the source changes meanwhile, the original tab is kept. Cursor, selection, and scroll position are restored, but the editor's undo history is not carried over. The double-click binding relies on Obsidian's tab / title DOM classes and may need adjusting when the app UI changes.

## Safety

If saving the target fails, the saved content does not match, or a note changes during the transfer, the source is not removed. A copy may remain in the target in that case — follow the notice to check. There is no combined undo across both files. The operation does not lock the file system, so avoid editing the same notes concurrently with external programs or sync tools.

The plugin makes no network requests and collects no data. It only reads and modifies notes inside your vault.

## Development

```sh
npm ci
npm run build
npm test
npm run test:ui
```

`npm run build` bundles `src/` into `main.js`. `npm run test:ui` checks the send buttons, the double-click binding, focus switching, and the confirmation dialog in a hidden Electron window. See the [requirements checklist](QA.md) (Korean) for coverage and the limits of host verification.

The tests use stand-ins for the UI and vault APIs, which is not the same as verification in a real Obsidian. Try changes on a copy of a real vault before releasing.

## License

[MIT](LICENSE)
