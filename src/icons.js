'use strict';
const { addIcon } = require('obsidian');

// Preserve the send buttons from renderer/index.html, including their line weights.
const up = '<path d="M10 13V3.5M5.5 8 10 3.5 14.5 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M3.5 18.5h13M3.5 16h13M3.5 13.5h3.5M13 13.5h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>';
const down = '<path d="M10 7v9.5M5.5 12 10 16.5 14.5 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M3.5 1.5h13M3.5 4h13M3.5 6.5h3.5M13 6.5h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>';

function registerTransferIcons() {
  for (const [direction, paths, rotation] of [
    ['up', up, 0], ['down', down, 0], ['left', up, -90], ['right', down, -90],
  ]) {
    addIcon(`lugtab-send-${direction}`, `<g transform="scale(5)"><g fill="none" transform="rotate(${rotation} 10 10)">${paths}</g></g>`);
  }
}

module.exports = { registerTransferIcons };
