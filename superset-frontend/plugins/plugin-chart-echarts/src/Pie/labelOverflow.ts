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
import { EchartsPieLabelOverflow } from './types';

export const LABEL_ELLIPSIS = '...';

type MeasureText = (text: string) => number;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined;

/**
 * Splits text into user-perceived characters so truncation and wrapping never
 * cut through a surrogate pair, an emoji ZWJ sequence or a combining mark.
 * Falls back to code points when `Intl.Segmenter` is unavailable.
 */
export function splitGraphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return Array.from(
      graphemeSegmenter.segment(text),
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
}

/**
 * Truncates a single line so that it, including the trailing ellipsis, fits
 * within `maxWidth`. Returns the line unchanged when it already fits, and just
 * the ellipsis when not even one character fits next to it.
 */
export function truncateLine(
  line: string,
  maxWidth: number,
  measure: MeasureText,
): string {
  if (measure(line) <= maxWidth) {
    return line;
  }
  const graphemes = splitGraphemes(line);
  // Binary search for the longest prefix that fits next to the ellipsis.
  let low = 0;
  let high = graphemes.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${graphemes.slice(0, mid).join('')}${LABEL_ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${graphemes.slice(0, low).join('').trimEnd()}${LABEL_ELLIPSIS}`;
}

/**
 * Wraps a single line onto as many lines as needed to fit `maxWidth`,
 * breaking at spaces. Words wider than `maxWidth` (long identifiers, CJK text
 * without spaces) are broken between characters. A single character wider
 * than `maxWidth` still gets its own line rather than being dropped.
 */
export function wrapLine(
  line: string,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  line.split(' ').forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      return;
    }
    flush();
    if (measure(word) <= maxWidth) {
      current = word;
      return;
    }
    splitGraphemes(word).forEach(grapheme => {
      const next = `${current}${grapheme}`;
      if (!current || measure(next) <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = grapheme;
      }
    });
  });
  flush();
  return lines;
}

/**
 * Fits a (possibly multiline) pie label into `maxWidth` pixels. Each line of
 * the label is handled on its own so templates such as `{name}\n{percent}`
 * keep their line structure. A non-positive `maxWidth` disables the limit.
 */
export function applyLabelOverflow(
  text: string,
  {
    maxWidth,
    overflow,
    measure,
  }: {
    maxWidth: number;
    overflow: EchartsPieLabelOverflow;
    measure: MeasureText;
  },
): string {
  if (!(maxWidth > 0) || !text) {
    return text;
  }
  return text
    .split('\n')
    .map(line =>
      overflow === EchartsPieLabelOverflow.Break
        ? wrapLine(line, maxWidth, measure).join('\n')
        : truncateLine(line, maxWidth, measure),
    )
    .join('\n');
}
