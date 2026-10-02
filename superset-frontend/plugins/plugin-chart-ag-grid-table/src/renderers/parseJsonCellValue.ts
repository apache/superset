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
// plain text. Parsed results are reused for the same string.
const MAX_JSON_CELL_LENGTH = 100_000;
const PARSE_CACHE_LIMIT = 200;

const parsedJsonCache = new Map<string, JsonContainer | null>();

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

function rememberParse(
  text: string,
  parsed: JsonContainer | null,
): JsonContainer | null {
  if (parsedJsonCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parsedJsonCache.keys().next().value;
    if (oldest !== undefined) {
      parsedJsonCache.delete(oldest);
    }
  }
  parsedJsonCache.set(text, parsed);
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
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_JSON_CELL_LENGTH ||
    (trimmed[0] !== '{' && trimmed[0] !== '[')
  ) {
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

function exceedsPreviewBudget(
  value: unknown,
  budget: { left: number },
): boolean {
  if (budget.left < 0) {
    return true;
  }
  if (typeof value === 'string') {
    budget.left -= value.length;
    return budget.left < 0;
  }
  if (Array.isArray(value)) {
    budget.left -= value.length;
    return value.some(item => exceedsPreviewBudget(item, budget));
  }
  if (isJsonContainer(value)) {
    const keys = Object.keys(value);
    budget.left -= keys.length;
    return keys.some(key => exceedsPreviewBudget(value[key], budget));
  }
  return false;
}

/** One-line preview of a JSON object or array. */
export function jsonCellPreview(
  value: JsonContainer,
  rawText?: string,
): string {
  if (rawText !== undefined) {
    return collapseFormattingWhitespace(rawText);
  }
  if (exceedsPreviewBudget(value, { left: MAX_JSON_CELL_LENGTH })) {
    return Array.isArray(value) ? '[…]' : '{…}';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Array.isArray(value) ? '[…]' : '{…}';
  }
}
