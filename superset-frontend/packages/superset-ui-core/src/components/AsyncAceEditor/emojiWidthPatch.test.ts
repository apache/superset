/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import ace from 'ace-builds/src-noconflict/ace';
import {
  emojiWidth,
  isBmpEmojiPresentation,
  patchAceEmojiWidths,
} from './emojiWidthPatch';

const { EditSession } = ace.require('ace/edit_session');
const { Text: TextLayer } = ace.require('ace/layer/text');

beforeAll(() => {
  patchAceEmojiWidths(EditSession, TextLayer);
});

test('classifies BMP emoji-presentation codepoints and nothing else', () => {
  expect(isBmpEmojiPresentation('✨'.charCodeAt(0))).toBe(true); // U+2728
  expect(isBmpEmojiPresentation('⭐'.charCodeAt(0))).toBe(true); // U+2B50
  expect(isBmpEmojiPresentation('❤'.charCodeAt(0))).toBe(false); // text-default
  expect(isBmpEmojiPresentation('A'.charCodeAt(0))).toBe(false);
  expect(isBmpEmojiPresentation('中'.charCodeAt(0))).toBe(false); // CJK, ace's own tables
  expect(isBmpEmojiPresentation(0xd83d)).toBe(false); // lone surrogate
});

test('emojiWidth: VS16 tops its base up to 2 columns total', () => {
  const VS16 = 0xfe0f;
  expect(emojiWidth('✨'.charCodeAt(0), 0)).toBe(2);
  // ❤️ = U+2764 (1 by default rules) + VS16 (1) = 2 total
  expect(emojiWidth('❤'.charCodeAt(0), 0)).toBe(null);
  expect(emojiWidth(VS16, '❤'.charCodeAt(0))).toBe(1);
  // Redundant ✨️ = ✨ (2) + VS16 (0) = 2 total
  expect(emojiWidth(VS16, '✨'.charCodeAt(0))).toBe(0);
  expect(emojiWidth('A'.charCodeAt(0), 0)).toBe(null);
});

test('caret math counts emoji as two columns (issue #41664 repro line)', () => {
  const session = new EditSession('### ✨Header 3');
  // Before "H" (doc column 5): "### " = 4 + ✨ = 2 → screen column 6.
  expect(session.documentToScreenColumn(0, 5)).toBe(6);
  // End of line: 4 + 2 + "Header 3".length (8) = 14.
  expect(session.documentToScreenColumn(0, 13)).toBe(14);
});

test('astral emoji keep their pre-existing two-column accounting', () => {
  const session = new EditSession('💡X');
  // 💡 is two code units (doc columns 0-1) and two screen columns.
  expect(session.documentToScreenColumn(0, 2)).toBe(2);
});

test('$getStringScreenWidth counts emoji, VS16 pairs, and plain text', () => {
  const session = new EditSession('');
  expect(session.$getStringScreenWidth('✨')[0]).toBe(2);
  expect(session.$getStringScreenWidth('❤️')[0]).toBe(2);
  expect(session.$getStringScreenWidth('✨️')[0]).toBe(2);
  expect(session.$getStringScreenWidth('abc')[0]).toBe(3);
  expect(session.$getStringScreenWidth('中')[0]).toBe(2); // ace's own CJK path
});

test('renderer draws emoji in a forced 2×charWidth box like CJK', () => {
  const container = document.createElement('div');
  const layer = new TextLayer(container);
  layer.config = { characterWidth: 10 };

  const parent = document.createElement('div');
  const screenColumn = layer.$renderToken(
    parent,
    0,
    { type: 'text', value: '# ✨Header' },
    '# ✨Header',
  );

  const box = parent.querySelector<HTMLElement>('.ace_cjk');
  expect(box).not.toBeNull();
  expect(box?.textContent).toBe('✨');
  expect(box?.style.width).toBe('20px');
  // "# " (2) + ✨ (2) + "Header" (6) = 10 columns.
  expect(screenColumn).toBe(10);
  // Text around the emoji is preserved in order.
  expect(parent.textContent).toBe('# ✨Header');
});

test('renderer leaves emoji-free tokens entirely to the original path', () => {
  const container = document.createElement('div');
  const layer = new TextLayer(container);
  layer.config = { characterWidth: 10 };

  const parent = document.createElement('div');
  const screenColumn = layer.$renderToken(
    parent,
    0,
    { type: 'text', value: 'SELECT 1' },
    'SELECT 1',
  );

  expect(parent.querySelector('.ace_cjk')).toBeNull();
  expect(parent.textContent).toBe('SELECT 1');
  expect(screenColumn).toBe(8);
});

test('patch is idempotent', () => {
  const before = EditSession.prototype.$getStringScreenWidth;
  patchAceEmojiWidths(EditSession, TextLayer);
  expect(EditSession.prototype.$getStringScreenWidth).toBe(before);
});
