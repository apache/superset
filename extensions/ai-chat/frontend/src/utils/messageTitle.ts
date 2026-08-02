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
import { translation } from '@apache-superset/core';

const { t } = translation;

export const MAX_TITLE_CHARS = 70;

/**
 * Whether a reply has more to show than its title. A short single-line answer
 * is fully represented by its title, so collapsing it would print it twice.
 */
export function isCollapsible(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.includes('\n') || trimmed.length > MAX_TITLE_CHARS;
}

/** Leading markdown decoration that should not appear in a title */
const LEADING_MARKER = /^\s*(?:[#>]+|[-*+]|\d+[.)])\s*/;
const INLINE_MARKERS = /(\*\*|__|[*_`~])/g;
const LINK = /\[([^\]]+)\]\([^)]*\)/g;

/**
 * Short label describing an assistant reply, taken from a leading heading
 * when the model wrote one and its first sentence otherwise. Deriving the
 * title locally costs no extra tokens and cannot fail on its own.
 */
export function deriveMessageTitle(content: string): string {
  const source = leadingHeading(content) ?? firstSentence(content);
  const cleaned = source
    .replace(LEADING_MARKER, '')
    .replace(LINK, '$1')
    .replace(INLINE_MARKERS, '')
    .trim();

  if (!cleaned) return t('Assistant');
  return cleaned.length > MAX_TITLE_CHARS
    ? `${cleaned.slice(0, MAX_TITLE_CHARS).trimEnd()}…`
    : cleaned;
}

/** The heading only when the reply opens with one */
function leadingHeading(content: string): string | null {
  const first = content.split('\n').find(line => line.trim());
  return first && first.trim().startsWith('#') ? first.trim() : null;
}

/**
 * The reply with its opening heading removed, since that heading becomes the
 * panel title. Later headings are part of the answer's structure and stay.
 * Copying uses the original content, never this.
 */
export function messageBody(content: string): string {
  if (!leadingHeading(content)) return content;
  const lines = content.split('\n');
  const index = lines.findIndex(line => line.trim());
  return lines
    .slice(index + 1)
    .join('\n')
    .replace(/^\s*\n/, '');
}

/** First sentence of the first non-empty, non-fence line */
function firstSentence(content: string): string {
  const line = content
    .split('\n')
    .map(entry => entry.trim())
    .find(entry => entry && !entry.startsWith('```'));
  if (!line) return '';
  // Split on sentence punctuation followed by a space, so decimals and
  // identifiers such as "v1.2" or "chart.id" stay intact
  const [sentence] = line.split(/(?<=[.!?])\s/);
  return sentence || line;
}
