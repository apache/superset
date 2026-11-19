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

/**
 * Ace positions the caret on a monospace grid (`column × charWidth`) and
 * renders anything it classifies as "full width" inside a forced
 * `2 × charWidth` inline-block (`.ace_cjk`), so the grid model and the pixels
 * agree. Its width tables only cover East-Asian ranges, though:
 *
 * - Astral emoji (💡, surrogate pairs) happen to work: the renderer's
 *   surrogate-pair branch forces the 2-cell box and the column counter
 *   counts the two code units.
 * - BMP emoji with default emoji presentation (✨ U+2728, ⭐ U+2B50, …) fall
 *   through BOTH nets: they count as 1 column but render ~1.6 cells wide, so
 *   the caret drifts on any line containing one (issue #41664, upstream
 *   ajaxorg/ace#3404).
 * - VS16 sequences (❤️ = U+2764 U+FE0F) render as one color glyph while the
 *   two code units count as two ordinary columns, without the forced box.
 *
 * The patch extends the exact mechanism Ace already uses — count 2 columns
 * and force the 2-cell box — to emoji-presentation codepoints and VS16
 * sequences, by overriding the two `EditSession` width methods (verbatim
 * copies of the ace-builds internals plus one branch; the originals call a
 * module-private `isFullWidth`, so they cannot be extended in place) and
 * wrapping the text layer's `$renderToken` to emit the forced-width span for
 * emoji runs before delegating everything else to the original.
 *
 * Deliberately out of scope: ZWJ sequences (family emoji) and flag pairs
 * render as one glyph but count per component; handling them needs grapheme
 * segmentation across every Ace layer, and they were equally misaligned
 * before this patch.
 */

const VS16 = 0xfe0f;

// Tokens ace renders as bare text nodes with no token-class span; mirrors
// ace/layer/text_util's textTokens set.
const TEXT_TOKENS = new Set(['text', 'rparen', 'lparen']);

// Emoji_Presentation covers exactly the codepoints browsers render as color
// emoji without a variation selector. Lone surrogates never match it (the
// astral path is already consistent), so only BMP emoji change behavior.
const EMOJI_PRESENTATION_RE = /\p{Emoji_Presentation}/u;
// One renderable emoji cluster: an emoji-presentation codepoint with an
// optional (redundant) VS16, or a text-presentation emoji forced to color
// presentation by VS16.
const EMOJI_CLUSTER_SOURCE =
  '(?:\\p{Emoji_Presentation}\\uFE0F?|\\p{Emoji}\\uFE0F)';
const EMOJI_RUN_TEST_RE = new RegExp(`${EMOJI_CLUSTER_SOURCE}`, 'u');
const EMOJI_RUN_SPLIT_RE = new RegExp(`(${EMOJI_CLUSTER_SOURCE}+)`, 'gu');
const EMOJI_CLUSTER_RE = new RegExp(EMOJI_CLUSTER_SOURCE, 'gu');

// Memoized per-code-unit classification; $getStringScreenWidth runs per
// character per rendered line, so the regexes must not run every time.
const EMOJI_BASE_RE = /\p{Emoji}/u;
const emojiBaseCache = new Map<number, boolean>();
function isEmojiBase(code: number): boolean {
  let result = emojiBaseCache.get(code);
  if (result === undefined) {
    result = EMOJI_BASE_RE.test(String.fromCharCode(code));
    emojiBaseCache.set(code, result);
  }
  return result;
}

const bmpEmojiCache = new Map<number, boolean>();
export function isBmpEmojiPresentation(code: number): boolean {
  if (code < 0x2000 || code > 0xffff || (code >= 0xd800 && code <= 0xdfff)) {
    return false;
  }
  let result = bmpEmojiCache.get(code);
  if (result === undefined) {
    result = EMOJI_PRESENTATION_RE.test(String.fromCharCode(code));
    bmpEmojiCache.set(code, result);
  }
  return result;
}

/**
 * Screen-column contribution of one code unit under the emoji rules, or null
 * when Ace's default handling should apply. Emoji-presentation chars are 2
 * columns; VS16 tops its base up to 2 in total (so ❤️ = 1 + 1 and a
 * redundant ✨️ = 2 + 0).
 */
export function emojiWidth(code: number, prevCode: number): number | null {
  if (isBmpEmojiPresentation(code)) {
    return 2;
  }
  if (code === VS16) {
    return isBmpEmojiPresentation(prevCode) ? 0 : 1;
  }
  return null;
}

interface PatchableEditSessionClass {
  prototype: {
    isFullWidth: (c: number) => boolean;
    getScreenTabSize: (screenColumn: number) => number;
    $getStringScreenWidth: (
      str: string,
      maxScreenColumn?: number,
      screenColumn?: number,
    ) => [number, number];
    $getDisplayTokens: (str: string, offset: number) => number[];
  };
}

interface TextLayerInstance {
  config: { characterWidth: number };
  dom: { createElement: (tag: string) => HTMLElement };
}

type RenderToken = (
  this: TextLayerInstance,
  parent: HTMLElement,
  screenColumn: number,
  token: { type: string; value: string },
  value: string,
) => number;

interface PatchableTextLayerClass {
  prototype: { $renderToken: RenderToken };
}

let patched = false;

export function patchAceEmojiWidths(
  EditSession: PatchableEditSessionClass,
  TextLayer: PatchableTextLayerClass,
): void {
  if (patched) {
    return;
  }
  patched = true;

  const sessionProto = EditSession.prototype;
  const { isFullWidth } = sessionProto;

  // Mirrors EditSession.prototype.$getStringScreenWidth from ace-builds
  // (src-noconflict/ace.js), adding the emojiWidth branch.
  sessionProto.$getStringScreenWidth = function $getStringScreenWidth(
    this: PatchableEditSessionClass['prototype'],
    str: string,
    maxScreenColumn?: number,
    screenColumn?: number,
  ): [number, number] {
    if (maxScreenColumn === 0) {
      return [0, 0];
    }
    const max = maxScreenColumn ?? Infinity;
    let screen = screenColumn || 0;
    let column;
    for (column = 0; column < str.length; column += 1) {
      const c = str.charCodeAt(column);
      const emoji = emojiWidth(c, column > 0 ? str.charCodeAt(column - 1) : 0);
      if (c === 9) {
        screen += this.getScreenTabSize(screen);
      } else if (emoji !== null) {
        screen += emoji;
      } else if (c >= 0x1100 && isFullWidth(c)) {
        screen += 2;
      } else {
        screen += 1;
      }
      if (screen > max) {
        break;
      }
    }
    return [screen, column];
  };

  // Display-token codes from ace's edit_session module.
  const CHAR = 1;
  const CHAR_EXT = 2;
  const PUNCTUATION = 9;
  const SPACE = 10;
  const TAB = 11;
  const TAB_SPACE = 12;

  // Mirrors EditSession.prototype.$getDisplayTokens, adding the emoji branch.
  // One entry per code unit is preserved (VS16 pushes a lone CHAR_EXT) so the
  // wrap-split offset math stays aligned with document columns.
  sessionProto.$getDisplayTokens = function $getDisplayTokens(
    this: PatchableEditSessionClass['prototype'],
    str: string,
    offset: number,
  ): number[] {
    const arr: number[] = [];
    let tabSize: number;
    for (let i = 0; i < str.length; i += 1) {
      const c = str.charCodeAt(i);
      const emoji = emojiWidth(c, i > 0 ? str.charCodeAt(i - 1) : 0);
      if (c === 9) {
        tabSize = this.getScreenTabSize(arr.length + offset);
        arr.push(TAB);
        for (let n = 1; n < tabSize; n += 1) {
          arr.push(TAB_SPACE);
        }
      } else if (emoji === 2) {
        arr.push(CHAR, CHAR_EXT);
      } else if (emoji === 0) {
        arr.push(CHAR_EXT);
      } else if (c === VS16 && i > 0 && isEmojiBase(str.charCodeAt(i - 1))) {
        // VS16 after a text-presentation emoji base (❤️): keep the pair
        // atomic for wrap splitting; its width contribution stays 1.
        arr.push(CHAR_EXT);
      } else if (c === 32) {
        arr.push(SPACE);
      } else if ((c > 39 && c < 48) || (c > 57 && c < 64)) {
        arr.push(PUNCTUATION);
      } else if (c >= 0x1100 && isFullWidth(c)) {
        arr.push(CHAR, CHAR_EXT);
      } else {
        arr.push(CHAR);
      }
    }
    return arr;
  };

  // Pre-split token text on emoji runs: emoji clusters get the same forced
  // 2 × charWidth `.ace_cjk` box Ace gives CJK (so rendered geometry matches
  // the 2-column model above); everything else delegates to the original.
  const origRenderToken = TextLayer.prototype.$renderToken;
  TextLayer.prototype.$renderToken = function $renderToken(
    this: TextLayerInstance,
    parent: HTMLElement,
    screenColumn: number,
    token: { type: string; value: string },
    value: string,
  ): number {
    if (!EMOJI_RUN_TEST_RE.test(value)) {
      return origRenderToken.call(this, parent, screenColumn, token, value);
    }
    // Non-text tokens normally have their whole fragment wrapped in a
    // token-class span ("ace_" + dotted type); carry those classes on the
    // emoji box itself so syntax styling that isn't glyph color (comment
    // italics, invalid-token backgrounds, …) still applies to emoji.
    // Mirrors ace's text_util.isTextToken and $renderToken class handling.
    const tokenClasses = TEXT_TOKENS.has(token.type)
      ? ''
      : ` ace_${token.type.replace(/\./g, ' ace_')}`;
    let column = screenColumn;
    value.split(EMOJI_RUN_SPLIT_RE).forEach((part, index) => {
      if (!part) {
        return;
      }
      const isEmojiRun = index % 2 === 1;
      if (isEmojiRun) {
        // Parts at odd indices are the split's capture group, so every one
        // is a non-empty sequence of clusters; matchAll never comes up empty.
        Array.from(part.matchAll(EMOJI_CLUSTER_RE), m => m[0]).forEach(
          cluster => {
            const span = this.dom.createElement('span');
            span.style.width = `${this.config.characterWidth * 2}px`;
            span.className = `ace_cjk${tokenClasses}`;
            span.textContent = cluster;
            parent.appendChild(span);
            column += 2;
          },
        );
      } else {
        column = origRenderToken.call(this, parent, column, token, part);
      }
    });
    return column;
  };
}
