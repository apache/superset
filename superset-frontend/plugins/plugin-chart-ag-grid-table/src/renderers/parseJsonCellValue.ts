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

export type JsonContainer = Record<string, unknown> | unknown[];

// Visible cells are parsed on the render path. Above this size the cell stays
// plain text. Parsed results are reused for the same string, up to a total
// length so a session of large values cannot keep every one of them.
const MAX_JSON_CELL_LENGTH = 100_000;
const PARSE_CACHE_MAX_LENGTH = 500_000;

const parsedJsonCache = new Map<string, JsonContainer | null>();
let parsedJsonCacheLength = 0;

function isJsonContainer(value: unknown): value is JsonContainer {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value instanceof Date) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return isJsonContainer(value) && !Array.isArray(value);
}

function rememberParse(
  text: string,
  parsed: JsonContainer | null,
): JsonContainer | null {
  if (text.length > PARSE_CACHE_MAX_LENGTH) {
    return parsed;
  }
  while (
    parsedJsonCacheLength + text.length > PARSE_CACHE_MAX_LENGTH &&
    parsedJsonCache.size > 0
  ) {
    const oldest = parsedJsonCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    parsedJsonCache.delete(oldest);
    parsedJsonCacheLength -= oldest.length;
  }
  parsedJsonCache.set(text, parsed);
  parsedJsonCacheLength += text.length;
  return parsed;
}

/**
 * Accept a JSON object or array, either already parsed or as text.
 * Scalars, invalid JSON, and non-JSON text return null so the cell stays
 * on the plain-text renderer.
 */
export function parseJsonCellValue(value: unknown): JsonContainer | null {
  if (isJsonContainer(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length > MAX_JSON_CELL_LENGTH) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return null;
  }
  const cached = parsedJsonCache.get(trimmed);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return rememberParse(trimmed, isJsonContainer(parsed) ? parsed : null);
  } catch {
    return rememberParse(trimmed, null);
  }
}

function isFormattingWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

/**
 * Collapse formatting whitespace onto one line. Spaces inside JSON strings
 * stay as written.
 */
function collapseFormattingWhitespace(source: string): string {
  let collapsed = '';
  let inString = false;
  let escaped = false;
  let pendingSpace = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      collapsed += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (isFormattingWhitespace(char)) {
      pendingSpace = collapsed.length > 0;
      continue;
    }
    if (char === '"') {
      inString = true;
    }
    if (pendingSpace) {
      collapsed += ' ';
      pendingSpace = false;
    }
    collapsed += char;
  }
  return collapsed.trim();
}

// Deep enough to cover real payloads, and shallow enough that the later
// JSON.stringify cannot overflow the call stack.
const PREVIEW_MAX_DEPTH = 1_000;

function exceedsPreviewBudget(value: JsonContainer): boolean {
  let left = MAX_JSON_CELL_LENGTH;
  const seen = new Set<object>();
  const stack: Array<{ node: unknown; depth: number }> = [
    { node: value, depth: 0 },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }
    const { node, depth } = current;
    if (depth > PREVIEW_MAX_DEPTH) {
      return true;
    }
    if (typeof node === 'string') {
      left -= node.length;
      if (left < 0) {
        return true;
      }
      continue;
    }
    if (node === null || typeof node !== 'object') {
      continue;
    }
    if (seen.has(node)) {
      return true;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      left -= node.length;
      if (left < 0) {
        return true;
      }
      for (let index = node.length - 1; index >= 0; index -= 1) {
        stack.push({ node: node[index], depth: depth + 1 });
      }
      continue;
    }
    if (!isPlainJsonObject(node)) {
      continue;
    }
    const keys = Object.keys(node);
    left -= keys.length;
    if (left < 0) {
      return true;
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      stack.push({ node: node[keys[index]], depth: depth + 1 });
    }
  }
  return false;
}

function abbreviatedJson(value: JsonContainer): string {
  return Array.isArray(value) ? '[…]' : '{…}';
}

/** One-line preview of a JSON object or array. */
export function jsonCellPreview(
  value: JsonContainer,
  rawText?: string,
): string {
  if (rawText !== undefined) {
    return collapseFormattingWhitespace(rawText);
  }
  if (exceedsPreviewBudget(value)) {
    return abbreviatedJson(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return abbreviatedJson(value);
  }
}

/** Multiline text for a wrapping column. Oversized values stay abbreviated. */
export function jsonCellWrappedText(value: JsonContainer): string {
  if (exceedsPreviewBudget(value)) {
    return abbreviatedJson(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return abbreviatedJson(value);
  }
}
