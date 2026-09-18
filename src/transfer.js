'use strict';

// Cycle through visible panels in reading order. Hidden tabs and sidebars do
// not participate; next/previous are exact inverses even in nested split grids.
function adjacentPane(source, candidates, direction) {
  const ordered = [...candidates].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const index = ordered.findIndex(item => item.leaf === source.leaf);
  if (index < 0 || ordered.length < 2) return null;
  return ordered[(index + (direction === 'next' ? 1 : ordered.length - 1)) % ordered.length];
}

function transferText(content, title, from, to, destination, offset) {
  const whole = from === to;
  let text = content.slice(from, to);
  if (whole) {
    const body = content.trim();
    const heading = /^#\s+(.+)$/.exec(body.split('\n')[0]);
    text = (heading?.[1].trim() === title ? body : '# ' + title + '\n\n' + body) + '\n';
  }
  if (whole || text.includes('\n')) {
    if (offset > 0 && destination[offset - 1] !== '\n') text = '\n' + text;
    if (offset < destination.length && !text.endsWith('\n')) text += '\n';
  }
  return { whole, text, merged: destination.slice(0, offset) + text + destination.slice(offset) };
}

// Saving the destination is the commit point: no source removal before a
// successful disk readback. Changed editors/files leave the source intact.
async function moveText({ source, target, vault, trash, confirm }) {
  const sourceFile = source.file, targetFile = target.file;
  if (!sourceFile || !targetFile || sourceFile.path === targetFile.path) throw new Error('서로 다른 두 문서를 열어 주세요.');
  const sourcePath = sourceFile.path, targetPath = targetFile.path;
  const content = source.editor.getValue(), destination = target.editor.getValue();
  const selections = source.editor.listSelections();
  if (selections.length !== 1) throw new Error('여러 선택 영역은 지원하지 않습니다. 한 영역을 선택해 주세요.');
  const from = source.editor.posToOffset(source.editor.getCursor('from'));
  const to = source.editor.posToOffset(source.editor.getCursor('to'));
  const offset = target.editor.posToOffset(target.editor.getCursor('from'));
  const plan = transferText(content, sourceFile.basename, from, to, destination, offset);
  const sameSource = () => source.file === sourceFile && sourceFile.path === sourcePath && source.editor.getValue() === content;
  const sameTarget = text => target.file === targetFile && targetFile.path === targetPath && target.editor.getValue() === text;
  if (plan.whole && !(await confirm(sourceFile, targetFile))) return false;
  if (!sameSource() || !sameTarget(destination)) throw new Error('문서가 변경되어 이동을 취소했습니다.');
  await source.save();
  await target.save();
  if (!sameSource() || !sameTarget(destination)) throw new Error('저장 중 문서가 변경되어 이동을 취소했습니다.');
  const sourceDisk = await vault.read(sourceFile);
  const targetDisk = await vault.read(targetFile);
  if (sourceDisk !== content || targetDisk !== destination || !sameSource() || !sameTarget(destination)) {
    throw new Error('저장 내용을 확인할 수 없어 이동을 취소했습니다.');
  }
  target.editor.replaceRange(plan.text, target.editor.offsetToPos(offset));
  target.editor.setCursor(target.editor.offsetToPos(offset + plan.text.length));
  await target.save();
  const savedTarget = await vault.read(targetFile);
  if (savedTarget !== plan.merged || !sameTarget(plan.merged)) throw new Error('대상 저장을 확인하지 못해 원본을 보존했습니다. 대상 내용을 확인하세요.');
  const latestSource = await vault.read(sourceFile);
  if (latestSource !== content || !sameSource() || !sameTarget(plan.merged)) {
    throw new Error('이동 중 문서가 변경되어 원본을 보존했습니다. 대상에 복사된 내용을 확인하세요.');
  }
  if (plan.whole) await trash(sourceFile);
  else {
    source.editor.replaceRange('', source.editor.offsetToPos(from), source.editor.offsetToPos(to));
    source.editor.setCursor(source.editor.offsetToPos(from));
    await source.save();
  }
  return true;
}

async function moveDocumentTab({ source, target, createTarget, workspace, vault }) {
  const file = source.file, content = source.editor.getValue();
  if (!file || (target && source.leaf.parent === target.parent)) throw new Error('다른 문서 패널을 열어 주세요.');
  const selections = source.editor.listSelections();
  const scroll = source.editor.getScrollInfo();
  const state = source.leaf.getViewState(), ephemeral = source.leaf.getEphemeralState();
  await source.save();
  if (source.file !== file || source.editor.getValue() !== content || await vault.read(file) !== content) {
    throw new Error('저장 중 문서가 변경되어 탭 이동을 취소했습니다.');
  }
  target ||= createTarget?.();
  if (!target || source.leaf.parent === target.parent) throw new Error('대상 문서 패널을 만들지 못했습니다.');
  workspace.setActiveLeaf(target, { focus: false });
  const destination = target.view?.getViewType() === 'empty' ? target : workspace.getLeaf('tab');
  if (destination.parent !== target.parent) {
    destination.detach(); workspace.setActiveLeaf(source.leaf, { focus: true });
    throw new Error('대상 패널에 탭을 만들지 못했습니다.');
  }
  try {
    await destination.setViewState({ ...state, active: true }, ephemeral);
    // setViewState can leave a DeferredView in place. revealLeaf resolves only
    // after the destination is visible and its actual document view has loaded.
    await workspace.revealLeaf(destination);
    if (source.file !== file || source.editor.getValue() !== content) throw new Error('문서가 변경되어 원본 탭을 보존했습니다.');
    if (!destination.view.editor || destination.view.file?.path !== file.path || destination.view.editor.getValue() !== content) {
      throw new Error('대상 탭 내용을 확인하지 못해 원본 탭을 보존했습니다.');
    }
    destination.view.editor.setSelections(selections);
    destination.view.editor.scrollTo(scroll.left, scroll.top);
    // Close the original only after the destination has opened the saved content.
    source.leaf.detach();
    workspace.setActiveLeaf(destination, { focus: true });
    destination.view.editor.focus();
    workspace.requestSaveLayout();
    return destination;
  } catch (error) {
    // Do not remove a newly opened destination after an unexpected edit.
    workspace.setActiveLeaf(source.leaf, { focus: true });
    throw error;
  }
}

module.exports = { adjacentPane, transferText, moveText, moveDocumentTab };
